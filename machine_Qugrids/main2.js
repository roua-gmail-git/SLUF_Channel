const configFile = require('./ConfigFile2.json')
var events = require('events');
events.defaultMaxListeners = 0
const fs = require('fs');
const path = require('path');
const File =require('./File_Management')
const moment = require('moment'); 
let {createRequestersLog,create_machineIDS}= require('./actorsLog.js')
let {resolveCommunicationMode,createConfiguredRequesterClass}= require('./communication_modes')
let metadata_hash=require('./metadata_creator'); // create metadatahsh
let {create_public_key,create_private_key}= require('./keys/key_creator') //function file to create the private key form pem file and the public key from the jwk format
const communicationMode = resolveCommunicationMode(configFile)

//--------------------------------- importing private keys ---------------------------------- 
pemFilePath1 = "keys/private1.pem";
//pemFilePath1 = "/home/brilliant/Documents/ultrafast-blockchain-layer-for-energy-systems-BoostingChannel/BoostingChannel/new development/test_resources/private2.pem"; //comment above if machine 2 is the sender              
pemFilePath2 = "keys/private2.pem";
//pemFilePath2 = "/home/brilliant/Documents/ultrafast-blockchain-layer-for-energy-systems-BoostingChannel/BoostingChannel/new development/test_resources/private1.pem";//comment above if machine 2 is the sender
//------------------- importing metadata file -------------//
let metadata_file = JSON.parse(fs.readFileSync('metadata.json', "utf8"));
let  metadataFile_log= Object.values(metadata_file)
metadataFile_log.shift()
let metadatahash=metadata_hash(Object.values(metadata_file))
let machineIDS = create_machineIDS(metadataFile_log)
//------------------- creating Folders ----------------------------------------------
const requiredFolders = [
    './Files',
    './Files/under_modification',
    './Files/Ended',
    `./Files/Closed`,
    './Files/Closed/fileHashes',
    './Files/Closed/masterFiles',
    './Files/Auditor_Files','./Files/Auditor_Files/beforeMerging','./Files/Auditor_Files/closed','./Files/Auditor_Files/Summaries','./Files/Auditor_Files/under_modifications'
];

requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        /* false && console.log(`Created folder: ${folder}`); */ 
    }
});
//--------------------------------- global data that differ for each machine ---------------------------------- 


//thing that need to be changed 
//const privateKey= create_private_key(pemFilePath1)   // Requester   
const privateKey= create_private_key(pemFilePath2)   // Replier     
//thing that need to be changed 

//--------------------------------- importing files ---------------------------------- 
let Replier = require('./https_connection/https_server.js') //replier server connection
let Requester = createConfiguredRequesterClass(require('./https_connection/https_client'), communicationMode); // requester server connection
let REQUESTER=require('./main_tasks/main_requester') //requester main function
let REPLIER=require('./main_tasks/main_replier') // replier main function
const ProcessFiles= require('./process_Files.js') // create the files needed for the process
let END_event= require('./2nd_Process/End_Event'); // process to be executed when the end event is emitted   
let createTransaction=require('./transaction_creator'); //create the requester transaction 
const rules = require('./Rules/Rules') // rules to be applies on the message and the files
const Signature_Validator= require('./signature_validator'); // validate the signature before appending the message to the file 
const create_Replie =require('./create_Replie'); // create replier ACK
const SecondProcess =require('./2nd_Process/second_process');
let ClientOFlargeData= require('./https_connection/client_largeData.js')
let ServerOFlargeData= require('./https_connection/server_largeData.js')
let ExternalJudge= require('./external_judge')
let Judge= require('./3rd_Process/judge'); // internal judge

