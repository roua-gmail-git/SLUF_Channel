const crypto = require('crypto');
const { parentPort, workerData } = require('worker_threads');
const Rules = require('../../Rules/Rules');
const Signature_Validator = require('../../signature_validator');
const create_Replie = require('../../create_Replie');
const { decodeMessagePayload } = require('../../payload_codec');
function extract_transaction(data){
    if(data != undefined && typeof data === 'object' && data.transaction != undefined){
        return (typeof data.transaction === 'string') ? JSON.parse(data.transaction) : data.transaction
    }
    if(data != undefined && typeof data === 'object'){
        return data
    }
    if(typeof data === 'string'){
        const parsed = JSON.parse(data)
        if(parsed != undefined && typeof parsed === 'object' && parsed.transaction != undefined){
            return (typeof parsed.transaction === 'string') ? JSON.parse(parsed.transaction) : parsed.transaction
        }
        if(parsed != undefined && typeof parsed === 'object'){
            return parsed
        }
    }
    return data
}

function parse_wire_message(data){
    if(typeof data !== 'string'){
        return data
    }
    return JSON.parse(data)
}

function extract_wire_data_source(data){
    if(data != undefined && typeof data === 'object' && typeof data.DataSource === 'string' && data.DataSource.length > 0){
        return data.DataSource
    }
    if(typeof data === 'string'){
        try{
            const parsed = JSON.parse(data)
            if(parsed != undefined && typeof parsed === 'object' && typeof parsed.DataSource === 'string' && parsed.DataSource.length > 0){
                return parsed.DataSource
            }
        }catch(error){
        }
    }
    return undefined
}

const rules = new Rules(workerData.streaming);
const replier_private_key = crypto.createPrivateKey({
    key: workerData.replierPrivateKeyPem,
    format: 'pem',
    type: 'pkcs8'
});
const replie_creator = new create_Replie(replier_private_key, workerData.replierId);
const requester_signature_validators = new Map();

for (const [requester_id, requester_public_key_pem] of Object.entries(workerData.requesterPublicKeysById ?? {})) {
    const requester_public_key = crypto.createPublicKey({
        key: requester_public_key_pem,
        format: 'pem',
        type: 'spki'
    });
    requester_signature_validators.set(requester_id, new Signature_Validator(requester_public_key));
}

parentPort.on('message', (message) => {
    if (message == undefined || typeof message !== 'object') {
        return;
    }

    try{
        if (message.type !== 'process_transaction') {
            throw new Error(`Unsupported worker task type: ${message.type}`);
        }

        let incoming_message = parse_wire_message(message.payload.data);
        let wire_data_source = extract_wire_data_source(incoming_message);
        const transaction = extract_transaction(incoming_message);
        if (transaction == undefined || typeof transaction !== 'object') {
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: { ignored: true }
            });
            return;
        }

        const requester_id = transaction.Requester;
        const requester_signature_validator = requester_signature_validators.get(requester_id);
        if (requester_signature_validator == undefined) {
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: { ignored: true }
            });
            return;
        }

        const transaction_for_processing = Object.assign({}, transaction);
        const payload = decodeMessagePayload(transaction_for_processing);
        if (payload == undefined) {
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: { ignored: true }
            });
            return;
        }

        const transaction_rules_ok = rules.message_rules(transaction_for_processing);
        const transaction_signature_ok = requester_signature_validator.validateSignature(
            transaction_for_processing,
            'Transaction',
            workerData.metadataHash
        );

        const [ack_string] = replie_creator.Replie(transaction_for_processing, {
            length: workerData.requestersCount
        });
        const ack_wire_payload = ack_string;
        const transaction_string = JSON.stringify(transaction_for_processing);

        parentPort.postMessage({
            id: message.id,
            ok: true,
            result: {
                ignored: false,
                requesterId: requester_id,
                dataSource: wire_data_source,
                payload,
                transactionString: transaction_string,
                transactionRulesOk: transaction_rules_ok,
                transactionSignatureOk: transaction_signature_ok,
                ackString: ack_string,
                ackWirePayload: ack_wire_payload
            }
        });
    }catch(error){
        parentPort.postMessage({
            id: message.id,
            ok: false,
            error: error.message
        });
    }
});
