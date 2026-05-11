const fs = require('fs');
const readline = require('readline');
const path = require('path');
var events = require('events');
const os = require('os');
const create_directory = require('../largeSteps/os');
const cleanUpTempFiles= require('../largeSteps/clean')

// Helper function to process and append each line
async function processAndAppendLine(lines, destFilePath,JudgeObject,output_tempDir,index,sourceFiles_length,sourceDir) {
 
  const writeStream = fs.createWriteStream(destFilePath, { flags: 'a', encoding: 'utf8' });
  var process_eventEmitter = new events.EventEmitter() 
  let trans_ACK_array = await JudgeObject.AllRules(lines)
  process_eventEmitter.on('start_Writing',(ordered_array)=>{
    let missingFromrrealarray = trans_ACK_array.filter(val => !ordered_array.includes(val));
    JudgeObject.append_errors_to_File( missingFromrrealarray,'Standard Deviation Exam: ')
    var trans_ACK_array_string=ordered_array.map(item =>JSON.stringify(item))
    let trans_ACK_data= trans_ACK_array_string.join('\n')
    writeStream.write(trans_ACK_data +'\n')
    writeStream.end()
    writeStream.on('error',(err)=>{/* false && console.log('there is an error', err) */} );
    writeStream.on('finish',()=>{
      if(index == sourceFiles_length){
        JudgeObject.Judge_evenEmitter.emit('RulesApplied', (output_tempDir));
        cleanUpTempFiles(sourceDir)
      }
    });
  
  })
  JudgeObject.applie_APOSTERIORI_SoftRules(trans_ACK_array,process_eventEmitter)
  


   
}

// Function to read a chunk file and append lines to the destination file
async function readAndAppendChunkFile(sourceFilePath, destFilePath,JudgeObject,output_tempDir,index,sourceFiles_length,sourceDir) {
  
  const lineReader = readline.createInterface({
      input: fs.createReadStream(sourceFilePath, 'utf8'),
      crlfDelay: Infinity,
    });
    var lines=[]

    lineReader.on('line', async (line) => {
      if(line !=''){lines.push(line)}
    });

   lineReader.on('close', ()=>{ 
    processAndAppendLine(lines, destFilePath,JudgeObject,output_tempDir,index,sourceFiles_length,sourceDir);} );
    lineReader.on('error', (err)=>{/* false && console.log(err) */});
 
}

// Main function to process multiple chunk files
async function processChunkFiles(sourceFiles,JudgeObject,destDir,output_tempDir,sourceDir) {
   sourceFiles.forEach((sourceFile,index) => {
    
    const fileName = path.basename(sourceFile);
    const destFile = path.join(destDir, fileName);
     readAndAppendChunkFile(sourceFile, destFile,JudgeObject,output_tempDir,index,sourceFiles.length-1,sourceDir);
    
   });

}

// Example usage
async function applyRulesONchunks(tmp_file_path,JudgeObject) {
  try {   
    const sourceDir = await create_directory(tmp_file_path)
    const output_tempDir= 'output_'+tmp_file_path
    const destDir = await create_directory(output_tempDir)
    

    // Read all source chunk files
    const sourceFiles = await create_(sourceDir)
    if(sourceFiles.length== 0){/* false && console.log('there is no data in the file '); */ cleanUpTempFiles(sourceDir);cleanUpTempFiles(destDir)}
    else{  // Process all chunk files
      await processChunkFiles(sourceFiles,JudgeObject,destDir,output_tempDir,sourceDir)
    }
  } catch (error) {
    console.error('Error processing chunk files:', error);
  }
}
async function create_(sourceDir){
  var array = fs.readdirSync(sourceDir).map(file => path.join(sourceDir, file));
  return array
} 


module.exports =applyRulesONchunks
