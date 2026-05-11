let crypto = require('crypto');
const {
    copyPayloadFieldsFromMessage,
    signaturePayloadValue,
} = require('./payload_codec');

/**
 * @brief create_Replie
 *
 * This class creates a Replie object and append
 * 
 *
 * @param trans: the transaction coming from the server
 * @param replier_key: key needed to create the signature
 * 
 * @return replie
 */

class create_Replie{
    constructor( replier_key,replier_ID){
        this.replier_key=replier_key
        this.replier_ID=replier_ID
    }
    transaction_hash(trans ){ // create the transactionHash 
        let build_string =  trans.Requester+ trans.Timestamp+signaturePayloadValue(trans) 
        let transactionhash = crypto.createHash('sha256').update(build_string).digest('hex');
        /* false && console.log('[ACK][transaction_hash] requester=',trans.Requester,' timestamp=',trans.Timestamp,' hash=',transactionhash) */
        return transactionhash
    }
    Replie(trans,Requesters_log){ // build the ACK
          let transactionhash = this.transaction_hash(trans)
          /* false && console.log('[ACK][Replie] replier=',this.replier_ID,' requester=',trans.Requester,' nodes=',Requesters_log.length + 1,' dataLen=',trans.Data != undefined ? String(trans.Data).length : 0) */
           
           let replie_object
           if(Requesters_log.length > 1){// more than two actors
            replie_object = {
                Requester:  trans.Requester,//the one that is gonna recieve this message
                Replier:  this.replier_ID, //the one that is gonna send this message
                Timestamp: trans.Timestamp,
                ...copyPayloadFieldsFromMessage(trans),
                TransactionHash : transactionhash, // for the case of 3 or more actors
                Signature: ''
            };
            let signature = crypto.sign(
                'sha256',
                (
                    this.replier_ID +
                    trans.Timestamp +
                    signaturePayloadValue(replie_object) +
                    transactionhash
                ),
                this.replier_key
            );
            replie_object.Signature = signature.toString('base64')
            /* false && console.log('[ACK][Replie] created ACK with Data and TransactionHash') */

           }else{ // for the case of 2
            let signature = crypto.sign('sha256', ( this.replier_ID+ trans.Timestamp + transactionhash), this.replier_key);
            replie_object = {
                Requester:  trans.Requester,//the one that is gonna recieve this message
                Replier:  this.replier_ID, //the one that is gonna send this message
                Timestamp: trans.Timestamp,
                Signature: signature.toString('base64')
            };
            /* false && console.log('[ACK][Replie] created ACK without Data (2-node mode)') */
           }
           
           let replie = JSON.stringify(replie_object)
           return [replie,transactionhash,replie_object]

    }

    
}

module.exports = create_Replie
