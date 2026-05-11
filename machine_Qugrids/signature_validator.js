const crypto = require ('crypto');
const { signaturePayloadValue } = require('./payload_codec');

/**
 * @brief Signature_Validator
 *
 * This class creates a validator object to see if the Signature of the transaction or the ACK are valid
 *
 * @param metadataHash,pubKey : info need for th verification process
 * 
 * @return boolean :true if the signature is valid otherwise false 
 */

class Signature_Validator{
    constructor(pubKey){
        this.pubKey=pubKey
    }
    validateSignature(transaction , name,transaction_hach){
        let msg
        if(name.includes('ACK')){
           if(transaction.Data != undefined){ // cause in case of two actors there is no Data
            msg = transaction.Replier+transaction.Timestamp+signaturePayloadValue(transaction)+ transaction_hach;
           }else{
            msg = transaction.Replier+transaction.Timestamp+ transaction_hach;
           }

        }else{
           msg = transaction.Requester+transaction.Timestamp+signaturePayloadValue(transaction)+ transaction_hach;
          }
        let signatureBuffer=Buffer.from(transaction.Signature,'base64');//convert signature into "buffer" format
        const verified = crypto.verify('sha256', Buffer.from(msg), this.pubKey, signatureBuffer);
        return(verified);
    }
}
module.exports= Signature_Validator
