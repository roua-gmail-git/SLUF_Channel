
const {continueTOappend,sendReq,sendGETLargeData}= require('./help_functions')
const mergingFiles=require('../../3rd_Process/merging')
const WorkerTaskClient = require('./worker_task_client');
const {
    decodeMessagePayload,
    normalizeLocalPayload,
} = require('../../payload_codec');

function preview_value(value, max = 120){
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    if(str == undefined){return 'undefined'}
    if(str.length <= max){return str}
    return str.slice(0,max) + '...'
}

function unwrap_qkd_message(qkdSecurity, data, remoteId){
    if(qkdSecurity == undefined){
        return data
    }
    try{
        return qkdSecurity.unwrapMessage(data, remoteId)
    }catch(error){
        console.error('qkd ACK unwrap error:', error.message)
        return undefined
    }
}

function log_sent_transaction(remoteId, wireTransaction, qkdSecurity){
    const label = qkdSecurity != undefined ? '[QKD][SEND][transaction]' : '[SEND][transaction]'
    // console.log(label, 'to=', remoteId, 'payload=', wireTransaction)
}

function extract_transaction(data){
    if(data != undefined && typeof data === 'object' && data.transaction != undefined){
        return (typeof data.transaction === 'string') ? JSON.parse(data.transaction) : data.transaction
    }
    if(data != undefined && typeof data === 'object'){
        return data
    }
    if(typeof data === 'string'){
        try{
            const parsed = JSON.parse(data)
            if(parsed != undefined && typeof parsed === 'object' && parsed.transaction != undefined){
                return (typeof parsed.transaction === 'string') ? JSON.parse(parsed.transaction) : parsed.transaction
            }
            if(parsed != undefined && typeof parsed === 'object'){
                return parsed
            }
        }catch(error){
            // false && console.log('[REQ][extract_transaction_and_keyid] json parse failed:', error.message); 
        }
    }
    throw new Error('Unable to parse transaction message')
}

