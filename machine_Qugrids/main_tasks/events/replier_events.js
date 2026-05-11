
const {continueTOappend,sendReplierToReplier} = require('./help_functions');
const WorkerTaskClient = require('./worker_task_client');
const { normalizeLocalPayload } = require('../../payload_codec');

function preview_value(value, max = 120){
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    if(str == undefined){return 'undefined'}
    if(str.length <= max){return str}
    return str.slice(0,max) + '...'
}

function unwrap_qkd_message(qkdSecurity, data, remoteId, label){
    if(qkdSecurity == undefined){
        return data
    }
    try{
        return qkdSecurity.unwrapMessage(data, remoteId)
    }catch(error){
        console.error('qkd ' + label + ' unwrap error:', error.message)
        return undefined
    }
}
function payload_to_string(payload){
    const normalized_payload = normalizeLocalPayload(payload)
    if(normalized_payload == undefined){
        return ''
    }
    if(Buffer.isBuffer(normalized_payload)){
        return normalized_payload.toString('utf8')
    }
    return normalized_payload
}

function write_back_to_local_actor(local_socket, payload){
    if(local_socket == undefined){
        // false && console.log('[REP][transaction_data] local actor socket is undefined'); 
        return
    }
    const normalized_payload = normalizeLocalPayload(payload)
    if(normalized_payload == undefined){
        return
    }
    if(Buffer.isBuffer(normalized_payload)){
        local_socket.write(normalized_payload)
        return
    }
    local_socket.write(Buffer.from(normalized_payload, 'utf8'))
}

function transaction_is_valid(result){
    return result?.transactionRulesOk === true && result?.transactionSignatureOk === true
}

function should_write_transaction_back_to_local_actor(configFile, result){
    const data_source = String(result?.dataSource ?? '').toUpperCase()
    const local_actor_input_index = Number(configFile?.LocalActorInputData_index)
    if(local_actor_input_index !== 2){
        return true
    }
    return data_source !== 'SMU'
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
            // false && console.log('[REP][extract_transaction_and_keyid] json parse failed:', error.message); 
        }
    }
    return data
}

