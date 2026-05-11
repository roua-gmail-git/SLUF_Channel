let crypto = require('crypto');

/**
 * @brief createMetadata
 *
 * This class creates the metadata and then hash it
 *
 * @param common, actor1 , actor2: Data coming from the metadata.json file
 * @param publicKey1, publicKey2 : public key of both actors 
 * 
 * @return metadata 
 */





 function createMetadata(metadataFile_log){
    let metadataObject ={CommonData: metadataFile_log[0]}
    for(let i=1; i< metadataFile_log.length; i++){
        let data = {ID: metadataFile_log[i].ID, Wallet: metadataFile_log[i].Wallet, PublicKey : metadataFile_log[i].PublicKey,IP: metadataFile_log[i].IP, Port: metadataFile_log[i].Port}; 
        let dynamicKeyName = "DataActor" + i;
        metadataObject[dynamicKeyName] = data; 
    }
    return metadataObject
}
 function metadata_hash(metadataFile_log){ // creates the metadatahash
    var metadata=  createMetadata(metadataFile_log)
    let metadataHash = crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
    return metadataHash
}


module.exports = metadata_hash