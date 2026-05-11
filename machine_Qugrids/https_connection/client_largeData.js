const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path_module = require('path');
var events = require('events');
const app = express();
const { Readable } = require('stream');

const zlib = require('zlib');

function resolve_transport_protocol(options){
    const protocol = typeof options === 'string' ? options : options?.transportProtocol ?? options?.protocol;
    const normalized_protocol = String(protocol ?? 'HTTPS').trim().toUpperCase();
    if(normalized_protocol !== 'HTTP' && normalized_protocol !== 'HTTPS'){
        throw new Error('Unsupported large-data communication transport: ' + normalized_protocol);
    }
    return normalized_protocol;
}

function resolve_tls_client_options(){
    const reject_unauthorized_value = process.env.MACHINE_QUGRIDS_TLS_REJECT_UNAUTHORIZED;
    const reject_unauthorized =
        reject_unauthorized_value == undefined
            ? false
            : String(reject_unauthorized_value).toLowerCase() === 'true';

    const ca_path = process.env.MACHINE_QUGRIDS_TLS_CA_PATH
        || path_module.join(__dirname, 'tls', 'server-cert.pem');

    return {
        rejectUnauthorized: reject_unauthorized,
        caPath: fs.existsSync(ca_path) === true ? ca_path : undefined
    };
}


class ClientOFlargeData{
    constructor(eventEmitter, options){
        this.eventEmitter=eventEmitter
        this.transportProtocol = resolve_transport_protocol(options)
        this.transport = this.transportProtocol === 'HTTP' ? http : https
        const agent_options = {
          keepAlive: true
        }
        if(this.transportProtocol === 'HTTPS'){
          const tls_options = resolve_tls_client_options()
          agent_options.rejectUnauthorized = tls_options.rejectUnauthorized
          if(tls_options.caPath != undefined){
            agent_options.ca = fs.readFileSync(tls_options.caPath)
          }
        }
        this.agent = new this.transport.Agent(agent_options)
    }
    
    send_getlargeData(ip,port,path,file_name){// sending get request to the others to get their data
      var options =this.create_fileoptions(path,ip,port,'GET')
      this.get_request(options,file_name);
    }
    get_request(options,file_name){
      // Make an HTTP request
      const req = this.transport.request(options, (res) => {
        // Check for gzip encoding
        const encoding = res.headers['content-encoding'];
          const file_path= './Files/Auditor_Files/beforeMerging/'+file_name

        if (encoding === 'gzip') {
          /* false && console.log('Response is gzip encoded.'); */ 
      
          // Create a writable stream to save the file
          const fileStream = fs.createWriteStream(file_path+'.txt.gz');
      
          // Pipe the response stream to the writable stream
          res.pipe(fileStream);
      
          fileStream.on('finish', () => {
            /* false && console.log('File received and saved in a zip form.'); */  
             this.eventEmitter.emit('Got_fileData',(file_path))
            // Decompress the file after receiving
           /* fs.createReadStream(file_path+'.txt.gz')
              .pipe(zlib.createGunzip())
              .pipe(fs.createWriteStream(file_path+'.txt'))
              .on('finish', () => {
                false && console.log('File decompressed.', file_path);
              });*/
          });
      
          fileStream.on('error', (err) => {
            console.error('Error writing to file:', err);
          });
      
        } else {
          /* false && console.log('Unexpected encoding:', encoding); */ 
        }
        res.on('end', () => {
          /* false && console.log('No more data in response client large data get req',file_name); */ 
        
        });
      });

      req.on('error', (err) => {
        console.error('Request error:', err);
      });
      
      // End the request
      req.end();
      
      

    }
    send_postlargeData(ip,port,path,data){// sending get request to the others to get their data
      var options =this.create_dataoptions(path,ip,port,'POST',data)
      this.post_request(options,data);
    }
    post_request(options,data){
      const req = this.transport.request(options, res => {
       /* let responseData = '';
      
        res.on('data', chunk => {
          responseData += chunk;
        });
      
        res.on('end', () => {
          false && console.log('Server response:', responseData);
        });*/
      });
      
      // Handle request errors
      req.on('error', err => {
        console.error('Request error:', err);
      });
      
      // Send the large string
      req.write(data);
      req.end();
      

    }

    create_fileoptions(path,ip,port,request_type){
        var options = {
            hostname:ip,
            port:   port,
            path: '/'+path,
            method: request_type,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'gzip',
              'Content-Disposition': 'attachment; filename="output.txt.gz"',
            },
            agent: this.agent
           };
           return options
    }
    create_dataoptions(path,ip,port,request_type,data){
        var options = {
            hostname:ip,
            port:   port,
            path: '/'+path,
            method: request_type,
            headers: {
              'Content-Type': 'text/plain',
              'Content-Length': Buffer.byteLength(data)
            },
            agent: this.agent
           };
           return options
    }

}

module.exports= ClientOFlargeData
