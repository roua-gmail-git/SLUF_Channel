

/**
 * @brief message_hardRules
 *
 * This function takes care of the first 4 rules of the eventual consistancy
 *
 * @param message: takes the message as an input
 * 
 * @return boolean (true if the message is valid or false if not)
 */

function message_hardRules(message){ 
    return true
    /*let difference =  Date.now() - Number(message.Timestamp )
    if(difference < 0){
        ///The time-stamp cannot be non-causal: The message cannot come from the future 
        false && console.log('message is not valid due to a non_causal timestamp')
        return false

    }else if(difference > 100000000000000000000000000000 ){
        //The time-stamp cannot come from (too long) in the past (assume max 10000 ms)
        false && console.log('message is not valid due to a too old timestamp')
        return false

    }else {return true}*/
    
}
//2nd priority of grouping: We take into consideration the timestamps.
function correct_order(msg_log){
    msg_log = msg_log.sort((a, b) => {if (a.Timestamp < b.Timestamp) {return -1;}});
    return msg_log
}
 //We delete all repeated messages 
function  delete_repeated_msgs(msg_log){
    var res=  msg_log.filter((item, index, self) => { //gives back an array with the repeated elements
        return index !== self.findIndex((t) =>
          JSON.stringify(t) === JSON.stringify(item)
        );
    });
    for(let i=0 ; i<res.length ; i++) {
        const index = msg_log.findIndex(item => JSON.stringify(item) === JSON.stringify(res[i]));
        msg_log.splice(index, 1);
    }
    return msg_log

}
 //1st priority of grouping:  We group the messages with their corresponding answer after the request 
 async function transaction_replie_order(transaction_log,ack_log,machineIDS){
    let trans_replie_log= []
    for(let i=0 ; i< transaction_log.length ; i++){
        var counter =0
        for(let a=0;a<machineIDS.length;a++){
            if(machineIDS[a]!= transaction_log[i].Requester){
                 let corresponding_replie =  ack_log.find(item => (item.Timestamp === transaction_log[i].Timestamp && item.Replier === machineIDS[a]));
                if(corresponding_replie != undefined && counter ==0 ){
                  counter++
                  trans_replie_log.push(transaction_log[i])
                  trans_replie_log.push(corresponding_replie)
                }else if (corresponding_replie != undefined && counter !=0 ){
                    trans_replie_log.push(corresponding_replie)
                }
            }
        }
    }
    return trans_replie_log
 }






module.exports= {message_hardRules, correct_order,delete_repeated_msgs,transaction_replie_order}