function resolve_local_actor_connection_module(configFile){
    if(configFile.localActorType_index == 0){
        const local_actor_input_types = Array.isArray(configFile.LocalActorInputData) ? configFile.LocalActorInputData : []
        const local_actor_input_index = Number(configFile.LocalActorInputData_index ?? 0)
        const selected_local_actor_input =
            Number.isInteger(local_actor_input_index) &&
            local_actor_input_index >= 0 &&
            local_actor_input_index < local_actor_input_types.length
                ? String(local_actor_input_types[local_actor_input_index])
                : String(local_actor_input_types[0] ?? 'SMU')

        if(selected_local_actor_input === 'PMU+SMU'){
            return require('./Actor_Connection/localActorTypeServer/local_connectionPMU_SMU')
        }
        if(selected_local_actor_input === 'SMU'){
            return require('./Actor_Connection/localActorTypeServer/local_connectionSMU')
        }
        return require('./Actor_Connection/localActorTypeServer/local_connectionPMU')
    }
    return require('./Actor_Connection/localActorTypeClient/local_connection')
}

var myDataActor= metadataFile_log.find(item => item.ID === configFile.myID)
/* false && console.log('[BOOT][main2] starting machine=',configFile.myID,' ip=',myDataActor.IP,' port=',myDataActor.Port,' streaming=',configFile.streaming) */


var Replier_eventEmitter = new events.EventEmitter();
var Requester_eventEmitter = new events.EventEmitter();
Replier_eventEmitter.on('ACK_channel_data', (ack_packet) => {
    Requester_eventEmitter.emit('ASYNC_ACK_data', ack_packet)
})
let Rules_object= new rules(configFile.streaming)
if(metadataFile_log.length > 2 && configFile.streaming ==false){
    const ReplieServer= require('./Actor_Connection/Replie_Server.js')
    ReplieServer(myDataActor.IP,configFile.localRepliePort,Replier_eventEmitter )
}
var processFiles=new  ProcessFiles(File, configFile.myID) 
processFiles.create_masterfile_under_modifications() // create file where all data as going to be stored before the end process
/* false && console.log('[BOOT][main2] masterfile_under_modifications created') */

var myPublic_key = create_public_key(myDataActor.PublicKey)
var https_replier =new Replier(myDataActor.Port,Replier_eventEmitter,myDataActor.IP,myPublic_key,communicationMode) // who is gonna recieve requests
let end_event= new END_event(configFile.End_Event[configFile.EndRule_index],configFile,Requester_eventEmitter,Date.now(),0,moment().format().split('T')[0]) // create an instant of an end event 
let transaction_creator = new createTransaction(configFile.myID,privateKey,metadatahash,myPublic_key)
let Replie_creator =new create_Replie(privateKey,configFile.myID) 
let  Second_Process =new SecondProcess( Rules_object,machineIDS,Requester_eventEmitter,metadatahash)
let client_largeData=new ClientOFlargeData(Requester_eventEmitter,communicationMode)
let server_largeData=new ServerOFlargeData(configFile.largeDataPort,myDataActor.IP,Replier_eventEmitter,communicationMode)
let judge_eventEmitter= new events.EventEmitter();
let judge_object =new Judge(metadatahash,machineIDS,Rules_object,judge_eventEmitter,configFile.myID,transaction_creator,metadataFile_log,Signature_Validator,create_public_key)


let external_judge= new ExternalJudge(configFile.externalJudgeIP,configFile.externalJudgePort)
let Requesters_log=createRequestersLog(metadataFile_log, configFile.myID,create_public_key,Requester)
const qkdSecurity = communicationMode.qkdSecurity

setTimeout(() => {
    let LocalActor_Connection = resolve_local_actor_connection_module(configFile)
let LocalActorConnection= new LocalActor_Connection(configFile.Actor_Connection[configFile.Connection_index],configFile,Requester_eventEmitter,myDataActor.IP,configFile.streaming)
 REPLIER(configFile,judge_object,server_largeData,Second_Process,end_event,https_replier,Replier_eventEmitter,Replie_creator,Requesters_log,processFiles,Rules_object,Signature_Validator,metadatahash,LocalActorConnection,qkdSecurity)
    REQUESTER(external_judge,judge_object,configFile.largeDataPort,client_largeData,Second_Process,Requester_eventEmitter,end_event,transaction_creator,processFiles,LocalActorConnection,Requesters_log,Rules_object,Signature_Validator,metadatahash,qkdSecurity)


}, 1000);
