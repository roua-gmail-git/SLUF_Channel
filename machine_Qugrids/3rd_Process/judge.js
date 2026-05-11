const crypto= require('crypto')
var events = require('events');
const path = require('path');
const os = require('os');
var Sorting= require('../largeSteps/sortChunks')
var applyRulesONchunks = require('./applieRules')
var sortDeleteMergeChunks= require('../largeSteps/mergeChunks')
let {hashingFile} =require('./Hash')
const cleanUpTempFiles= require('../largeSteps/clean');
const { signaturePayloadValue } = require('../payload_codec');
/**
 * @brief Judge
 *
 * 
 */

class Judge{
    constructor(metadatahash,machineIDS,rules,Judge_main_evenEmitter,myID ,transaction_creator,metadataFile_log,Signature_Validator,create_public_key){
        this.machineIDS=machineIDS
        this.MetadataHash=metadatahash
        this.Judge_main_evenEmitter=Judge_main_evenEmitter
        this.Judge_evenEmitter= new events.EventEmitter()
        this.events()
        this.rules= rules
        this.myID=myID           
        this.transaction_creator=transaction_creator
        this.metadataFile_log=metadataFile_log // log containing metadata infos of all machines
        this.Signature_Validator_class=Signature_Validator   //signature validator class
        this.create_public_key_function=create_public_key    //function to create prublic key
        this.myfilehash //filehash created after calling the judge 
        this.repliers_filehashes=[] //array to collect the repliers fileshashes in
        this.auditor_file
        this.summary_file
    }
    collect_filehashes(replier_filehash, numberofrepliers){ //wil be executed only in the requester side to collect fileshes and save them in the array
        this.repliers_filehashes.push(replier_filehash)
        if(this.repliers_filehashes.length == numberofrepliers){
           // false && console.log(this.repliers_filehashes)
             this.Judge_main_evenEmitter.emit('JUDGE_FilehashCollectISdone',this.repliers_filehashes)
             this.repliers_filehashes=[] //re-intialisation
        }

    }
    applie_SignatureValidator(file_content){ // applie signature validator on the messages  and save errors to be written in the summary file
        var [transacion_array,ACK_array]= this.split_array(file_content) 
        var [trans_log_validated, trans_log_errors] = this.validate_sig_transacions(transacion_array)
        var [ACK_log_validated, ACK_log_errors] = this.validate_sig_ACK(ACK_array,transacion_array)
        var combined_error_arrays=[...trans_log_errors,...ACK_log_errors]
        this.append_errors_to_File( combined_error_arrays,'Signature_errors: ')
        return [trans_log_validated,ACK_log_validated]
    }
    validate_sig_ACK(ACK_array,transacion_array){ // applie signature validator on the ACK message 
        var ACK_result_array=[]
        var ACK_log_errors=[]
        ACK_array.forEach(element => {
                var corresponding_dataActor = this.metadataFile_log.find(dataActor => dataActor.ID === element.Replier); // search for the corresponding metadata input
                var dataActor_publickey = this.create_public_key_function(corresponding_dataActor.PublicKey) 
                var sig_val= new this.Signature_Validator_class(dataActor_publickey)
                let TransactionHash = element.TransactionHash == undefined ? this.transactionHash_creator(element,transacion_array) : element.TransactionHash
                var ACK_result= sig_val.validateSignature(element , 'JudgeACK',TransactionHash)
                this.TRUE_PUSH(ACK_result_array,ACK_result,element,ACK_log_errors) //if true push in ACK_result_array otherwise in errors array 
                
        });
        return [ACK_result_array,ACK_log_errors]

    }
    transactionHash_creator(ack, transacion_array){
        let corresponding_transaction = transacion_array.find(
            (transacion_array) => transacion_array.Timestamp === ack.Timestamp && transacion_array.Requester === ack.Requester
          );
        let build_string =  corresponding_transaction.Requester+corresponding_transaction.Timestamp+signaturePayloadValue(corresponding_transaction)
        let transactionhash = crypto.createHash('sha256').update(build_string).digest('hex');
        return transactionhash  

    }
    validate_sig_transacions(transacion_array){ // applie signature validator on the transaction message 
        var trans_log_errors=[]
        var trans_result_array=[]
        transacion_array.forEach(element => {
                var corresponding_dataActor = this.metadataFile_log.find(dataActor => dataActor.ID === element.Requester);// search for the corresponding metadata input
                var dataActor_publickey = this.create_public_key_function(corresponding_dataActor.PublicKey)
                var sig_val= new this.Signature_Validator_class(dataActor_publickey)
                var trans_result= sig_val.validateSignature(element , 'JudgeTransaction',this.MetadataHash)
                this.TRUE_PUSH(trans_result_array,trans_result,element,trans_log_errors)//if true push in trans_result_array otherwise in errors array 
            });
        return [trans_result_array,trans_log_errors]
    }    
    TRUE_PUSH(array,result,element,errors_array){ //help function 
        if(result == true){array.push(element)}
        else if(result== false){errors_array.push(element)}

    }    
    split_array(file_content){ // split filedata into transactions and ACKs
        var transactions_array=[];var ACK_array=[]
        file_content.forEach(element => {
            if(element.Replier == undefined){
                transactions_array.push(element)
            }else{ACK_array.push(element)}
        });
        
        return [transactions_array,ACK_array]
    }
    APRIORI_RULES(fileArray){
        var array_result=[]
        var Timestamp_errors_array=[]
        fileArray.forEach(line => {
            var result = this.rules.message_rules(line)
            this.TRUE_PUSH(array_result,result,line,Timestamp_errors_array)
        });
        return [array_result,Timestamp_errors_array]
    }
    applie_APRIORI_RULES(fileArray){
        var [array_result,Timestamp_errors_array]= this.APRIORI_RULES(fileArray)
        this.append_errors_to_File( Timestamp_errors_array,'Timestamp_errors: ')
        return array_result
    }
    applie_APOSTERIORI_HardRules(masterFileContent){
        let masterFileContent_ordered = this.rules.applieCorrectOrderRule(masterFileContent);// order the transactions based on the timestamp
        let masterFileContent_after_delete = this.rules.applieDeleteRepeated_msgs(masterFileContent_ordered);// delete the repeated transactions
        return masterFileContent_after_delete
    }
    
