const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

function resolve_tls_client_options(){
    const reject_unauthorized_value = process.env.MACHINE_QUGRIDS_TLS_REJECT_UNAUTHORIZED;
    const reject_unauthorized =
        reject_unauthorized_value == undefined
            ? false
            : String(reject_unauthorized_value).toLowerCase() === 'true';

    const ca_path = process.env.MACHINE_QUGRIDS_TLS_CA_PATH
        || path.join(__dirname, 'tls', 'server-cert.pem');

    return {
        rejectUnauthorized: reject_unauthorized,
        caPath: fs.existsSync(ca_path) === true ? ca_path : undefined
    };
}

function resolve_https_client_worker_count(){
    const configured_worker_count = Number(process.env.MACHINE_QUGRIDS_HTTPS_CLIENT_WORKERS);
    if (Number.isInteger(configured_worker_count) && configured_worker_count > 0) {
        return configured_worker_count;
    }

    const cpu_count =
        typeof os.availableParallelism === 'function'
            ? os.availableParallelism()
            : os.cpus().length;

    return cpu_count >= 4 ? 2 : 1;
}

function resolve_transport_protocol(options){
    const protocol = typeof options === 'string' ? options : options?.transportProtocol ?? options?.protocol;
    const normalized_protocol = String(protocol ?? 'HTTPS').trim().toUpperCase();
    if(normalized_protocol !== 'HTTP' && normalized_protocol !== 'HTTPS'){
        throw new Error('Unsupported machine communication transport: ' + normalized_protocol);
    }
    return normalized_protocol;
}

class HttpsRequester{
    constructor(replierIP, replier_name, port, replier_publicKey, myPublic_key, options){
        this.replierIP = replierIP;
        this.replier_name = replier_name;
        this.port = port;
        this.replier_publicKey = replier_publicKey;
        this.myPublic_key = myPublic_key;
        this.transportProtocol = resolve_transport_protocol(options);
        this.pending_callbacks = new Map();
        this.next_request_id = 1;
        this.workers = [];
        this.next_worker_index = 0;
        this.closing = false;
        this.create_workers();
    }

    create_workers(){
        const tls_options = this.transportProtocol === 'HTTPS' ? resolve_tls_client_options() : {};
        // const max_in_flight = Number(process.env.MACHINE_QUGRIDS_HTTPS_CLIENT_MAX_IN_FLIGHT) || 16;
        const retry_delay_ms = Number(process.env.MACHINE_QUGRIDS_HTTPS_CLIENT_RETRY_DELAY_MS) || 1000;
        const worker_count = resolve_https_client_worker_count();
        for (let slot = 0; slot < worker_count; slot++) {
            this.workers.push(this.create_worker(slot, tls_options, retry_delay_ms));
        }
    }

    create_worker(slot, tls_options, retry_delay_ms){
        const worker = new Worker(path.join(__dirname, 'https_client_worker.js'), {
            workerData: {
                replierIP: this.replierIP,
                port: this.port,
                protocol: this.transportProtocol,
                rejectUnauthorized: tls_options.rejectUnauthorized,
                caPath: tls_options.caPath,
                // maxInFlight: max_in_flight,
                retryDelayMs: retry_delay_ms
            }
        });
        worker.on('message', (message) => {
            this.handle_worker_message(message);
        });
        worker.on('error', (error) => {
            console.error(this.transportProtocol.toLowerCase() + ' client worker error:', this.replierIP + ':' + this.port, 'slot', slot, error.message);
        });
        worker.on('exit', (code) => {
            if (code !== 0 && this.closing !== true) {
                console.error(this.transportProtocol.toLowerCase() + ' client worker exited with code', code, this.replierIP + ':' + this.port, 'slot', slot);
            }
        });
        return worker;
    }

    select_worker(){
        if (this.workers.length === 0) {
            this.create_workers();
        }
        const worker = this.workers[this.next_worker_index];
        this.next_worker_index = (this.next_worker_index + 1) % this.workers.length;
        return worker;
    }

    expects_response_event(my_path){
        return my_path === 'END' || my_path === 'Requester_auditor_Filehash';
    }

    send_requests(my_path, message, eventEmitter, localContext){
        const request_id = this.next_request_id++;
        const expects_response = this.expects_response_event(my_path);
        if (expects_response === true) {
            this.pending_callbacks.set(request_id, {
                my_path,
                eventEmitter,
                message_context: localContext != undefined ? localContext : message
            });
        }
        this.select_worker().postMessage({
            type: 'request',
            id: request_id,
            path: my_path,
            message,
            expectsResponse: expects_response
        });
    }

    handle_worker_message(message){
        if (message == undefined || typeof message !== 'object') {
            return;
        }
        if (message.type !== 'response') {
            return;
        }
        const callback = this.pending_callbacks.get(message.id);
        if (callback == undefined) {
            return;
        }
        this.pending_callbacks.delete(message.id);
        this.do_function(
            message.receivedData,
            callback.message_context,
            callback.my_path,
            callback.eventEmitter,
            message.responseMeta
        );
    }

    do_function(recieved_data, message, my_path, eventEmitter, responseMeta){
        if (my_path === 'END') {
            eventEmitter.emit('StartSecondProcess');
            return;
        }
        if (my_path === 'Requester_auditor_Filehash') {
            eventEmitter.emit('got_Replier_Filehash', recieved_data);
            return;
        }
    }

    close(){
        if (this.workers.length > 0) {
            this.closing = true;
            const workers = this.workers.splice(0, this.workers.length);
            return Promise.all(workers.map((worker) => worker.terminate()));
        }
        return Promise.resolve();
    }
}

module.exports = HttpsRequester;
