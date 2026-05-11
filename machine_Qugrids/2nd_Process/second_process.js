
const fs = require('fs');
const readline = require('readline');

var events = require('events');
let {hashingFile} =require('../3rd_Process/Hash')
let create_directory= require('../largeSteps/os');
/**
 * @brief SecondProcess
 *
 * This class creates a Second process object 
 *
 * @param rules_function : rules that are going to be applied on the on the file  
 * 
 * @return Second process objekt
 */

class SecondProcess{
    constructor( rules_function,machineIDS,eventEmitter,metadataHash ){
        this.file //file to work on
        this.machineIDS=machineIDS
        this.rules_function=rules_function
        this.master_file  //file to append the resulted data in
        this.eventEmitter =eventEmitter
        this.fileHash //myfilehash
        this.repliers_filehashes=[] // an array to collect the file hashes on the requester side
        this.file_mydata_array // array of my file data (is  going to be sent to others in case of auditorCall)
        this.files_paths=[]//counter to know that all node data came
        this.SecondProcess_eventEmitter= new events.EventEmitter()
        this.metadataHash=metadataHash
        this.events()
        
        
        
    }
    collect_filedata(numberofnodes,file_path){ //collect all the file data of the other repliers : is going to be executed only in case the machine is the requester
        this.files_paths.push(file_path)
        if(this.files_paths.length == numberofnodes){
            this.eventEmitter.emit('FileDataCollectISdone', (this.files_paths))
            this.files_paths=[]//re_initialisation  
       }
    }
    collect_filehashes(replier_filehash, numberofrepliers){ //wil be executed only in the requester side : collect all the file hashes of the other repliers
        this.repliers_filehashes.push(replier_filehash)
        if(this.repliers_filehashes.length == numberofrepliers){
             this.eventEmitter.emit('FilehashCollectISdone',(this.repliers_filehashes))
             this.repliers_filehashes=[] //re_initialisation  

        }

    }
    async rules_process(file,master_file){ // applie apostriori rules on the file 
        this.fileHash= undefined //initialisation
        this.file=file 
        this.master_file =master_file
        this.loop_through_file(this.file,this.SecondProcess_eventEmitter)
       
    }
    async loop_through_file(file,SecondProcess_eventEmitter){
        let tempDir = await create_directory(file.name+'loopResult')
        var trans_file=tempDir+'/transactionFile.txt'
        var ACK_file=tempDir+'/ACKFile.txt'
        
        let endWriteStream = 0;
        // Create a readable stream
        const fileStream = fs.createReadStream(file.path);

        const transaction_writeStream = fs.createWriteStream(trans_file, {flags: 'a'});
        const ACK_writeStream = fs.createWriteStream(ACK_file, {flags: 'a'});
    
        // Create an interface to read the file line by line
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity // Recognize all instances of CR LF ('\r\n') as a single line break
        });
    
        // Process each line asynchronously
        for await (const element of rl) {
            let sliced_element= element.split('{');
            if(sliced_element[0]=='Transaction: '){
                transaction_writeStream.write('{'+sliced_element[1]+'\n')
            }else if((sliced_element[0]=='ACK: ')){
                ACK_writeStream.write('{'+sliced_element[1]+'\n')
            }      

          
            
        }
        // Close the stream after writing all data
        transaction_writeStream.end(() => {
          /* false && console.log('Data has been written to the file.'); */ 
          checkFinished()
        });
        
        // Handle errors
        transaction_writeStream.on('error', (err) => {
          console.error('Error writing to the file:', err);
        });
        // Close the stream after writing all data

        ACK_writeStream.end(() => {
          /* false && console.log('Data has been written to the file.'); */ 
          checkFinished()
      });
      
      // Handle errors
      ACK_writeStream.on('error', (err) => {
        console.error('Error writing to the file:', err);
      });
      function checkFinished() {
        endWriteStream += 1;
        if (endWriteStream === 2) {
            SecondProcess_eventEmitter.emit('doneSeperatingTrans_ACK',([trans_file,ACK_file,tempDir]))
          
        }
      }

    }
    events(){
        this.SecondProcess_eventEmitter.on('doneSeperatingTrans_ACK',([trans_file,ACK_file,tempDir])=>{
            this.rules_function.largeFile_Rules(trans_file,ACK_file,tempDir,this.SecondProcess_eventEmitter, this.master_file,this.machineIDS)

        })
        this.SecondProcess_eventEmitter.on('WritingDataISdone',(file)=>{
             hashingFile(file, this.SecondProcess_eventEmitter, 'FileHash')
        })
        this.SecondProcess_eventEmitter.on('FileHash',(file_Hash)=>{ 
            this.fileHash= file_Hash     
            /* false && console.log('Normal : ' , file_Hash, this.master_file.path) */
             this.eventEmitter.emit('FileHashCreated', (file_Hash));      
        })

    }


}
module.exports= SecondProcess
