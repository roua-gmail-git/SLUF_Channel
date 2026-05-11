const fs = require('fs');
const readline = require('readline');
const path = require('path');
const zlib = require('zlib');
const create_directory= require('./os')

//  The Sorting function sort the file entries based on the Timestamp, split them into chunks and write them into multiple file to process them faster



async function sortAndWriteChunks(readStream, chunkSize,file_path,eventEmitter) {
  // Directory for temporary files
  const tempDir= await create_directory(file_path)
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
  });

  let lines = [];
  let chunkIndex = 0;
  for await (const line of rl) {
    if(line !=''){
      if (lines.length >= chunkSize && JSON.parse(lines[lines.length -1]).Timestamp !=JSON.parse(line).Timestamp ) {
      lines.sort((a, b) => JSON.parse(a).Timestamp - JSON.parse(b).Timestamp);
      fs.writeFileSync(path.join(tempDir, `chunk_${chunkIndex}.json`), lines.join('\n'));
      chunkIndex++;
      lines = [];
      lines.push(line);
    }else{
      lines.push(line);

    }
    

    }
  }

  if (lines.length > 0) {
    lines.sort((a, b) => JSON.parse(a).Timestamp - JSON.parse(b).Timestamp);
    fs.writeFileSync(path.join(tempDir, `chunk_${chunkIndex}.json`), lines.join('\n'));
  }
  eventEmitter.emit('ChunkedAndSorted',(file_path))
}



function Sorting(inputFile, tmp_directory_path ,eventEmitter){ 
  const fileExtension = path.extname(inputFile);
  let readStream
  if (fileExtension === '.gz') {
    /* false && console.log(inputFile) */
     readStream = fs.createReadStream(inputFile).pipe(zlib.createGunzip());
  }else{
     readStream = fs.createReadStream(inputFile);

  }
  // Example usage
  sortAndWriteChunks(readStream, 10000, tmp_directory_path,eventEmitter)  // Using a small chunk size for this example
     .then(() => {/* false && console.log('Chunks sorted and written to temporary files.'); */ })
     .catch(err => console.error('Error sorting chunks:', err));

}
  
module.exports= Sorting
