function createRequestersLog(metadataFile_log, myID,create_public_key,Requester){
    var myDataActor= metadataFile_log.find(item => item.ID === myID)
    var myPublic_key=create_public_key(myDataActor.PublicKey)
    let ReQ_array =[]
    for (let i=0 ; i< metadataFile_log.length; i++){
        if(metadataFile_log[i].ID != myID ){
            let replier_publickey=create_public_key(metadataFile_log[i].PublicKey)
            ReQ_array.push(new Requester(metadataFile_log[i].IP,metadataFile_log[i].ID,metadataFile_log[i].Port, replier_publickey,myPublic_key))            

        }
    }
    return ReQ_array


}
function create_machineIDS(metadataFile_log){
    let array=[]
    for(let i=0 ; i< metadataFile_log.length ; i++){
        array.push(metadataFile_log[i].ID)
    }
    return array
}

module.exports= {createRequestersLog,create_machineIDS}