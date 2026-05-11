

var net = require('net');


// ******************* testing example of local actor http server ****************************

const largeString = 'A'.repeat(1024 * 1024); // 1 MiB = 1024 KiB
const a=['test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh']



let i=0 
var server = net.createServer(function(socket) {
    //socket.write('33');
    
	/*var intervalle = setInterval(() => {
		        const json_frame = {
		            payload: FRAME_74_HEX,
		            format: 'hex',
		            byteLength: FRAME_74_BYTES.length,
		            sequence: i++,
		            sentAt: Date.now()
		        };
		        socket.write(JSON.stringify(json_frame));
		     
		    }, 20);*/

    socket.on('close', () => {
       // clearInterval(intervalle);
    });

var FRAME_74_BYTES 
socket.on("data", (chunk) => {
    /* false && console.log('Received data:', chunk); */ 
        setInterval(() => {
             FRAME_74_BYTES = Buffer.from(Array.from({ length: 74 }, (_, idx) => (idx + i) % 256));
         i++;
       /* false && console.log('Sending frame:', FRAME_74_BYTES, "i=",i); */ 
        socket.write(FRAME_74_BYTES)    
        
    }, 20);


     
    
    });
    
    
        

/*    socket.on('data', (data)=>{
        false && console.log('this is the data ', data.toString())
        socket.write('{"shares":["/prod/backend/tmp/asset3/asset.enc.sf-part1","/prod/backend/tmp/asset3/asset.enc.sf-part2","/prod/backend/tmp/asset3/asset.enc.sf-part3"],"key":"5b58dtNfYrqg","iv":"a43389026ca5c09ecf44df0b4acf9d2e"}');
    })
*/	
});

const HOST =  '127.0.0.2';
const PORT = Number(process.env.TCP_PORT) || 5000;

server.listen(PORT, HOST, () => {
    /* false && console.log(`server is listening on ${HOST}:${PORT}`); */ 
});

server.on('error', (err) => {
    console.error(`server failed to start on ${HOST}:${PORT}`, err.message);
    process.exit(1);
});
