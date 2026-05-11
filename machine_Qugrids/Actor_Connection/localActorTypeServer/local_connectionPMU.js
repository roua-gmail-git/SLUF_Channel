
const net =require('net')
var http = require('http');

function extract_c37118_frames(buffer){
    let working_buffer = buffer
    const frames = []
    while(true){
        if(working_buffer.length < 4){
            break
        }

        const sync_start = working_buffer.indexOf(0xAA)
        if(sync_start < 0){
            working_buffer = Buffer.alloc(0)
            break
        }
        if(sync_start > 0){
            working_buffer = working_buffer.subarray(sync_start)
        }
        if(working_buffer.length < 4){
            break
        }

        const frame_size = working_buffer.readUInt16BE(2)
        if(frame_size < 14){
            working_buffer = working_buffer.subarray(1)
            continue
        }
        if(working_buffer.length < frame_size){
            break
        }

        frames.push(Buffer.from(working_buffer.subarray(0, frame_size)))
        working_buffer = working_buffer.subarray(frame_size)
    }

    return {frames, remaining: Buffer.from(working_buffer)}
}

function parse_c37118_frame_header(frame_buffer){
    if(frame_buffer == undefined || frame_buffer.length < 14){
        return undefined
    }
    const sync = frame_buffer.readUInt16BE(0)
    return {
        sync: sync,
        frame_size: frame_buffer.readUInt16BE(2),
        id_code: frame_buffer.readUInt16BE(4),
        soc: frame_buffer.readUInt32BE(6),
        fracsec: frame_buffer.readUInt32BE(10),
        checksum: frame_buffer.readUInt16BE(frame_buffer.length - 2),
        frame_type: (sync >> 4) & 0x7
    }
}

function soc_to_utc_text(soc){
    const date = new Date(soc * 1000)
    if(Number.isNaN(date.getTime())){
        return 'invalid UTC'
    }
    const pad2 = (value) => String(value).padStart(2, '0')
    return (
        date.getUTCFullYear() + '-' +
        pad2(date.getUTCMonth() + 1) + '-' +
        pad2(date.getUTCDate()) + ' ' +
        pad2(date.getUTCHours()) + ':' +
        pad2(date.getUTCMinutes()) + ':' +
        pad2(date.getUTCSeconds()) + ' UTC'
    )
}

/**
 * @brief LocalActor_Connection
 *       this class connects this machine to the external local actor that is going to send the data
 * 
 */

class LocalActor_Connection{
    constructor(connectionType,config_file, eventEmitter,myIP,streaming){
        this.config_file= config_file
        this.connectionType = connectionType
        this.eventEmitter = eventEmitter
        this.localsocket 
        this.myIP=myIP
        this.streaming =streaming
        this.applie_Connection()

        

    }
    applie_Connection(){
        if(this.connectionType == "TCP_Size"){this.TCP_connection(this.config_file.TCP_SizeBytes,"Size")}
        else if (this.connectionType == "TCP_Timer"){this.TCP_connection(this.config_file.TCP_Timer_InMS,"Timer")}
        else{this.http_connection()}
    }
    TCP_connection(rule,rule_type){ 
        const local_actor_host = this.config_file.LocalActorHost || process.env.MACHINE_QUGRIDS_LOCAL_ACTOR_HOST || '127.0.0.2'
        const local_actor_port = Number(this.config_file.LocalActorPort) || 5000
        const reconnect_delay_ms = Math.max(100, Number(process.env.MACHINE_QUGRIDS_LOCAL_ACTOR_RECONNECT_MS) || 1000)
        let reconnect_timer
        if(rule_type != undefined){
            /* false && console.log('[LOCAL][TCP] framing mode forced to C37.118 stream parsing; ignoring config ruleType=',rule_type,' rule=',rule); */ 
        }
        const schedule_reconnect = () => {
            if(reconnect_timer != undefined){
                return
            }
            reconnect_timer = setTimeout(() => {
                reconnect_timer = undefined
                connect_to_local_actor()
            }, reconnect_delay_ms)
        }
        const connect_to_local_actor = () => {
            let data_buffer = Buffer.alloc(0)
            let client = new net.Socket()
            client.setMaxListeners(0)
            let connection_closed = false
            let frame_counter = 0
            const close_connection = (reason,error) => {
                if(connection_closed == true){
                    return
                }
                connection_closed = true
                data_buffer = Buffer.alloc(0)
                if(this.localsocket === client){
                    this.localsocket = undefined
                }
                if(error != undefined){
                    /* false && console.log('[LOCAL][TCP] connection closed reason=',reason,' error=',error.message); */ 
                }else{
                    /* false && console.log('[LOCAL][TCP] connection closed reason=',reason); */ 
                }
                if(client.destroyed == false){
                    client.destroy()
                }
                schedule_reconnect()
            }
            const emit_c37118_frame = (frame_buffer) => {
                frame_counter++
                const frame_header = parse_c37118_frame_header(frame_buffer)
                if(frame_header != undefined){
                    /* false && console.log(
                        '[LOCAL][TCP] frame=',frame_counter,
                        ' type=',frame_header.frame_type,
                        ' size=',frame_header.frame_size,
                        ' id=',frame_header.id_code,
                        ' soc=',frame_header.soc,
                        ' (',soc_to_utc_text(frame_header.soc),')',
                        ' fracsec=0x'+frame_header.fracsec.toString(16).toUpperCase().padStart(8,'0')
                    ); */ 
                }else{
                    /* false && console.log('[LOCAL][TCP] frame=',frame_counter,' invalid header; rawBytes=',frame_buffer.length); */ 
                }
                client.emit('LocalActor_data', Buffer.from(frame_buffer))
            }
            client.setNoDelay(true)
            client.setKeepAlive(true)
            this.localsocket = client
            client.connect(local_actor_port, local_actor_host)
            client.on('data',function(data){ 
                /* false && console.log(data) */
                const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data)
                data_buffer = Buffer.concat([data_buffer, chunk])
                const extracted = extract_c37118_frames(data_buffer)
                data_buffer = extracted.remaining
                for(const frame of extracted.frames){
                    //console.log(frame)
                    emit_c37118_frame(frame)
                }
            })
            var i=0
            client.on('LocalActor_data',(data)=>{
                let event_title = (this.streaming == false) ? "LocalActor_data": "Stream_Actor_data";
                /* false && console.log('i got the data before meit',data, "i=",i++); */ 
                setImmediate(() => {
                    this.eventEmitter.emit(event_title,{
                        DataSource: 'PMU',
                        payload: data
                    });
                });
            })
            client.on('error',(e)=>{close_connection('error',e)})
            client.on('end', () => {close_connection('end')})
            client.on('close', () => {close_connection('close')});
        }
        connect_to_local_actor()



    }
   
    http_connection(){
        const options = {
            hostname: this.myIP,
            port: this.config_file.LocalActorPort,
            path: '/',
            method: 'POST',
        };
        setInterval(() => {
            /* false && console.log('getting data from external actor'); */ 
            var req= http.request(options,(res)=>{
                res.setMaxListeners(0)
                let data=''
                  res.on('data',(chunk)=>{data+= chunk;})
                  res.on('end',()=>{
                      /* false && console.log('this is ',data); */ 
                     // this.eventEmitter.emit('LocalActor_data',data)
                    })
                  })
             req.setMaxListeners(0)
             this.localsocket = req
              req.write('')
              req.on('error', function(e) {
                  console.error('http local actor SERVER is not there');
                  
                });
        }, 500);
    }
}

module.exports= LocalActor_Connection