function handling_requester_events(LocalActorConnection,Requesters_log,Requester_eventEmitter,transaction_creator,Rules_object,processFiles,Signature_Validator,metadatahash,qkdSecurity){ //when a replie comes
    const pending_transactions_by_hash = new Map()
    const pending_transactions_by_timestamp = new Map()
    const replier_public_keys_by_id = {}
    Requesters_log.forEach((requester) => {
        replier_public_keys_by_id[requester.replier_name] = requester.replier_publicKey.export({
            format: 'pem',
            type: 'spki'
        })
    })
    const ack_processor = new WorkerTaskClient('ack_processor_worker.js', {
        streaming: Rules_object.streaming,
        requestersCount: Requesters_log.length,
        replierPublicKeysById: replier_public_keys_by_id,
        qkdEnabled: qkdSecurity != undefined,
        localMachineId: transaction_creator.senderID
    }, {
        poolSize: WorkerTaskClient.resolvePoolSize('MACHINE_QUGRIDS_ACK_WORKERS')
    })
    Requester_eventEmitter.on('TRACK_TRANSACTION', ({transaction, remoteId}) => {
        let parsed_transaction
        try{
            parsed_transaction = extract_transaction(transaction)
        }catch(error){
            return
        }
        const transaction_hash = transaction_creator.transaction_hash(parsed_transaction)
        const timestamp_key = String(remoteId ?? 'unknown') + ':' + String(parsed_transaction.Timestamp ?? 'unknown')
        const pending_transaction = {
            transaction,
            remoteId,
            transactionHash: transaction_hash,
            timestampKey: timestamp_key,
            payloadForLocalActor: decodeMessagePayload(parsed_transaction)
        }
        pending_transactions_by_hash.set(transaction_hash, pending_transaction)
        pending_transactions_by_timestamp.set(timestamp_key, pending_transaction)
    })

    Requester_eventEmitter.on('ASYNC_ACK_data', ({rawData, sourceIp, sourcePort}) => {
        const normalized_source_ip =
            typeof sourceIp === 'string' && sourceIp.startsWith('::ffff:')
                ? sourceIp.slice(7)
                : sourceIp
        const corresponding_requester = Requesters_log.find(requester => requester.replierIP === normalized_source_ip)
        const remoteId = corresponding_requester != undefined ? corresponding_requester.replier_name : undefined
        const decoded_wire_data = unwrap_qkd_message(qkdSecurity, rawData, remoteId)
        if(decoded_wire_data == undefined){
            return
        }
        ack_processor.run('decode_ack', { rawData: decoded_wire_data, remoteId })
            .then((decoded_ack) => {
                const ack_object = decoded_ack?.ackObject
                if(ack_object == undefined){
                    return
                }
                let pending_transaction
                if(ack_object.TransactionHash != undefined){
                    pending_transaction = pending_transactions_by_hash.get(ack_object.TransactionHash)
                }
                if(pending_transaction == undefined){
                    pending_transaction = pending_transactions_by_timestamp.get(
                        String(ack_object.Replier ?? remoteId ?? 'unknown') + ':' + String(ack_object.Timestamp ?? 'unknown')
                    )
                }
                if(pending_transaction == undefined){
                    return
                }
                if(pending_transaction.transactionHash != undefined){
                    pending_transactions_by_hash.delete(pending_transaction.transactionHash)
                }
                if(pending_transaction.timestampKey != undefined){
                    pending_transactions_by_timestamp.delete(pending_transaction.timestampKey)
                }
                Requester_eventEmitter.emit('ACK_data',([
                    decoded_ack.ackObject,
                    {
                        transaction: pending_transaction.transaction,
                        transactionHash: pending_transaction.transactionHash,
                        payloadForLocalActor: pending_transaction.payloadForLocalActor,
                        remoteId: pending_transaction.remoteId
                    },
                    {
                        statusCode: 202,
                        contentType: 'application/json',
                        path: 'ACK',
                        target: (normalized_source_ip ?? 'unknown') + ':' + (sourcePort ?? 'unknown')
                    }
                ]))
            })
            .catch((error) => {
                console.error('ack decode worker error:', error.message)
            })
    })

    Requester_eventEmitter.on('ACK_data',([recieved_data,transaction,responseMeta])=>{
        ack_processor.run('process_ack', { recieved_data, transaction })
            .then((result) => {
                if(result == undefined || result.ignored === true){
                    return
                }
                const ack_rules_ok = Rules_object.message_rules(JSON.parse(result.ackString))
                if(ack_rules_ok === true && result.ackSignatureOk === true){
                    const payload_for_local_actor = normalizeLocalPayload(result.payloadForLocalActor)
                    if(payload_for_local_actor != undefined){
                        // LocalActorConnection.localsocket.write(payload_for_local_actor);
                    }
                }
                setImmediate(() => {
                    continueTOappend(
                        ack_rules_ok,
                        result.ackString,
                        result.ackSignatureOk,
                        processFiles.masterfile_under_modifications,
                        'ACK: '
                    )
                })
            })
            .catch((error) => {
                console.error('ack processor worker error:', error.message)
            })
    })
}


function handling_localactor_events(end_event,Requester_eventEmitter,transaction_creator,processFiles,Requesters_log,Rules_object,Signature_Validator,qkdSecurity){ // when a data comes from the local actor
    const pending_local_frames = []
    let in_flight_local_frames = 0
    const outgoing_transaction_processor = new WorkerTaskClient('outgoing_transaction_worker.js', {
        senderId: transaction_creator.senderID,
        senderPrivateKeyPem: transaction_creator.senderkey.export({
            format: 'pem',
            type: 'pkcs8'
        }),
        metadataHash: transaction_creator.metadataHash,
        streaming: Rules_object.streaming,
        qkdEnabled: qkdSecurity != undefined
    }, {
        poolSize: WorkerTaskClient.resolvePoolSize('MACHINE_QUGRIDS_OUTGOING_TX_WORKERS')
    })
    const max_parallel_local_frames = outgoing_transaction_processor.pool_size
    const drain_local_frames = () => {
        while(in_flight_local_frames < max_parallel_local_frames && pending_local_frames.length > 0){
            in_flight_local_frames++
            const pending_frame = pending_local_frames.shift()
            setImmediate(() => {
                outgoing_transaction_processor.run('process_outgoing_transaction', {
                    data: pending_frame.data,
                    remoteIds: Requesters_log.map((requester) => requester.replier_name)
                }).then((result) => {
                    if (result == undefined) {
                        return
                    }
                    Requesters_log.forEach((requester) => {
                        const wire = result.wires.find((item) => item.remoteId === requester.replier_name)
                        if (wire == undefined) {
                            return
                        }
                        Requester_eventEmitter.emit('TRACK_TRANSACTION', {
                            transaction: result.transaction,
                            remoteId: requester.replier_name
                        })
                        const wire_transaction =
                            qkdSecurity != undefined
                                ? qkdSecurity.wrapMessage(requester.replier_name, wire.wireTransaction)
                                : wire.wireTransaction
                        log_sent_transaction(requester.replier_name, wire_transaction, qkdSecurity)
                        requester.send_requests('transaction', wire_transaction, Requester_eventEmitter, {
                            transaction: result.transaction,
                            remoteId: requester.replier_name
                        })
                    })
                    setImmediate(() => {
                        continueTOappend(true,result.transaction,true,processFiles.masterfile_under_modifications,'Transaction: ')
                    })
                    end_event.transaction_counter++
                }).catch((error) => {
                    console.error('outgoing transaction worker error:', error.message)
                }).finally(() => {
                    in_flight_local_frames--
                    if(pending_local_frames.length > 0){
                        drain_local_frames()
                    }
                })
            })
        }
    }
    
    setInterval(() => {
       /* if(end_event.applie_Rule(processFiles.masterfile_under_modifications)== true ){  // end event not reached yet 
            end_event.starting_date_ms = Date.now() 
           processFiles.create_masterfile_under_modifications() // create a new file 
            
        }*/
           end_event.applie_Rule(processFiles.masterfile_under_modifications)
        
    }, 100);
  
  
    Requester_eventEmitter.on('LocalActor_data', (data)=>{ //when the local actor sends data
       // false && console.log('[REQ][LocalActor_data] incoming payloadPreview=',preview_value(data)); 
       pending_local_frames.push({
           data
       })
       drain_local_frames()
    })
}

