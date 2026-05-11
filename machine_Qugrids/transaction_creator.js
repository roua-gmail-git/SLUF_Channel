let crypto = require('crypto');
const {
    serializePayloadForMessage,
    signaturePayloadValue,
} = require('./payload_codec');




class createTransaction {
    constructor(senderID,sender_privatekey,metadataHash,sender_publickey){
        this.senderID=senderID
        this.senderkey=sender_privatekey
        this.sender_publickey=sender_publickey
        this.metadataHash=metadataHash
    }
    transaction(time,data){ // create the transaction
       // let time = (process.hrtime()[0] * 1e3) + (process.hrtime()[1] / 1e6) // current timestamp to avoid having the same timestamp 
        /* false && console.log('[TX][transaction] sender=',this.senderID,' timestamp=',time,' dataLen=',String(data).length); */ 
        const payload_fields = serializePayloadForMessage(data)
        let transaction_object = {
            Requester: this.senderID,
            Timestamp: time.toString(),
            ...payload_fields,
            Signature: ''
            }
        let signature = crypto.sign(
            'sha256',
            (
                this.senderID +
                time.toString() +
                signaturePayloadValue(transaction_object) +
                this.metadataHash
            ),
            this.senderkey
        );
        transaction_object.Signature = signature.toString('base64')
        let transaction = JSON.stringify(transaction_object);
        // const transaction_log_view = {
        //     Requester: transaction_object.Requester,
        //     Timestamp: transaction_object.Timestamp,
        //     Data: transaction_object.Data,
        //     // Signature: transaction_object.Signature,
        // };
        // console.log('[TX] Transaction object:', transaction_log_view);
        // console.log('[TX] Transaction JSON:', JSON.stringify(transaction_log_view));
        /* false && console.log('[TX][transaction] signatureLen=',signature.toString('base64').length,' transactionPreview=',transaction.slice(0,140)); */ 

        return (transaction);
    }
    transaction_hash(transaction ){ // create the transactionHash 
        let build_string =  transaction.Requester+transaction.Timestamp+signaturePayloadValue(transaction)
        let transactionhash = crypto.createHash('sha256').update(build_string).digest('hex');
        /* false && console.log('[TX][transaction_hash] requester=',transaction.Requester,' timestamp=',transaction.Timestamp,' hash=',transactionhash); */ 
        return transactionhash
    }
    

        

    
}
module.exports=createTransaction
