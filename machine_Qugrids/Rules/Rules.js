const {message_hardRules, correct_order,delete_repeated_msgs,transaction_replie_order}=require('./msgverification_hardrules')
const message_softRules=require('./msgverification_softrules')
const {summary_hardrules}= require('./summary_rules')
var events = require('events');
const Sorting=require('../largeSteps/sortChunks')
const sortDeleteMergeChunks=require('../largeSteps/mergeChunks')
const cleanUpTempFiles = require('../largeSteps/clean');
const mergingFiles= require('../largeSteps/order_merge');
const {aposteriori_SOFTRULES,splitByData}= require('./SOFT_on_chunks')
const path = require('path');
const os = require('os');
const applie_standardDev =require('./standard_dev');



class Rules{
    constructor(streaming){
        this.streaming=streaming


    }
    applie_msgHardRules(msg){return message_hardRules(msg) }// we need these methods seperated for the judge
    applie_msgSoftRules(msg){return message_softRules(msg.Data) }
    
    message_rules(message){ // a_priori_rules : rules applied on the messages (msg by msg)
        let hardRules_message_verification= this.applie_msgHardRules(message)
       // let softRules_message_verification= this.applie_msgSoftRules(message)
       let softRules_message_verification =(this.streaming == false && message.Data != undefined) ? this.applie_msgSoftRules(message): true;
        if(hardRules_message_verification == true && softRules_message_verification == true){
            return true
        }else{return false}
    }
    applieCorrectOrderRule(log){return correct_order(log);}
    applieDeleteRepeated_msgs(log){return delete_repeated_msgs(log);}
    async applieTransactionReplieOrder(log1,log2,machineIDS){
        var result = await transaction_replie_order(log1,log2,machineIDS)
        return result
    }


   /* file_rules(transaction_log, replie_log){ // a_posteriori_rules: rules applied on the hole file  
        let transaction_log_ordered=this.applieCorrectOrderRule(transaction_log);
        let replie_log_ordered = this.applieCorrectOrderRule(replie_log);
        let transaction_array_after_delete = this.applieDeleteRepeated_msgs(transaction_log_ordered);
        let replie_array_after_delete = this.applieDeleteRepeated_msgs(replie_log_ordered);
        let trans_replie_log= this.applieTransactionReplieOrder(transaction_array_after_delete,replie_array_after_delete)
        return trans_replie_log

    }*/
    applie_summary_hardrules(array,summary_file){ // takes the array to see if there was a tampering process
        return summary_hardrules(array,summary_file)
    }
    largeFile_Rules(trans_file, ACK_file,tempDir,SecondProcess_eventEmitter,masterFile,machineIDS){ //APOSTERRIORI RULES
        let eventEmitter= new events.EventEmitter()
        var ChunkedAndSorted_ended=0;
        eventEmitter.on('ChunkedAndSorted',()=>{
            ChunkedAndSorted_ended++
            if(ChunkedAndSorted_ended ==2){ // both transaction and Ack files are sorted
                let sortDeleteMergeChunks_ended=0
                eventEmitter.on('ChunksSorted_duplicatesRemoved_Merged', ()=>{
                    sortDeleteMergeChunks_ended++ 
                    if(sortDeleteMergeChunks_ended ==2 ){
                        //merging both files together the transaction and the ACK in order
                        /* false && console.log('merging both files together the transaction and the ACK in order') */
                        cleanUpTempFiles(tempDir)
                        mergingFiles('trans.txt','ACK.txt',masterFile.path,eventEmitter, masterFile.name+'merged_transaction_tmp', masterFile.name+'merged_ACK_tmp',machineIDS)
                        eventEmitter.on('mergingTransAckDone',()=>{
                            //SecondProcess_eventEmitter.emit('WritingDataISdone',masterFile)
                           if(this.streaming == true){
                            SecondProcess_eventEmitter.emit('WritingDataISdone', masterFile)
                           }else{
                               this.applie_aposteriori_SOFTRULES(masterFile,SecondProcess_eventEmitter,machineIDS)
                           }
                           
                        })
                    }
                })
                sortDeleteMergeChunks('trans.txt', masterFile.name+'transaction_tmp',masterFile.name+'merged_transaction_tmp',eventEmitter)
                sortDeleteMergeChunks('ACK.txt',masterFile.name+'ACK_tmp', masterFile.name+'merged_ACK_tmp',eventEmitter)
                

            }
            
        })

        Sorting(trans_file, masterFile.name+'transaction_tmp',eventEmitter )
        Sorting(ACK_file,  masterFile.name+'ACK_tmp',eventEmitter )
    }
    applie_aposteriori_SOFTRULES(masterFile,SecondProcess_eventEmitter,machineIDS){ //second Process soft rules
        let eventEmitter= new events.EventEmitter()
        eventEmitter.on('ChunkedAndSorted',()=>{
            eventEmitter.on('RulesApplied', (Dirname)=>{
                eventEmitter.on('ChunksSorted_duplicatesRemoved_Merged',async (outputFile_dirname)=>{
                    var tempDir=path.join(os.tmpdir(), outputFile_dirname)
                    var dirname =tempDir+'/'+masterFile.name+'.txt'
                    eventEmitter.on('FileCopied' ,()=>{
                         cleanUpTempFiles(tempDir)
                         SecondProcess_eventEmitter.emit('WritingDataISdone', masterFile)

                    })
                   await masterFile.copyTempFile(dirname, eventEmitter)
                  
                })
                 sortDeleteMergeChunks(masterFile.name+'.txt',Dirname,'tmp_SoftRules'+masterFile.name,eventEmitter)
                });
            aposteriori_SOFTRULES(masterFile.name+'SoftRules',eventEmitter,machineIDS)
        })
        Sorting(masterFile.path, masterFile.name+'SoftRules',eventEmitter )

    }
    async start_SoftRules(lines,machineIDS,judge_eventemitter,eventEmitter){ //3rd process softrules
        if(this.streaming == false){
            var chuncking_lines=  await splitByData(lines)
            var process_eventEmitter = new events.EventEmitter()
            process_eventEmitter.on('StandardDevExamDone',(ordered_array)=>{
                judge_eventemitter.emit('StandardDevExamDone', ([ordered_array,eventEmitter]))
              })
             applie_standardDev(chuncking_lines,process_eventEmitter,machineIDS)
        }else {
            judge_eventemitter.emit('StandardDevExamDone', ([lines,eventEmitter]))

        }
            
    }

}
module.exports= Rules