function handling_replier_events(configFile,https_replier,replier_eventEmitter,Replie_creator,Requesters_log,processFiles,Rules_object,Signature_Validator,metadata_hash,LocalActorConnection,qkdSecurity){ // event when a transaction data comes 
    const requester_public_keys_by_id = {};
    Requesters_log.forEach((requester) => {
        requester_public_keys_by_id[requester.replier_name] = requester.replier_publicKey.export({
            format: 'pem',
            type: 'spki'
        });
    });
    const transaction_processor = new WorkerTaskClient('transaction_processor_worker.js', {
        streaming: configFile.streaming,
        metadataHash: metadata_hash,
        replierId: Replie_creator.replier_ID,
        replierPrivateKeyPem: Replie_creator.replier_key.export({
            format: 'pem',
            type: 'pkcs8'
        }),
        requesterPublicKeysById: requester_public_keys_by_id,
        requestersCount: Requesters_log.length,
        qkdEnabled: qkdSecurity != undefined
    }, {
        poolSize: WorkerTaskClient.resolvePoolSize('MACHINE_QUGRIDS_INCOMING_TX_WORKERS')
    });

    replier_eventEmitter.on('transaction_data',([data])=>{
        const transaction_wire_data = unwrap_qkd_message(qkdSecurity, data, undefined, 'transaction')
        if(transaction_wire_data == undefined){
            return
        }
        transaction_processor.run('process_transaction', {
            data: transaction_wire_data
        })
            .then((result) => {
                if(result == undefined || result.ignored === true){
                    return
                }
                const requester_DataActor= Requesters_log.find(item => item.replier_name === result.requesterId)
                if(requester_DataActor == undefined){
                    return
                }
                const ack_wire_payload =
                    qkdSecurity != undefined
                        ? qkdSecurity.wrapMessage(requester_DataActor.replier_name, result.ackWirePayload)
                        : result.ackWirePayload
                requester_DataActor.send_requests('ACK',ack_wire_payload,replier_eventEmitter,{remoteId: requester_DataActor.replier_name})
                if(transaction_is_valid(result)){
                    if(should_write_transaction_back_to_local_actor(configFile, result)){
                        write_back_to_local_actor(LocalActorConnection.localsocket,result.payload)
                    }
                }
                setImmediate(() => {
                    continueTOappend(
                        result.transactionRulesOk,
                        result.transactionString,
                        result.transactionSignatureOk,
                        processFiles.masterfile_under_modifications,
                        'Transaction: '
                    )
                    const ack_rules_ok = Rules_object.message_rules(JSON.parse(result.ackString))
                    continueTOappend(ack_rules_ok,result.ackString,true,processFiles.masterfile_under_modifications,'ACK: ')
                    sendReplierToReplier(result.ackString, Requesters_log,'ReplierTOreplier_ACK',replier_eventEmitter,result.requesterId,qkdSecurity)
                })
            })
            .catch((error) => {
                console.error('transaction processor worker error:', error.message)
            })
    })
    
}
function handling_replierTOreplier_events(Requesters_log,replier_eventEmitter,Rules_object,processFiles,Signature_Validator,qkdSecurity){ //event when a message comes from another replier (Not the requester) ==> in case of 3 or more actors 
    const replier_public_keys_by_id = {};
    Requesters_log.forEach((requester) => {
        replier_public_keys_by_id[requester.replier_name] = requester.replier_publicKey.export({
            format: 'pem',
            type: 'spki'
        });
    });
    const ack_validator = new WorkerTaskClient('ack_processor_worker.js', {
        streaming: Rules_object.streaming,
        requestersCount: Requesters_log.length,
        replierPublicKeysById: replier_public_keys_by_id,
        qkdEnabled: qkdSecurity != undefined,
        localMachineId: qkdSecurity?.localMachineId
    }, {
        poolSize: WorkerTaskClient.resolvePoolSize('MACHINE_QUGRIDS_ACK_WORKERS')
    });
    
    replier_eventEmitter.on('ReplierTOreplier_ACK',(ACK_ToReplier)=>{
        const ack_wire_data = unwrap_qkd_message(qkdSecurity, ACK_ToReplier, undefined, 'replier ACK')
        if(ack_wire_data == undefined){
            return
        }
        ack_validator.run('validate_ack', {
            rawData: ack_wire_data
        }).then((result) => {
            if(result == undefined || result.ignored === true){
                return
            }
            let replie_result = Rules_object.message_rules(result.ackObject) // eventual concictency for the ACK
            continueTOappend(
                replie_result,
                result.ackString,
                result.ackSignatureOk,
                processFiles.masterfile_under_modifications,
                'ACK: '
            )
        }).catch((error) => {
            console.error('replier ACK validator worker error:', error.message)
        })
    
    })
    

}
function handling_END_events(Replier_eventEmitter,processFiles,Second_Process,end_event){ // end event
    Replier_eventEmitter.on('END', ()=>{
        end_event.starting_date_ms = Date.now() //reinitialise the end event cause it has already been emitted
        end_event.transaction_counter=0
        // false && console.log('**********EndProcess Began**********' ,processFiles.masterfile_under_modifications.name); 
        let ended_masterFile = processFiles.masterfile_under_modifications
        processFiles.create_masterfile_after_END() //the file is going to be in Ended folder
        processFiles.create_masterfile_under_modifications() // create a new file 
       Second_Process.rules_process(ended_masterFile,processFiles.masterfile_after_END)
    })

}
function handling_FileHash_events(processFiles,Server_largeData,Replier_eventEmitter,Requesters_log,SecondProcess){ // after the end event
    Replier_eventEmitter.on('got_RequesterFileHash', (file_hash)=>{
        var replier_filehash= file_hash.fileHash
        SecondProcess.collect_filehashes(replier_filehash, Requesters_log.length)
    })
    
    
    Replier_eventEmitter.on('SendingFileData',(res)=>{
       processFiles.create_mergedFile()
       Server_largeData.sendBackdata(res,SecondProcess.master_file)
    })
   

}


module.exports= {handling_replier_events,handling_replierTOreplier_events,handling_END_events,handling_FileHash_events}
