
const crypto = require('crypto');
const fs = require('fs');



function hashingFile(file,eventEmitter, emit_title){
    // Path to the file to be hashed
    const filePath = file.path;
    
    // Create a readable stream
    const fileStream = fs.createReadStream(filePath);
    
    // Create a hash object
    const hash = crypto.createHash('sha256');
    
    // Pipe the file stream into the hash object
    fileStream.pipe(hash);
    
    // Handle the 'readable' event to get the hash digest
    hash.on('readable', () => {
      const data = hash.read();
      if (data) {
        /* false && console.log('File hash:', data.toString('hex')); */ 
        eventEmitter.emit(emit_title, (data.toString('hex')))
      }
    });
    
    // Handle errors
    fileStream.on('error', (err) => {
      console.error('Error reading file:', err);
    });
    
    hash.on('error', (err) => {
      console.error('Error hashing file:', err);
    });
    
    

}
function hashingData(data,eventEmitter){
  let hash = crypto.createHash('sha256')
                   .update(data)
                   .digest('hex');
  eventEmitter.emit('hashingdataISdone', (hash))                 

}

module.exports ={hashingFile,hashingData}