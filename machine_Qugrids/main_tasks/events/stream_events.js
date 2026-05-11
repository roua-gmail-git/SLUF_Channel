
const {hashingData}= require('../../3rd_Process/Hash');
function handling_stream_events_AS_sender(Requester_eventEmitter ,clientOFlargeData,Requesters_log,largeDataPort){
    Requester_eventEmitter.on("Stream_Actor_data",(data)=>{
        // false && console.log(data.length)
         hashingData(data , Requester_eventEmitter)
         Requesters_log.forEach(requester => {  
       //     clientOFlargeData.send_postlargeData( requester.replierIP,largeDataPort,'StreamData',data)            
         });
    })
    Requester_eventEmitter.on('hashingdataISdone', (hashedData)=>{
        Requester_eventEmitter.emit('LocalActor_data',(hashedData))
    })

}
function handling_stream_events_AS_reciever(replier_eventEmitter){
    replier_eventEmitter.on('GotStreamData',(data)=>{
        //false && console.log(data)//what to do with the stream data?
    })
}



module.exports = {handling_stream_events_AS_sender,handling_stream_events_AS_reciever}
