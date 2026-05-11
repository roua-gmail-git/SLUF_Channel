const net = require('net')
const http = require('http')
const { StringDecoder } = require('string_decoder')

const C37118_SYNC_WORD = 0xaa01
const C37118_HEADER_SIZE = 14
const C37118_TRAILER_SIZE = 2
const C37118_MAX_PAYLOAD_BYTES = 0xffff - C37118_HEADER_SIZE - C37118_TRAILER_SIZE
const PMU_READING_COUNT_SIZE = 2
const PMU_READING_VALUE_SIZE = 4
const PMU_READING_FIELD_COUNT = 4
const PMU_READING_SIZE = PMU_READING_VALUE_SIZE * PMU_READING_FIELD_COUNT

function crc16_ccitt_false(buffer){
    let crc = 0xffff
    for(let index = 0; index < buffer.length; index++){
        crc ^= buffer[index] << 8
        for(let bit = 0; bit < 8; bit++){
            if(crc & 0x8000){
                crc = ((crc << 1) ^ 0x1021) & 0xffff
            }else{
                crc = (crc << 1) & 0xffff
            }
        }
    }
    return crc
}

function resolve_timestamp_ms(message_object){
    const candidate = Number(message_object?.timestamp)
    if(Number.isFinite(candidate) && candidate >= 0){
        return candidate
    }
    return Date.now()
}

function resolve_id_code(config_file){
    const candidate = Number(config_file?.C37118_ID_CODE)
    if(Number.isInteger(candidate) && candidate >= 0 && candidate <= 0xffff){
        return candidate
    }
    return 1
}

function normalize_smu_payload_buffer(data_buffer){
    const json_text = Buffer.from(data_buffer).toString('utf8')
    return JSON.parse(json_text)
}

function normalize_measurement_value(value, reading_name, field_name){
    const numeric_value = Number(value)
    if(Number.isFinite(numeric_value)){
        return numeric_value
    }
    throw new Error(
        'SMU reading ' +
        reading_name +
        ' is missing a numeric ' +
        field_name +
        ' value'
    )
}

function read_measurement_fields(reading_name, reading_value){
    if(Array.isArray(reading_value)){
        const field_map = new Map()
        for(const entry of reading_value){
            if(Array.isArray(entry) === false || entry.length < 2){
                continue
            }
            if(typeof entry[0] !== 'string' || entry[0].length === 0){
                continue
            }
            field_map.set(entry[0], entry[1])
        }
        return {
            magnitude: normalize_measurement_value(field_map.get('magnitude'), reading_name, 'magnitude'),
            phase: normalize_measurement_value(field_map.get('phase'), reading_name, 'phase'),
            frequency: normalize_measurement_value(field_map.get('frequency'), reading_name, 'frequency'),
            rocof: normalize_measurement_value(field_map.get('rocof'), reading_name, 'rocof'),
        }
    }

    if(reading_value != null && typeof reading_value === 'object'){
        return {
            magnitude: normalize_measurement_value(reading_value.magnitude, reading_name, 'magnitude'),
            phase: normalize_measurement_value(reading_value.phase, reading_name, 'phase'),
            frequency: normalize_measurement_value(reading_value.frequency, reading_name, 'frequency'),
            rocof: normalize_measurement_value(reading_value.rocof, reading_name, 'rocof'),
        }
    }

    throw new Error('SMU reading ' + reading_name + ' has an unsupported format')
}

function extract_ordered_measurements(message_object){
    const measurements = Object.entries(message_object)
        .filter(([field_name]) => /^reading\d+$/i.test(field_name))
        .sort((left, right) => {
            const left_index = Number(left[0].replace(/\D+/g, ''))
            const right_index = Number(right[0].replace(/\D+/g, ''))
            return left_index - right_index
        })
        .map(([field_name, field_value]) => read_measurement_fields(field_name, field_value))

    if(measurements.length === 0){
        throw new Error('SMU payload does not contain any readingN measurement blocks')
    }

    return measurements
}

