function preview_value(value, max = 120){
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    if(str == undefined){return 'undefined'}
    if(str.length <= max){return str}
    return str.slice(0,max) + '...'
}

function log_sent_transaction(remoteId, wireTransaction, qkdSecurity){
    const label = qkdSecurity != undefined ? '[QKD][SEND][transaction]' : '[SEND][transaction]'
    // console.log(label, 'to=', remoteId, 'payload=', wireTransaction)
}

function sendReplierToReplier(message , Requesters_log,path,eventEmitter,requesterID,qkdSecurity){ // sending the Replie to every actor other than the Requester
    /* false && console.log('[FLOW][sendReplierToReplier] path=',path,' requesterID=',requesterID,' targets=',Requesters_log.length); */ 
    Requesters_log.forEach(requester =>{
      if(requester.replier_name != requesterID){
        const wire_message =
          qkdSecurity != undefined
            ? qkdSecurity.wrapMessage(requester.replier_name, message)
            : message
        /* false && console.log('[FLOW][sendReplierToReplier] sending to', requester.replier_name,'payloadPreview=',preview_value(message)); */ 
        requester.send_requests(path,wire_message,eventEmitter,{remoteId: requester.replier_name})
      }
    })
  
  
  }
  
function sendReq(message , Requesters_log,path,eventEmitter){ // send requests
      /* false && console.log('[FLOW][sendReq] path=',path,' targets=',Requesters_log.length,' payloadPreview=',preview_value(message)); */ 
      Requesters_log.forEach(requester => {
          requester.send_requests(path,message,eventEmitter)        
      });
  }
function sendGETLargeData(Requesters_log,path,clientOFlargeData,file_name,largeDataPort){ // sernd requests
    /* false && console.log('[FLOW][sendGETLargeData] path=',path,' file=',file_name,' targets=',Requesters_log.length); */ 
    Requesters_log.forEach(requester => {
        clientOFlargeData.send_getlargeData(requester.replierIP,largeDataPort,path,file_name+ requester.replier_name)
    });
}
function build_transaction_wrapper(transaction_string){
    return JSON.stringify({
        transaction: JSON.parse(transaction_string)
    })
}
function extract_payload(data){
    /* false && console.log('[FLOW][extract_payload] incomingType=',typeof data,' isBuffer=',Buffer.isBuffer(data)); */ 
    if(data != undefined && typeof data === 'object' && Buffer.isBuffer(data) == false){
        const payload = data.payload ?? data.data ?? data.Data
        /* false && console.log('[FLOW][extract_payload] objectInput hasPayload=',payload != undefined); */ 
        if(payload != undefined){
            return (typeof payload === 'string') ? payload : JSON.stringify(payload)
        }
        return JSON.stringify(data)
    }

    const data_as_string = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
    try{
        const parsed = JSON.parse(data_as_string)
        if(parsed != undefined && typeof parsed === 'object' && Array.isArray(parsed) == false){
            const payload = parsed.payload ?? parsed.data ?? parsed.Data
            /* false && console.log('[FLOW][extract_payload] jsonStringInput hasPayload=',payload != undefined); */ 
            if(payload != undefined){
                return (typeof payload === 'string') ? payload : JSON.stringify(payload)
            }
        }
    }catch(error){
    }
    return data_as_string
}
function continueTOappend( bool_result,msg,true_function,file,name){ // function that append to the file in case of all rules are fulfilled
    /* false && console.log('[FLOW][continueTOappend] label=',name,' rulesOk=',bool_result,' signatureOk=',true_function,' msgPreview=',preview_value(msg)); */ 
    if(bool_result == true){
        var true_function_result =true_function
        //file.append_to_file(title, msg,true_function_result) //if the result is true append the transaction to the file
       file.append_to_file( msg,true_function_result,name) 
    }


}

var Transaction_EventHandler = function (Replie_created,transactionhash,res,Rules_object,signature_validator_ACK,file,response_payload) {  //function that  continue working on the requester transaction 
    /* false && console.log('[FLOW][Transaction_EventHandler] responding ACK transactionHash=',transactionhash,' ackPreview=',preview_value(Replie_created)); */ 
    res.send(response_payload != undefined ? response_payload : Replie_created)
    let replie_result = Rules_object.message_rules(JSON.parse(Replie_created)) // eventual concictency for the ACK
    continueTOappend( replie_result,Replie_created,signature_validator_ACK.validateSignature(JSON.parse(Replie_created),'ACK',transactionhash),file,'ACK: ')
   }

var ACK_EventHandler = function (data,Rules_object,file,signature_validator_ACK,transaction_hash) {  //function that continue working on the replier ACK  
    /* false && console.log('[FLOW][ACK_EventHandler] transactionHash=',transaction_hash,' ackPreview=',preview_value(data)); */ 
    let replie_result = Rules_object.message_rules(JSON.parse(data)) // eventual concictency for the ACK
    continueTOappend( replie_result,data,signature_validator_ACK.validateSignature(JSON.parse(data),'ACK',transaction_hash),file,'ACK: ')
   
}

function create_sendtransaction(file,Requester_eventEmitter,Requesters_log,transaction_creator,data,Rules_object,Signature_Validator,qkdSecurity){ //function that create the transaction out of the local data actor, send it too the replier
    var time = Date.now()
    let transaction
    /* false && console.log('[FLOW][create_sendtransaction] localDataPreview=',preview_value(data),' requesterTargets=',Requesters_log.length); */ 
    try{
        const payload = extract_payload(data)
        /* false && console.log('[FLOW][create_sendtransaction] extracted payloadLen=',String(payload).length); */ 
        transaction= transaction_creator.transaction(time,payload)
    }catch(error){
        /* false && console.log('[FLOW][create_sendtransaction] payload processing failed:', error.message); */ 
        return
    }
    let transaction_object = JSON.parse(transaction)
    let transaction_result= Rules_object.message_rules(transaction_object)
    /* false && console.log('[FLOW][create_sendtransaction] transactionCreated preview=',preview_value(transaction)); */ 
    
    Requesters_log.forEach(requester => {
       const wire_transaction =
         qkdSecurity != undefined
           ? qkdSecurity.wrapMessage(requester.replier_name, transaction)
           : build_transaction_wrapper(transaction)
       /* false && console.log('[FLOW][create_sendtransaction] sending to replier=',requester.replier_name,' ip=',requester.replierIP,' port=',requester.port); */ 
       Requester_eventEmitter.emit('TRACK_TRANSACTION', {
        transaction,
        remoteId: requester.replier_name
       })
       log_sent_transaction(requester.replier_name, wire_transaction, qkdSecurity)
       requester.send_requests('transaction',wire_transaction,Requester_eventEmitter,{
        transaction,
        remoteId: requester.replier_name
       })
    });
    setImmediate(() => {
        continueTOappend(transaction_result,transaction,true,file,'Transaction: ')
    })
    
       
}

          
   
module.exports ={sendReq,continueTOappend,Transaction_EventHandler,ACK_EventHandler,create_sendtransaction,sendGETLargeData,sendReplierToReplier}
