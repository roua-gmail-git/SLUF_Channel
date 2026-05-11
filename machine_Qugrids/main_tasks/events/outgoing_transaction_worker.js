const createTransaction = require('../../transaction_creator');
const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const { extractPayload, extractPayloadSource } = require('../../payload_codec');

function build_transaction_wrapper(transaction_string, data_source){
    const wrapper = {
        transaction: JSON.parse(transaction_string)
    }
    if(typeof data_source === 'string' && data_source.length > 0){
        wrapper.DataSource = data_source
    }
    return JSON.stringify(wrapper)
}

const sender_private_key = crypto.createPrivateKey({
    key: workerData.senderPrivateKeyPem,
    format: 'pem',
    type: 'pkcs8'
});
const transaction_creator = new createTransaction(
    workerData.senderId,
    sender_private_key,
    workerData.metadataHash,
    null
);

parentPort.on('message', (message) => {
    if (message == undefined || typeof message !== 'object') {
        return;
    }
    try{
        if (message.type !== 'process_outgoing_transaction') {
            throw new Error(`Unsupported worker task type: ${message.type}`);
        }

        const data_source = extractPayloadSource(message.payload.data);
        const payload = extractPayload(message.payload.data);
        const timestamp = Date.now();
        const transaction = transaction_creator.transaction(timestamp, payload);
        const wires = (message.payload.remoteIds ?? []).map((remote_id) => ({
            remoteId: remote_id,
            wireTransaction: build_transaction_wrapper(transaction, data_source)
        }));

        parentPort.postMessage({
            id: message.id,
            ok: true,
            result: {
                transaction,
                wires,
                dataSource: data_source
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
