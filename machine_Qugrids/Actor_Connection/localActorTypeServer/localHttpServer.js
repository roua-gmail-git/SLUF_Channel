// ******************* testing example of local actor http client ****************************

//server sending
var http = require('http');
let i=0 
const a=['test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh']

var server = http.createServer((req,res)=>{
    res.end(a[i])
    i++
    
   var data=''
    req.on('data',(chunk)=>{
        data+=chunk
        
        
    })
    req.on('end',()=>{
       /* false && console.log(data) */
        
    })
})
server.listen(5000,()=>{/* false && console.log('server is listening on port 5000') */});