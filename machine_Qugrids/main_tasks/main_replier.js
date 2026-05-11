const {handling_replier_events,handling_replierTOreplier_events,handling_END_events,handling_FileHash_events}=require('./events/replier_events')
const{handling_auditor_Replier_events}=require('./events/internal_judge_events')
const {handling_stream_events_AS_reciever}=require('./events/stream_events')

function REPLIER(configFile,judge_object,server_largeData,SecondProcess,end_event,https_replier,replier_eventEmitter,Replie_creator,Requesters_log,processFiles,Rules_object,Signature_Validator,metadatahash,LocalActorConnection,qkdSecurity){
    // false && console.log('[BOOT][REPLIER] init machine=',configFile.myID,' repliers=',Requesters_log.length)
    handling_replier_events(configFile,https_replier,replier_eventEmitter,Replie_creator,Requesters_log,processFiles,Rules_object,Signature_Validator,metadatahash,LocalActorConnection,qkdSecurity)
    handling_replierTOreplier_events(Requesters_log,replier_eventEmitter,Rules_object,processFiles,Signature_Validator,qkdSecurity)
    handling_END_events(replier_eventEmitter,processFiles,SecondProcess,end_event)
    handling_FileHash_events(processFiles,server_largeData,replier_eventEmitter,Requesters_log,SecondProcess)
   // handling_auditor_events_AsReplier(external_judge,replier_eventEmitter,processFiles,judge_eventEmitter,judge_object)
   handling_auditor_Replier_events(replier_eventEmitter,judge_object,Requesters_log)
   handling_stream_events_AS_reciever(replier_eventEmitter)
    
   }
module.exports= REPLIER
