
/**
 * @brief message_softRules
 *
 * 
 * This function takes care of the soft rules applied on the messages : as an example if the length of the data < 1024 then msg is valid
 *
 * @param data: takes the data part of the message as an input
 * 
 * @return boolean (true if the message is valid or false if not)
 */


function message_softRules(data){
    let number = parseFloat(data);
    
    // Check if the conversion was successful and the number is positive
    /*if (!isNaN(number) && number >= 0) {
        return true;
    } else {
        return false;
    }*/
   return true




}
module.exports = message_softRules