    append_errors_to_File( array,title){ // append errors to the summaryfile
        if(array.length != 0){
            this.summary_file.append_to_file('\n'+title+'\n' )
            let data= array.map(item => JSON.stringify(item)).join('\n');
            this.summary_file.append_to_file( data )}
    }


    CallAuditor(file,auditor_file,summary_file){ // start auditor process
       this.myfilehash= undefined //initialisation
       this.summary_file= summary_file
       this.auditor_file= auditor_file
       Sorting(file.path, 'fileChunks_'+file.name ,this.Judge_evenEmitter)
    }
    async applie_APOSTERIORI_SoftRules(lines,eventEmitter){
        this.rules.start_SoftRules(lines,this.machineIDS,this.Judge_evenEmitter,eventEmitter) 
    }
    async AllRules(lines){
        var masterFileContent = lines.map(element=>JSON.parse(element))
         var masterFile_APOST_HR = this.applie_APOSTERIORI_HardRules(masterFileContent)// applie aposteriori_HR on the mergedFile
       //var [masterFile_APRIORI] = this.applie_APRIORI_RULES(masterFile_APOST_HR,this.summary_file)// applie applie_APRIORI_RULES on the mergedFile
      var [masterFile_APRIORI] =[masterFile_APOST_HR ] //testing
        var[SigValidated_trans_array,SigValidated_ACK_array]= this.applie_SignatureValidator(masterFile_APRIORI) // validate signature of the messages
      //var[SigValidated_trans_array,SigValidated_ACK_array]=  this.split_array(masterFile_APRIORI) 
        var Request_Tampering= this.machineIDS.length >2 ? this.rules.applie_summary_hardrules(SigValidated_trans_array,this.summary_file) : false; //control if there is a tampering issues in the transactions
        var Replie_Tampering = this.machineIDS.length > 2 ? this.rules.applie_summary_hardrules(SigValidated_ACK_array,this.summary_file): false; //control if there is a tampering issues in the replies
        if(Replie_Tampering == true || Request_Tampering == true){ 
            /* false && console.log('**************************TAMPERING DETECTED******************************+') */
        }
        var trans_ACK_array = await this.rules.applieTransactionReplieOrder(SigValidated_trans_array,SigValidated_ACK_array,this.machineIDS) //ordering the array 
        return trans_ACK_array
    }    
    
    events(){
        
        this.Judge_evenEmitter.on('FileCopied',(tmpfile)=>{
           let tempDir =path.basename(path.dirname(tmpfile));
           cleanUpTempFiles(tempDir)
           hashingFile(this.auditor_file, this.Judge_evenEmitter, 'JudgeFileHash')

        })
        this.Judge_evenEmitter.on('StandardDevExamDone',([ordered_array,eventEmitter])=>{
            eventEmitter.emit('start_Writing',(ordered_array))

        })
        this.Judge_evenEmitter.on('JudgeFileHash',(file_Hash)=>{
            this.myfilehash= file_Hash
            this.Judge_main_evenEmitter.emit('Auditor_fileHash', (file_Hash));            
            /* false && console.log('Judge : ' , file_Hash, this.auditor_file.name) */
        })
        this.Judge_evenEmitter.on('ChunksSorted_duplicatesRemoved_Merged',async (outputFile_dirname)=>{
            var tempDir=path.join(os.tmpdir(), outputFile_dirname)
            var dirname =tempDir+'/'+this.auditor_file.name+'.txt'
           await this.auditor_file.copyTempFile(dirname,this.Judge_evenEmitter)
           
        })

        this.Judge_evenEmitter.on('RulesApplied',(Dirname)=>{
            sortDeleteMergeChunks(this.auditor_file.name+'.txt',Dirname,'tmp_auditorFile'+this.auditor_file.name,this.Judge_evenEmitter)
        })
        this.Judge_evenEmitter.on('ChunkedAndSorted',(ChunksDir)=>{
            applyRulesONchunks(ChunksDir,this)
        })
        
    }
}

module.exports= Judge
