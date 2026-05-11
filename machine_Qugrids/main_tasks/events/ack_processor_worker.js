const crypto = require('crypto');
const { parentPort, workerData } = require('worker_threads');
const Signature_Validator = require('../../signature_validator');
const {
    decodeMessagePayload,
    normalizeLocalPayload,
    signaturePayloadValue,
} = require('../../payload_codec');

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
    throw new Error('Unable to parse transaction message')
}

function transaction_hash(transaction){
    const build_string =
        transaction.Requester + transaction.Timestamp + signaturePayloadValue(transaction)
    return crypto.createHash('sha256').update(build_string).digest('hex')
}

const replier_signature_validators = new Map();

for (const [replier_id, replier_public_key_pem] of Object.entries(workerData.replierPublicKeysById ?? {})) {
    const replier_public_key = crypto.createPublicKey({
        key: replier_public_key_pem,
        format: 'pem',
        type: 'spki'
    });
    replier_signature_validators.set(replier_id, new Signature_Validator(replier_public_key));
}

function decode_ack_object(remote_id, raw_data){
    return typeof raw_data === 'string'
        ? JSON.parse(raw_data)
        : raw_data
}

parentPort.on('message', (message) => {
    if (message == undefined || typeof message !== 'object') {
        return;
    }

    try{
        if (message.type === 'decode_ack') {
            const ack_object = decode_ack_object(message.payload.remoteId, message.payload.rawData);
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: {
                    ackObject: ack_object,
                    ackString: JSON.stringify(ack_object)
                }
            });
            return;
        }

        if (message.type === 'validate_ack') {
            const ack_object = decode_ack_object(message.payload.remoteId, message.payload.rawData);
            const corresponding_replier_validator = replier_signature_validators.get(ack_object.Replier);
            if (corresponding_replier_validator == undefined) {
                parentPort.postMessage({
                    id: message.id,
                    ok: true,
                    result: { ignored: true }
                });
                return;
            }

            const ack_string = JSON.stringify(ack_object);
            const ack_signature_ok = corresponding_replier_validator.validateSignature(
                ack_object,
                'ACK Replier',
                ack_object.TransactionHash
            );

            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: {
                    ignored: false,
                    ackObject: ack_object,
                    ackString: ack_string,
                    ackSignatureOk: ack_signature_ok
                }
            });
            return;
        }

        if (message.type !== 'process_ack') {
            throw new Error(`Unsupported worker task type: ${message.type}`);
        }

        const ack_object =
            typeof message.payload.recieved_data === 'string'
                ? JSON.parse(message.payload.recieved_data)
                : message.payload.recieved_data;
        const transaction_context = message.payload.transaction ?? {};
        const payload_for_localactor =
            workerData.requestersCount > 1
                ? (
                    ack_object.Data != undefined
                        ? decodeMessagePayload(ack_object)
                        : normalizeLocalPayload(transaction_context.payloadForLocalActor)
                )
                : normalizeLocalPayload(transaction_context.payloadForLocalActor);
        if (payload_for_localactor == undefined) {
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: { ignored: true }
            });
            return;
        }

        const corresponding_replier_validator = replier_signature_validators.get(ack_object.Replier);
        if (corresponding_replier_validator == undefined) {
            parentPort.postMessage({
                id: message.id,
                ok: true,
                result: { ignored: true }
            });
            return;
        }

        let tx_hash = transaction_context.transactionHash;
        if (tx_hash == undefined && ack_object.TransactionHash != undefined) {
            tx_hash = ack_object.TransactionHash;
        }
        if (tx_hash == undefined) {
            const parsed_transaction = extract_transaction(transaction_context.transaction);
            tx_hash = transaction_hash(parsed_transaction);
        }
        const ack_string = JSON.stringify(ack_object);
        const ack_signature_ok = corresponding_replier_validator.validateSignature(
            ack_object,
            'ACK',
            tx_hash
        );

        parentPort.postMessage({
            id: message.id,
            ok: true,
            result: {
                ignored: false,
                payloadForLocalActor: payload_for_localactor,
                transactionHash: tx_hash,
                ackString: ack_string,
                ackSignatureOk: ack_signature_ok
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