function handling_END_events(end_event,Requester_eventEmitter,processFiles,Second_Process,Requesters_log){ // end event
    Requester_eventEmitter.on('END', (ended_masterFile)=>{
        end_event.starting_date_ms = Date.now() 
        end_event.transaction_counter=0
        processFiles.create_masterfile_under_modifications() // create a new file 
        // false && console.log('**********EndProcess Began********** ',ended_masterFile.name); 
        sendReq('', Requesters_log, 'END',Requester_eventEmitter)
       setTimeout(() => { //to just recieve the last ack of the others 
        processFiles.create_masterfile_after_END() //the file is going to be in Ended folder
        Second_Process.rules_process(ended_masterFile,processFiles.masterfile_after_END)
       }, 5);
    })
}

function handling_FileHash_events(judge_eventEmitter,largeDataPort,processFiles,clientOFlargeData,Requester_eventEmitter,Requesters_log,SecondProcess){ //events after the end event
    Requester_eventEmitter.on('FileHashCreated', (file_hash)=>{
        var fileHash_message= JSON.stringify({fileHash: file_hash})
        sendReq(fileHash_message, Requesters_log, 'Requester_Filehash',Requester_eventEmitter)
    })  
    Requester_eventEmitter.on('FilehashCollectISdone',(repliers_filehashes_array)=>{
        let timer= setInterval(() => {
            if(SecondProcess.fileHash != undefined){
                clearInterval(timer)
                let allEqual = repliers_filehashes_array.every(item => item === SecondProcess.fileHash)
                //let allEqual =false //testing
                if(allEqual==true){// copy the file to the closed folder
                    SecondProcess.master_file.closeFiles('./Files/Closed/masterFiles/','./Files/Closed/fileHashes/', SecondProcess.fileHash,SecondProcess.metadataHash)
                    // false && console.log('********Normal process was successful ********'); 
             }else{// start internal Judge
                 //processFiles.DataFile_array=[] //reinitialisation for the new process
                processFiles.create_mergedFile()
                sendGETLargeData(Requesters_log,'SendFileData',clientOFlargeData,processFiles.masterfile_after_END.name,largeDataPort)
             }
            }
            
        }, 100);
        
         
     })  
    
    Requester_eventEmitter.on('Got_fileData',(file_path)=>{
        SecondProcess.collect_filedata(Requesters_log.length,file_path)
    })



    Requester_eventEmitter.on('FileDataCollectISdone',(filePaths_array)=>{
        //start merging the files
        mergingFiles(processFiles.mergedFile ,Requester_eventEmitter,filePaths_array,SecondProcess.master_file)

    })
    Requester_eventEmitter.on('mergingISdone',async (mergedFile)=>{
        processFiles.create_auditor_summaryFiles()
        judge_eventEmitter.emit('START_JUDGE',mergedFile)

    })


}

module.exports= {handling_requester_events,handling_localactor_events,handling_END_events,handling_FileHash_events}
