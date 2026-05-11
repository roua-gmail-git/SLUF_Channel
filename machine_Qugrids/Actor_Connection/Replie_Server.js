
var http = require('http');

function ReplieServer(ip , port ,eventEmitter){
        var server = http.createServer((req,res)=>{
            var data=''
            req.on('data',(chunk)=>{
                data+=chunk
            })
            req.on('end',()=>{
                eventEmitter.emit('localReplie',data)
            })
        })
        server.listen(port,ip,()=>{/* false && console.log('server is listening on http://'+ ip+':'+port+'/') */});
    

}


module.exports=ReplieServer