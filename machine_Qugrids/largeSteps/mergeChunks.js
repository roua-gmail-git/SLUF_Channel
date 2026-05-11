const fs = require('fs');
const readline = require('readline');
const path = require('path');
const create_directory = require('./os');
const MinHeap =require('./minHeap');
const cleanUpTempFiles = require('./clean');

// sortDeleteMergeChunks takes the chunks sort , delete duplicates and merge them into one file 


async function sortDeleteMergeChunks(outputFile_name,tmp_file_path,outputFile_dirname,eventEmitter) {

    const tempDir = await create_directory(tmp_file_path)
    const output_tempDir = await create_directory(outputFile_dirname)
    var outputFile = output_tempDir+'/'+outputFile_name

    try {
      const chunkFiles = fs.readdirSync(tempDir).map(file => path.join(tempDir, file));
      const writeStream = fs.createWriteStream(outputFile);
  
      // Set to track unique lines
      const uniqueLines = new Set();
  
      // Open a read stream for each chunk file
      const streams = chunkFiles.map(file => readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity
      }));
  
      const lineIterator = streams.map(stream => stream[Symbol.asyncIterator]());
      const minHeap = new MinHeap();
  
      // Initialize min heap with first unique lines from each stream
      for (let i = 0; i < lineIterator.length; i++) {
        const { value, done } = await lineIterator[i].next();
        if (!done && !uniqueLines.has(value)) {
          if(value !=''){
            uniqueLines.add(value);
            const parsedLine = JSON.parse(value);
            minHeap.insert({ line: value, timestamp: parsedLine.Timestamp, streamIndex: i });
          }
        }
      }
  
      while (minHeap.size() > 0) {
        const { line, streamIndex } = minHeap.extractMin();
        writeStream.write(line + '\n');
  
        let next;
        do {
          next = await lineIterator[streamIndex].next();
        } while (!next.done && uniqueLines.has(next.value));
  
        if (!next.done) {
          uniqueLines.add(next.value);
          const parsedLine = JSON.parse(next.value);
          minHeap.insert({ line: next.value, timestamp: parsedLine.Timestamp, streamIndex });
        }
      }
  
      writeStream.end(()=>{
       eventEmitter.emit('ChunksSorted_duplicatesRemoved_Merged',(outputFile_dirname))
       cleanUpTempFiles(tempDir)
      });
      /* false && console.log('Chunks sorted, duplicates removed, and merged into file:', outputFile); */ 
    } catch (err) {
      console.error('Error processing chunks:', err);
    }
  }

  module.exports= sortDeleteMergeChunks