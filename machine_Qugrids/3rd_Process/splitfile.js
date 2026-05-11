// split file according to Timestamp
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const os = require('os');
const create_directory= require('../largeSteps/os')
// Number of lines per chunk
const linesPerChunk = 10000;


async function split_my_file(myfilePath, myDirName){
    var tempDir= await create_directory(myDirName)
    const file1Stream = fs.createReadStream(myfilePath, { encoding: 'utf8' });
    const file1RL = readline.createInterface({
        input: file1Stream,
        crlfDelay: Infinity
      });
      let chunkIndex = 0;
      let chunkLines = [];
      let last_elements=[]
    
      for await (const line of file1RL) {
        if(line !=''){
          if (chunkLines.length >= linesPerChunk && JSON.parse(chunkLines[chunkLines.length -1]).Timestamp !=JSON.parse(line).Timestamp) {
            await writeChunkFile(chunkIndex++, chunkLines,tempDir);
            last_elements.push(chunkLines[chunkLines.length -1])
            chunkLines = [];
            chunkLines.push(line);
          }else{
    
          chunkLines.push(line);
          }

        }
      }
    
      if (chunkLines.length > 0) {
        await writeChunkFile(chunkIndex, chunkLines,tempDir);
        last_elements.push(chunkLines[chunkLines.length -1])
      }
      return last_elements

}
async function writeChunkFile(index, lines,tempDir) {
    const chunkFilePath = path.join(tempDir, `chunk_${index}.json`);
    return new Promise((resolve, reject) => {
      const chunkStream = fs.createWriteStream(chunkFilePath);
      chunkStream.on('error', reject);
      chunkStream.on('finish', resolve);
      for (const line of lines) {
        chunkStream.write(line + '\n');
      }
      chunkStream.end();
    });
  } 
async function splitothersFile(othersfilePath,last_elements_array,dirname){
    var tempDir= await create_directory(dirname)
    const othersfilePathtmp= path.join(os.tmpdir(), othersfilePath);
    const file2Stream = fs.createReadStream(othersfilePathtmp, { encoding: 'utf8' });
      const file2RL = readline.createInterface({
        input: file2Stream,
        crlfDelay: Infinity
      });
      var chunkIndex =0
      var chunkLines=[]
  
      for await (const line of file2RL) {
        if(line !=''){
          if(last_elements_array[chunkIndex]!= undefined){
            if(JSON.parse(line).Timestamp > JSON.parse(last_elements_array[chunkIndex]).Timestamp){
              await writeChunkFile(chunkIndex++, chunkLines,tempDir);
              chunkLines = [];
              chunkLines.push(line);
            }else{
              chunkLines.push(line);
            }
          }else{
            chunkLines.push(line);
          }
        }
      }
    
      if (chunkLines.length > 0) {
        await writeChunkFile(chunkIndex, chunkLines,tempDir);
      }
  
  }


async function splitbothFiles(myfile,othersfile, myDirName, otherDirName ) {
    try {
        var last_elements_array =await split_my_file(myfile,myDirName);
        await splitothersFile(othersfile,last_elements_array,otherDirName);
        
    
       
      } catch (err) {
        console.error('Error processing files:', err);
      }


} 
module.exports= splitbothFiles