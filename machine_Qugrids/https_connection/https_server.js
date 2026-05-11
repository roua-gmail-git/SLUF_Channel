const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

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

function resolve_transport_protocol(options){
    const protocol = typeof options === 'string' ? options : options?.transportProtocol ?? options?.protocol;
    const normalized_protocol = String(protocol ?? 'HTTPS').trim().toUpperCase();
    if(normalized_protocol !== 'HTTP' && normalized_protocol !== 'HTTPS'){
        throw new Error('Unsupported machine communication transport: ' + normalized_protocol);
    }
    return normalized_protocol;
}

class WorkerResponseProxy{
    constructor(worker, request_id){
        this.worker = worker;
        this.request_id = request_id;
        this.status_code = 202;
        this.headersSent = false;
    }

    status(status_code){
        this.status_code = status_code;
        return this;
    }

    json(payload){
        return this.send(JSON.stringify(payload), {
            'content-type': 'application/json; charset=utf-8'
        });
    }

    send(payload, headers){
        if (headers != undefined) {
            this.headers = Object.assign({}, this.headers || {}, headers);
        }
        if (payload != undefined && typeof payload === 'object' && Buffer.isBuffer(payload) === false) {
            this.headers = Object.assign({}, this.headers || {}, {
                'content-type': 'application/json; charset=utf-8'
            });
            return this.end(JSON.stringify(payload));
        }
        return this.end(payload);
    }

    writeHead(status_code, headers){
        this.status_code = status_code;
        this.headers = headers;
        return this;
    }

    end(payload){
        if (this.headersSent === true) {
            return this;
        }
        this.headersSent = true;
        this.worker.postMessage({
            type: 'response',
            id: this.request_id,
            statusCode: this.status_code,
            headers: this.headers,
            body: payload == undefined ? '' : payload
        });
        return this;
    }
}

class HttpsReplier{
    constructor(port, Replier_eventEmitter, myIP, myPublicKey, options){
        this.port = port;
        this.ip = myIP;
        this.eventsEmitter = Replier_eventEmitter;
        this.myPublic_key = myPublicKey;
        this.transportProtocol = resolve_transport_protocol(options);
        this.worker = undefined;
        this.closing = false;
        this.pending_transactions = [];
        this.pending_acks = [];
        this.pending_control_events = [];
        this.processing_transactions = false;
        this.processing_acks = false;
        this.processing_control_events = false;
        this.create_server();
        this.get_requests();
    }

    drain_transactions(){
        if (this.processing_transactions === true || this.pending_transactions.length === 0) {
            return;
        }
        this.processing_transactions = true;
        const transaction_body = this.pending_transactions.shift();
        setImmediate(() => {
            try{
               this.eventsEmitter.emit('transaction_data', [transaction_body]);
            }finally{
                this.processing_transactions = false;
                if (this.pending_transactions.length > 0) {
                    this.drain_transactions();
                }
            }
        });
    }

    drain_acks(){
        if (this.processing_acks === true || this.pending_acks.length === 0) {
            return;
        }
        this.processing_acks = true;
        const ack_message = this.pending_acks.shift();
        setImmediate(() => {
            try{
                this.eventsEmitter.emit('ACK_channel_data', ack_message);
            }finally{
                this.processing_acks = false;
                if (this.pending_acks.length > 0) {
                    this.drain_acks();
                }
            }
        });
    }

    drain_control_events(){
        if (this.processing_control_events === true || this.pending_control_events.length === 0) {
            return;
        }
        this.processing_control_events = true;
        const control_event = this.pending_control_events.shift();
        setImmediate(() => {
            try{
                this.emit_control_event(control_event);
            }finally{
                this.processing_control_events = false;
                if (this.pending_control_events.length > 0) {
                    this.drain_control_events();
                }
            }
        });
    }

    emit_control_event(control_event){
        switch(control_event.event){
            case 'ReplierTOreplier_ACK':
                this.eventsEmitter.emit('ReplierTOreplier_ACK', control_event.body);
                break;
            case 'END':
                this.eventsEmitter.emit('END');
                break;
            case 'got_RequesterFileHash':
                this.eventsEmitter.emit('got_RequesterFileHash', control_event.body);
                break;
            case 'got_ReplierFileHash':
                this.eventsEmitter.emit('got_ReplierFileHash', control_event.body);
                break;
            case 'CloseFile':
                this.eventsEmitter.emit('CloseFile');
                break;
            case 'auditor_Filehash':
                this.eventsEmitter.emit('auditor_Filehash', control_event.body);
                break;
        }
    }

    emit_response_event(message){
        const response = new WorkerResponseProxy(this.worker, message.id);
        if (message.event === 'Start_external_Auditor') {
            this.eventsEmitter.emit('Start_external_Auditor', [message.body, response]);
        }
        if (response.headersSent === false) {
            response.status(202).json({ status: 202 });
        }
    }

    get_requests(){
        this.worker.on('message', (message) => {
            if (message == undefined || typeof message !== 'object') {
                return;
            }
            if (message.type === 'transaction_batch' && Array.isArray(message.items)) {
                for (const item of message.items) {
                    this.pending_transactions.push(item.body);
                }
                this.drain_transactions();
                return;
            }
            if (message.type === 'ack_batch' && Array.isArray(message.items)) {
                for (const item of message.items) {
                    this.pending_acks.push({
                        rawData: item.rawData,
                        sourceIp: item.sourceIp,
                        sourcePort: item.sourcePort
                    });
                }
                this.drain_acks();
                return;
            }
            if (message.type === 'control_batch' && Array.isArray(message.items)) {
                for (const item of message.items) {
                    this.pending_control_events.push(item);
                }
                this.drain_control_events();
                return;
            }
            if (message.type === 'response_event') {
                this.emit_response_event(message);
            }
        });
        this.worker.on('error', (error) => {
            console.error('https server worker error:', error.message);
        });
        this.worker.on('exit', (code) => {
            if (code !== 0 && this.closing !== true) {
                console.error('https server worker exited with code', code);
            }
        });
    }

    create_server(){
        const worker_data = {
            ip: this.ip,
            port: this.port,
            protocol: this.transportProtocol
        };
        if(this.transportProtocol === 'HTTPS'){
            const tls_paths = resolve_tls_server_paths();
            worker_data.keyPath = tls_paths.key_path;
            worker_data.certPath = tls_paths.cert_path;
        }
        this.worker = new Worker(path.join(__dirname, 'https_server_worker.js'), {
            workerData: worker_data
        });
    }

    close(){
        if (this.worker != undefined) {
            this.closing = true;
            return this.worker.terminate();
        }
        return Promise.resolve();
    }
}

module.exports = HttpsReplier;
