
const {sendReq}= require('./help_functions')


function handling_auditor_events(external_judge,judge_object,Requester_eventEmitter,Requesters_log,processFiles,judge_eventEmitter){
    judge_eventEmitter.on('START_JUDGE',(mergedFilePath)=>{       
        judge_object.CallAuditor(mergedFilePath,processFiles.auditorFile,processFiles.summaryFile)
    })
    handling_auditor_Requester_events(judge_eventEmitter,Requester_eventEmitter,Requesters_log,judge_object,external_judge)    
}
function handling_auditor_Requester_events(judge_eventEmitter,Requester_eventEmitter,Requesters_log,judge_object,external_judge){
    judge_eventEmitter.on('Auditor_fileHash', (file_hash)=>{
        var fileHash_message= JSON.stringify({fileHash: file_hash})
        sendReq(fileHash_message, Requesters_log, 'auditor_Filehash',Requester_eventEmitter)
    })

  
    judge_eventEmitter.on('JUDGE_FilehashCollectISdone',(repliers_filehashes)=>{
        let timer = setInterval(() => {
            if( judge_object.myfilehash!= undefined){
                clearInterval(timer)
                let allEqual = repliers_filehashes.every(item => item === judge_object.myfilehash);
                //let allEqual =false //testing
                if(allEqual==false){
                    /* false && console.log('\ncalling external Judge \n') */
                  //  external_judge.send_largeData(judge_object.auditor_file,'')    
                    //external_judge.send_largeData(judge_object.summary_file,'summary')
        
                }else{
                    /* false && console.log('********Internal Judge Process was successful*********') */
                    judge_object.auditor_file.closeFiles('./Files/Closed/masterFiles/','./Files/Closed/fileHashes/', judge_object.myfilehash,judge_object.MetadataHash)
                }

                
            }
        }, 100);

    })

}
function handling_auditor_Replier_events(Replier_eventEmitter,judge_object,Requesters_log){
    Replier_eventEmitter.on('auditor_Filehash',(recieved_data)=>{
        var replier_filehash= recieved_data.fileHash
        judge_object.collect_filehashes(replier_filehash, Requesters_log.length)
    })
    /*Replier_eventEmitter.on('Start_external_Auditor',()=>{
        false && console.log('\ncalling external Judge Replier \n')
       // external_judge.send_largeData(judge_object.auditor_file,'') 
      //  external_judge.send_largeData(judge_object.summary_file,'summary')

    })*/
}



module.exports={handling_auditor_events,handling_auditor_Replier_events}