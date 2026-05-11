

const moment = require('moment');
const fs = require('fs');
/**
 * @brief End_event
 *
 * This class creates a End event object that control the main process' flow based on the configurated parameters.
 * this class is only applied by the Requester
 *
 * @param Rule: Rule requested in the configuration file to end the main process ["TimeWindow","Date","FileSize", "NummberOfTransactions"]
 * @param rules_function : configuration file   
 * @param starting_date_ms : a global variable that indicates the start of the process in milliseconds
 * @param eventEmitter : to emit the end event
 * @param transaction_counter: counter to coung the amount of transactions 
 * @param date : a global variable that indicates the start of the process in 
 * 
 * @return true:  if the end event started / false: if not 
 */


class END_event{
    constructor(Rule, rules_file,eventEmitter,starting_date_ms,transaction_counter,date){
        this.rule =Rule
        this.rules_file=rules_file
        this.eventEmitter=eventEmitter
        this.starting_date_ms= starting_date_ms
        this.transaction_counter =transaction_counter
        this.date=date

    }
    applie_Rule(file){ // applie the rule chosen in the configuration file
        if(this.rule == 'TimeWindow'){ return this.return(this.time_window(file))}
        else if(this.rule == 'Date'){return this.return(this.endOFdate(file))}
        else if(this.rule=='FileSize'){return this.return(this.file_size(file))}
        else {return this.return(this.NummberOfTransactions(file))}
    }
    return(result){ // help function
        if(result == true){return true}else{return false}
    }
    time_window(file){//emit an end event when the time came to close the event(depends on the time in configFile)
        
        let end_time_ms= this.rules_file.Time_Window_InHours * 60 *60 * 1000 //convert the ending time configured to ms
        if(Date.now() >= end_time_ms+this.starting_date_ms){
          this.eventEmitter.emit('END',file) ;
         return true}
    }
    endOFdate(file){//emit an end event when an new day is started
        let current_date= moment().format().split('T')[0];
        if(this.date != current_date){
            this.eventEmitter.emit('END',file)
            return true
         }
    }
    file_size(file){// emit the end event when the size of the file is big enough
            fs.stat(file.path, (err, stats) => {
                if (err) {
                  console.error(`Error reading file: ${err.message}`);
                  return;
                }
                let fileSizeInBytes = stats.size;
                if(fileSizeInBytes > this.rules_file.fileSize_InBytes){
                    this.eventEmitter.emit('END',file)
                    return true
                 }
            });
    }
    NummberOfTransactions(file){ // emit the end event when the number of transactions are enough
         if(this.transaction_counter >= this.rules_file.NummberOfTransactions){
            this.eventEmitter.emit('END',file)
            return true
         }

       

    }
}
module.exports= END_event