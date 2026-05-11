const fs = require('fs');
const readline = require('readline');
const path = require('path');
const os = require('os');
const create_directory = require('../largeSteps/os');
const cleanUpTempFiles= require('../largeSteps/clean')
const applie_actors_sofrules =require('./standard_dev');
var events = require('events');


async function splitByData(arr) { // split the array of entries into arrays like this [[trans,ack],[trans,ack]...]
  const groups = arr.reduce((acc, obj) => {
      const data = obj.Timestamp;
      if (!acc[data]) {
          acc[data] = [];
      }
      acc[data].push(obj);
      return acc;
  }, {});

  return Object.values(groups);
}
// Helper function to process and append each line
async function processAndAppendLine(lines, destFilePath,eventEmitter,output_tempDir,index,sourceFiles_length,sourceDir,machineIDS) {
   var process_eventEmitter = new events.EventEmitter()
  var chuncking_lines=  await splitByData(lines)
  const writeStream = fs.createWriteStream(destFilePath, { flags: 'a', encoding: 'utf8' });
  process_eventEmitter.on('StandardDevExamDone',(ordered_array)=>{
    var trans_ACK_array_string= ordered_array.map(item =>JSON.stringify(item))
    let trans_ACK_data= trans_ACK_array_string.join('\n')
    writeStream.write(trans_ACK_data +'\n')
    writeStream.end()
    writeStream.on('error',(err)=>{/* false && console.log('there is an error', err) */} );
    writeStream.on('finish',()=>{
      if(index == sourceFiles_length){
        eventEmitter.emit('RulesApplied', (output_tempDir));
        cleanUpTempFiles(sourceDir)
      }
    });
  })
    applie_actors_sofrules(chuncking_lines ,process_eventEmitter,machineIDS)
  }

// Function to read a chunk file and append lines to the destination array
async function readAndAppendChunkFile(sourceFilePath, destFilePath,eventEmitter,output_tempDir,index,sourceFiles_length,sourceDir,machineIDS) {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(sourceFilePath, 'utf8'),
      crlfDelay: Infinity,
    });
    var lines=[]

    lineReader.on('line', async (line) => {
      if(line !=''){lines.push(JSON.parse(line))}
    });

   lineReader.on('close', ()=>{ 
    processAndAppendLine(lines, destFilePath,eventEmitter,output_tempDir,index,sourceFiles_length,sourceDir,machineIDS);} );
    lineReader.on('error', (err)=>{/* false && console.log(err) */});
 
}

// Main function to process multiple chunk files
async function processChunkFiles(sourceFiles,eventEmitter,destDir,output_tempDir,sourceDir,machineIDS) {
  sourceFiles.forEach((sourceFile,index) => {
    const fileName = path.basename(sourceFile);
    const destFile = path.join(destDir, fileName);
     readAndAppendChunkFile(sourceFile, destFile,eventEmitter,output_tempDir,index,sourceFiles.length-1,sourceDir,machineIDS);
    
   });

}

// Example usage
async function aposteriori_SOFTRULES(tmp_file_path,eventEmitter,machineIDS) {
  try {   
    const sourceDir = await create_directory(tmp_file_path)
    const output_tempDir= 'output_'+tmp_file_path
    const destDir = await create_directory(output_tempDir)
    

    // Read all source chunk files
    const sourceFiles = await create_(sourceDir)
    
   
    // Process all chunk files
   await processChunkFiles(sourceFiles,eventEmitter,destDir,output_tempDir,sourceDir,machineIDS)
  } catch (error) {
    console.error('Error processing chunk files:', error);
  }
}
async function create_(sourceDir){
  var array = fs.readdirSync(sourceDir).map(file => path.join(sourceDir, file));
  return array
} 


module.exports ={aposteriori_SOFTRULES,splitByData}
