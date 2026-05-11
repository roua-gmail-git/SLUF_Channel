
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
 *       this class let the machine start listening to connections from the external local actor which is going to send the data (it depends on the connection type given in the configuration file)
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
        if(rule_type != undefined){
            /* false && console.log('[LOCAL][TCP-SERVER] framing mode forced to C37.118 stream parsing; ignoring config ruleType=',rule_type,' rule=',rule); */ 
        }
        const listen_port = Number(this.config_file.localRepliePort) || 5001
        const socket_state = new Map()
        const get_socket_state = (socket) => {
            let state = socket_state.get(socket)
            if(state == undefined){
                state = {buffer: Buffer.alloc(0), frame_counter: 0, closed: false}
                socket_state.set(socket, state)
            }
            return state
        }
        const emit_c37118_frame = (socket,state,frame_buffer) => {
            state.frame_counter++
            const frame_header = parse_c37118_frame_header(frame_buffer)
            if(frame_header != undefined){
                /* false && console.log(
                    '[LOCAL][TCP-SERVER] frame=',state.frame_counter,
                    ' type=',frame_header.frame_type,
                    ' size=',frame_header.frame_size,
                    ' id=',frame_header.id_code,
                    ' soc=',frame_header.soc,
                    ' (',soc_to_utc_text(frame_header.soc),')',
                    ' fracsec=0x'+frame_header.fracsec.toString(16).toUpperCase().padStart(8,'0')
                ); */ 
            }else{
                /* false && console.log('[LOCAL][TCP-SERVER] frame=',state.frame_counter,' invalid header; rawBytes=',frame_buffer.length); */ 
            }
            this.localsocket = socket
            let event_title = (this.streaming == false) ? "LocalActor_data": "Stream_Actor_data";
            /* false && console.log('i got the data before meit',frame_buffer); */ 
            this.eventEmitter.emit(event_title,Buffer.from(frame_buffer))
        }
        const close_socket_connection = (socket,reason,error) => {
            const state = get_socket_state(socket)
            if(state.closed == true){
                return
            }
            state.closed = true
            state.buffer = Buffer.alloc(0)
            if(this.localsocket === socket){
                this.localsocket = undefined
            }
            if(error != undefined){
                /* false && console.log('[LOCAL][TCP-SERVER] socket closed reason=',reason,' error=',error.message); */ 
            }else{
                /* false && console.log('[LOCAL][TCP-SERVER] socket closed reason=',reason); */ 
            }
            if(socket.destroyed == false){
                socket.destroy()
            }
            socket_state.delete(socket)
        }

        var server= net.createServer(function(socket){
            socket.setNoDelay(true)
            socket.setKeepAlive(true)
            this.localsocket = socket
            get_socket_state(socket)
            socket.on('data',(data)=> {
                const state = get_socket_state(socket)
                const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data)
                state.buffer = Buffer.concat([state.buffer, chunk])
                const extracted = extract_c37118_frames(state.buffer)
                state.buffer = extracted.remaining
                for(const frame of extracted.frames){
                    emit_c37118_frame(socket,state,frame)
                }
            })
            
            socket.on('timeout', () => {
                close_socket_connection(socket,'timeout')
            })
            socket.on('end', () => {
                close_socket_connection(socket,'end')
            })
            socket.on('close', () => {
                close_socket_connection(socket,'close')
            })
            socket.on('error',(e)=>{
                close_socket_connection(socket,'error',e)
            })
        }.bind(this))
        server.listen(listen_port,this.myIP,()=>{/* false && console.log('server is listening on tcp://'+ this.myIP+':'+ listen_port +'/'); */ });
    }
   
    http_connection(){
        var server = http.createServer((req,res)=>{
            this.localsocket = res
            var data=''
            req.on('data',(chunk)=>{
                data+=chunk
            })
            req.on('end',()=>{
                this.eventEmitter.emit('LocalActor_data',data)
            })
        })
        server.listen(this.config_file.LocalActorPort,this.myIP,()=>{ /* console.log('server is listening on http://'+ this.myIP+':'+ this.config_file.LocalActorPort +'/'); */ });
    }
}

module.exports= LocalActor_Connection
