const fs = require('fs');
const readline = require('readline');
const create_directory = require('./os');
let crypto = require('crypto');
const cleanUpTempFiles = require('./clean');

// merging function merge two file (temporary transaction and Replie files ) into one sorted, ordered file

async function merging(trans_file,Ack_file,outputFile,eventEmitter,trans_dir_name,ack_dir_name,machineIDS){
    
    const transtempDir = await create_directory(trans_dir_name)
    const acktempDir = await create_directory(ack_dir_name)
    const transfile= transtempDir +'/'+trans_file
    const Ackfile= acktempDir +'/'+Ack_file

    const ackLinesMap = new Map();

    // Read Ackfile and store lines in a map for quick lookup
    const ackStream = fs.createReadStream(Ackfile);
    const ackRl = readline.createInterface({
        input: ackStream,
        crlfDelay: Infinity,
    });

    for await (const line of ackRl) {
        if (line !== '') {
            const parsedLine = JSON.parse(line);
            const key = `${parsedLine.Timestamp}-${parsedLine.Replier}`;
            ackLinesMap.set(key, line);
        }
    }

    // Read transfile and find matches in the ackLinesMap
    const transStream = fs.createReadStream(transfile);
    const transRl = readline.createInterface({
        input: transStream,
        crlfDelay: Infinity,
    });

    const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });

    for await (const line of transRl) {
        if (line !== '') {
            var counter =0
            const parsedLine = JSON.parse(line);
            for(let i=0; i<machineIDS.length ; i++){
                if(machineIDS[i] != parsedLine.Requester){
                    const key = `${parsedLine.Timestamp}-${machineIDS[i]}`;
                if (ackLinesMap.has(key)&& counter ==0) {
                    counter++
                    writeStream.write(JSON.stringify(parsedLine) + '\n' + ackLinesMap.get(key) + '\n');
                 }else if(ackLinesMap.has(key)&& counter !=0){
                    writeStream.write(ackLinesMap.get(key) + '\n');
                }
                }
            }
            
        }
    }

    // Close the stream after writing all data
    writeStream.end(() => {
        /* false && console.log('Data has been written to the file.'); */ 
        eventEmitter.emit('mergingTransAckDone');
        //cleanUpTempFiles(transtempDir)
        //cleanUpTempFiles(acktempDir)
    });

    // Handle errors
    writeStream.on('error', (err) => {
        console.error('Error writing to the file:', err);
    });
}






module.exports= merging