function build_binary_measurement_payload(message_object){
    const measurements = extract_ordered_measurements(message_object)
    const payload = Buffer.alloc(
        PMU_READING_COUNT_SIZE + (measurements.length * PMU_READING_SIZE)
    )
    payload.writeUInt16BE(measurements.length, 0)

    let offset = PMU_READING_COUNT_SIZE
    for(const measurement of measurements){
        payload.writeFloatBE(measurement.magnitude, offset)
        offset += PMU_READING_VALUE_SIZE
        payload.writeFloatBE(measurement.phase, offset)
        offset += PMU_READING_VALUE_SIZE
        payload.writeFloatBE(measurement.frequency, offset)
        offset += PMU_READING_VALUE_SIZE
        payload.writeFloatBE(measurement.rocof, offset)
        offset += PMU_READING_VALUE_SIZE
    }

    return payload
}

function build_c37118_frame_from_smu(data_buffer, config_file){
    const normalized = normalize_smu_payload_buffer(data_buffer)
    const measurement_payload = build_binary_measurement_payload(normalized)
    if(measurement_payload.length > C37118_MAX_PAYLOAD_BYTES){
        throw new Error(
            'SMU binary measurement payload is too large for one C37.118-style frame: ' +
            measurement_payload.length +
            ' bytes'
        )
    }

    const timestamp_ms = resolve_timestamp_ms(normalized)
    const soc = Math.floor(timestamp_ms / 1000) >>> 0
    const millis = Math.floor(timestamp_ms % 1000)
    const fracsec = Math.floor((millis * 0x00ffffff) / 1000) >>> 0
    const frame_size = C37118_HEADER_SIZE + measurement_payload.length + C37118_TRAILER_SIZE
    const frame = Buffer.alloc(frame_size)

    frame.writeUInt16BE(C37118_SYNC_WORD, 0)
    frame.writeUInt16BE(frame_size, 2)
    frame.writeUInt16BE(resolve_id_code(config_file), 4)
    frame.writeUInt32BE(soc, 6)
    frame.writeUInt32BE(fracsec, 10)
    measurement_payload.copy(frame, C37118_HEADER_SIZE)

    const checksum = crc16_ccitt_false(frame.subarray(0, frame_size - C37118_TRAILER_SIZE))
    frame.writeUInt16BE(checksum, frame_size - C37118_TRAILER_SIZE)

    return frame
}

function extract_json_messages(text_buffer){
    let working_text = text_buffer
    const messages = []

    while(true){
        let message_start = -1
        let depth = 0
        let in_string = false
        let escape_next = false
        let completed_index = -1

        for(let index = 0; index < working_text.length; index++){
            const char = working_text[index]

            if(message_start < 0){
                if(char === '{' || char === '['){
                    message_start = index
                    depth = 1
                }
                continue
            }

            if(in_string){
                if(escape_next){
                    escape_next = false
                    continue
                }
                if(char === '\\'){
                    escape_next = true
                    continue
                }
                if(char === '"'){
                    in_string = false
                }
                continue
            }

            if(char === '"'){
                in_string = true
                continue
            }

            if(char === '{' || char === '['){
                depth++
                continue
            }

            if(char === '}' || char === ']'){
                depth--
                if(depth === 0){
                    completed_index = index
                    break
                }
            }
        }

        if(message_start < 0){
            return {
                messages,
                remaining: ''
            }
        }

        if(completed_index < 0){
            return {
                messages,
                remaining: working_text.slice(message_start)
            }
        }

        const candidate = working_text.slice(message_start, completed_index + 1)
        try{
            JSON.parse(candidate)
            messages.push(candidate)
        }catch(error){
            // Ignore malformed payloads and resync at the next JSON object boundary.
        }

        working_text = working_text.slice(completed_index + 1)
    }
}

