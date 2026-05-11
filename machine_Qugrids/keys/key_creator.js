const crypto =require('crypto')
const fs =require('fs')

// reate keys functions


function create_public_key(PublicKey){// to create the public key out of a JWK format
    const publicKey = crypto.createPublicKey({key: PublicKey, format: 'jwk'});
    return publicKey

}

function create_private_key(senderkey){ //to create the public key out of a JWK format or  a pem format
    let keydata = fs.readFileSync(senderkey, "utf8");
    let privateKey = 0;
    if (senderkey.includes("pem")){
        privateKey = crypto.createPrivateKey({key: keydata, format: "pem", type: "pkcs8"});
           
    }else{
        privateKey = crypto.createPrivateKey({key: JSON.parse(keydata), format: "jwk"});

    }
    return privateKey
}

module.exports= {create_public_key,create_private_key}