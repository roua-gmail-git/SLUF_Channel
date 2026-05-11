
const {handling_requester_events,handling_localactor_events,handling_END_events,handling_FileHash_events}=require('./events/requester_events')
const{handling_auditor_events}=require('./events/internal_judge_events')
const {handling_stream_events_AS_sender}= require('./events/stream_events')


function REQUESTER(external_judge,judge_object,largeDataPort,clientOFlargeData,SecondProcess,Requester_eventEmitter,end_event,transaction_creator,processFiles,LocalActorConnection,Requesters_log,Rules_object,Signature_Validator,metadatahash,qkdSecurity){
  /* false && console.log('[BOOT][REQUESTER] init largeDataPort=',largeDataPort,' repliers=',Requesters_log.length) */
  
   handling_localactor_events(end_event,Requester_eventEmitter,transaction_creator,processFiles,Requesters_log,Rules_object,Signature_Validator,qkdSecurity)
   handling_requester_events(LocalActorConnection,Requesters_log,Requester_eventEmitter,transaction_creator,Rules_object,processFiles,Signature_Validator,metadatahash,qkdSecurity)
   handling_END_events(end_event,Requester_eventEmitter,processFiles,SecondProcess,Requesters_log)
   handling_FileHash_events(judge_object.Judge_main_evenEmitter,largeDataPort,processFiles,clientOFlargeData,Requester_eventEmitter,Requesters_log,SecondProcess)
  handling_auditor_events(external_judge,judge_object,Requester_eventEmitter,Requesters_log,processFiles,judge_object.Judge_main_evenEmitter)
  handling_stream_events_AS_sender(Requester_eventEmitter,clientOFlargeData,Requesters_log,largeDataPort)
    


}






module.exports=REQUESTER
