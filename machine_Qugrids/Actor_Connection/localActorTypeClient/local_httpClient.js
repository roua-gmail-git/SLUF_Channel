let i=0 
var http = require('http');

// ******************* testing example of local actor http client ****************************


const a=['test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh']

function write(msg){
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/',
        method: 'POST'
    };
    
    var req= http.request(options,(res)=>{
        
        let data=''
        res.on('data',(chunk)=>{data+= chunk;})
        res.on('end',()=>{
            /* false && console.log('this is ',data) */
        })
        
    
    })
      req.write(msg)
    
    
    req.end();
    req.on('error', function(e) {
        console.error('http local actor is not there', e);
        
      });
    
}
var intervalle = setInterval(() => {
    if(i< a.length){
      write(a[i])
      
      i++
  
    }else{
      clearInterval(intervalle)
    }
    
  }, 500);

//client