class LocalActor_Connection{
    constructor(connectionType,config_file, eventEmitter,myIP,streaming){
        this.config_file = config_file
        this.connectionType = connectionType
        this.eventEmitter = eventEmitter
        this.localsocket = undefined
        this.myIP = myIP
        this.streaming = streaming
        this.applie_Connection()
    }

    applie_Connection(){
        if(this.connectionType == "TCP_Size"){
            this.TCP_connection(this.config_file.TCP_SizeBytes,"Size")
        }else if(this.connectionType == "TCP_Timer"){
            this.TCP_connection(this.config_file.TCP_Timer_InMS,"Timer")
        }else{
            this.http_connection()
        }
    }

    emit_local_actor_buffer(data_buffer){
        let output_buffer
        try{
            output_buffer = build_c37118_frame_from_smu(data_buffer, this.config_file)
        }catch(error){
            // false && console.error('[LOCAL][SMU] failed to convert JSON to C37.118 frame:', error.message)
            return
        }

       // console.log('[LOCAL][SMU] frame_length_bytes=', output_buffer.length)
        // false && console.log('[LOCAL][SMU] c37118_frame=' + output_buffer.toString('hex'))
        const event_title = (this.streaming == false) ? "LocalActor_data" : "Stream_Actor_data"
        setImmediate(() => {
            this.eventEmitter.emit(event_title, {
                DataSource: 'SMU',
                payload: output_buffer
            })
        })
    }

    TCP_connection(rule,rule_type){
        let text_buffer = ''
        const decoder = new StringDecoder('utf8')
        const client = new net.Socket()
        client.setMaxListeners(0)
        let connection_closed = false

        if(rule_type != undefined){
            /* false && console.log('[LOCAL][TCP][SMU] JSON framing mode enabled; ignoring config ruleType=',rule_type,' rule=',rule); */
        }

        const flush_text_buffer = () => {
            const extracted = extract_json_messages(text_buffer)
            text_buffer = extracted.remaining
            for(const message of extracted.messages){
                this.emit_local_actor_buffer(Buffer.from(message, 'utf8'))
            }
        }

        const close_connection = (reason,error) => {
            if(connection_closed == true){
                return
            }
            connection_closed = true

            const flushed_text = decoder.end()
            if(flushed_text.length > 0){
                text_buffer += flushed_text
                flush_text_buffer()
            }

            text_buffer = ''
            if(this.localsocket === client){
                this.localsocket = undefined
            }
            if(error != undefined){
                /* false && console.log('[LOCAL][TCP][SMU] connection closed reason=',reason,' error=',error.message); */
            }else{
                /* false && console.log('[LOCAL][TCP][SMU] connection closed reason=',reason); */
            }
            if(client.destroyed == false){
                client.destroy()
            }
        }

        client.setNoDelay(true)
        client.setKeepAlive(true)
        this.localsocket = client
        client.connect(5003,"127.0.0.2")
        client.on('data',(data) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data)
            text_buffer += decoder.write(chunk)
            flush_text_buffer()
        })
        client.on('error',(error) => {close_connection('error',error)})
        client.on('end',() => {close_connection('end')})
        client.on('close',() => {close_connection('close')})
    }

    http_connection(){
        const options = {
            hostname: this.myIP,
            port: this.config_file.LocalActorPort,
            path: '/',
            method: 'POST',
        }

        setInterval(() => {
            const req = http.request(options,(res) => {
                res.setMaxListeners(0)
                let data = ''
                res.on('data',(chunk) => {data += chunk})
                res.on('end',() => {
                    const extracted = extract_json_messages(data)
                    for(const message of extracted.messages){
                        this.emit_local_actor_buffer(Buffer.from(message, 'utf8'))
                    }
                })
            })

            req.setMaxListeners(0)
            this.localsocket = req
            req.write('')
            req.on('error',() => {
                // false && console.error('http local actor SERVER is not there')
            })
        }, 500)
    }
}

module.exports = LocalActor_Connection
