const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
// Main function to process all chunks
async function processChunks(outputfile,mytempDir,othertempdir , eventEmitter) {
    // Directories and file paths
    const file1ChunksDir = path.join(os.tmpdir(), mytempDir);
    const file2ChunksDir = path.join(os.tmpdir(), othertempdir);
    const resultFilePath = outputfile
    

  const file1Chunks = await create_(file1ChunksDir);
  const file2Chunks = await create_(file2ChunksDir);
  

  const resultStream = fs.createWriteStream(resultFilePath, { flags: 'a' });

  try {
    const minChunks = Math.min(file1Chunks.length, file2Chunks.length);
    for (let i = 0; i < minChunks; i++) {
      await compareChunks(file1Chunks[i], file2Chunks[i], resultStream);
    }
    if (file2Chunks.length > file1Chunks.length) {
      for (let i = file1Chunks.length; i < file2Chunks.length; i++) {
        await appendExtraChunks(file2Chunks[i], resultStream);
      }
    }
  } catch (error) {
    console.error('Error processing chunks:', error);
  } finally {
    resultStream.end();
    
    eventEmitter.emit('mergingISdone')
  }
}
async function create_(tempDir){
    var array =[]
    const files = fs.readdirSync(tempDir);
    for(let i=0 ;i< files.length ; i++){
        const filePath = path.join(tempDir, `chunk_${i}.json`);
        array.push(filePath)
    }
      return array
  
  
  }
// Compare lines from file2 chunks to file1 chunks
async function compareChunks(file1ChunkPath, file2ChunkPath, resultStream) {
    const file1Iterator = createAsyncIterator(file1ChunkPath);
    const file1LinesSet = new Set();
  
    // Read all lines from file1 chunk and store in a Set
    for await (const line of file1Iterator) {
      file1LinesSet.add(line);
    }
  
    // Read lines from file2 chunk and check if they are in the Set
    const file2Iterator = createAsyncIterator(file2ChunkPath);
    for await (const line of file2Iterator) {
      if (!file1LinesSet.has(line)) {
        resultStream.write(line + '\n');
      }
    }
  }
  // Create an AsyncIterator for a file stream
async function* createAsyncIterator(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
  
    for await (const line of rl) {
      yield line;
    }
  }
async function appendExtraChunks(file2ChunkPath, resultStream) {
    const file2Iterator = createAsyncIterator(file2ChunkPath);
    for await (const line of file2Iterator) {
      resultStream.write(line + '\n');
    }
  }
module.exports = processChunks