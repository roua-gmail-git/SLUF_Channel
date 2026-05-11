var i =0
var net= require('net');

// ******************* testing example of local actor tcp client ****************************




const a=['test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh','test','mmmm','fcgchgh']

const largeString = 'A'.repeat(1024 * 1024); // 1 MiB = 1024 KiB


var client= new net.Socket();
client.connect(5000,'127.0.0.2')
client.on('connect',()=>{
    setInterval(() => {
        client.write(largeString)
        i++
    }, 5000);
})

client.on('data',(data)=>{
    /* false && console.log(data.toString()) */
})
