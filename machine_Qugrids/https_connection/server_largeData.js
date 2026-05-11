
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const zlib = require('zlib');

function resolve_transport_protocol(options){
    const protocol = typeof options === 'string' ? options : options?.transportProtocol ?? options?.protocol;
    const normalized_protocol = String(protocol ?? 'HTTPS').trim().toUpperCase();
    if(normalized_protocol !== 'HTTP' && normalized_protocol !== 'HTTPS'){
        throw new Error('Unsupported large-data communication transport: ' + normalized_protocol);
    }
    return normalized_protocol;
}

function resolve_tls_server_paths(){
    const key_path = process.env.MACHINE_QUGRIDS_TLS_KEY_PATH
        || path.join(__dirname, 'tls', 'server-key.pem');
    const cert_path = process.env.MACHINE_QUGRIDS_TLS_CERT_PATH
        || path.join(__dirname, 'tls', 'server-cert.pem');

    if (fs.existsSync(key_path) === false || fs.existsSync(cert_path) === false) {
        throw new Error(
            '[HTTPS] Missing TLS files.\n'
            + 'Expected key: ' + key_path + '\n'
            + 'Expected cert: ' + cert_path + '\n'
            + 'Set MACHINE_QUGRIDS_TLS_KEY_PATH and MACHINE_QUGRIDS_TLS_CERT_PATH if needed.'
        );
    }

    return { key_path, cert_path };
}

class ServerOFlargeData{
    constructor(port,ip,eventEmitter,options){
        this.port=port
        this.ip=ip
        this.eventEmitter=eventEmitter
        this.transportProtocol = resolve_transport_protocol(options)
        this.createServer()
        this.events()
       
    }
    createServer(){
        let server
        if(this.transportProtocol === 'HTTP'){
          server = http.createServer(app)
        }else{
          const tls_paths = resolve_tls_server_paths()
          server = https.createServer({
            key: fs.readFileSync(tls_paths.key_path),
            cert: fs.readFileSync(tls_paths.cert_path)
          }, app)
        }
        server.listen(this.port,this.ip,() => {
            /* false && console.log(`Server for largeData is running at http://${this.ip}:${this.port}`); */ 
          });

    }
    events(){
      app.get('/SendFileData',(req, res) => {
        this.eventEmitter.emit('SendingFileData',(res))})
      app.post('/StreamData',(req, res) => {
          this.postData(req)
        })
      }
     postData(req){
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
  
      // When all data is received
      req.on('end', () => {
        /* false && console.log('Received data:', data.length, 'bytes'); */ 
        this.eventEmitter.emit('GotStreamData', (data))

      });
      req.on('error', err => {
        console.error('Error receiving data:', err);
      });
     } 
    sendBackdata(res, file){
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'gzip',
            'Content-Disposition': 'attachment; filename="output.txt.gz"',
          });
          // Create a readable stream from the file
          const readStream = fs.createReadStream(file.path);
          // Create a gzip transform stream
          const gzip = zlib.createGzip();
        
          // Pipe the read stream through gzip and then to the response
          readStream.pipe(gzip).pipe(res);
        
          // Handle errors
          readStream.on('error', (err) => {
            console.error('Error reading file:', err);
            //res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          });
        
          res.on('close', () => {
            /* false && console.log('Response closed by client.'); */ 
          });
          
    }

}
module.exports= ServerOFlargeData
