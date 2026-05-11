const fs = require('fs');
const http = require('http');
const https = require('https');
const { parentPort, workerData } = require('worker_threads');

function parse_response_data(data){
    if (typeof data !== 'string') {
        return data;
    }
    const trimmed = data.trim();
    if (trimmed.length === 0) {
        return data;
    }
    try{
        return JSON.parse(trimmed);
    }catch(error){
        return data;
    }
}

function serialize_payload(message){
    if (Buffer.isBuffer(message)) {
        return message;
    }
    if (message instanceof Uint8Array) {
        return Buffer.from(message);
    }
    if (typeof message === 'string') {
        return message;
    }
    const payload = JSON.stringify(message);
    return payload == undefined ? '' : payload;
}

const replier_ip = workerData.replierIP;
const port = workerData.port;
const protocol = String(workerData.protocol ?? 'HTTPS').trim().toUpperCase();
const transport = protocol === 'HTTP' ? http : https;
// const max_in_flight = Math.max(1, Number(workerData.maxInFlight) || 16);
const max_in_flight = Number.POSITIVE_INFINITY;
const retry_delay_ms = Math.max(1, Number(workerData.retryDelayMs) || 1000);
const pending_requests = [];
let in_flight = 0;
let retry_timer = undefined;
let flush_scheduled = false;

const agent_options = {
    keepAlive: true,
    // maxSockets: max_in_flight,
    // maxFreeSockets: max_in_flight,
};

if(protocol !== 'HTTP' && protocol !== 'HTTPS'){
    throw new Error('Unsupported machine communication transport: ' + protocol);
}

if(protocol === 'HTTPS'){
    agent_options.rejectUnauthorized = workerData.rejectUnauthorized === true;
}

if (protocol === 'HTTPS' && workerData.caPath != undefined && fs.existsSync(workerData.caPath) === true) {
    agent_options.ca = fs.readFileSync(workerData.caPath);
}

const agent = new transport.Agent(agent_options);
agent.setMaxListeners(0);

function schedule_flush(delay_ms = 0){
    if (delay_ms > 0) {
        if (retry_timer != undefined) {
            return;
        }
        retry_timer = setTimeout(() => {
            retry_timer = undefined;
            schedule_flush();
        }, delay_ms);
        return;
    }
    if (flush_scheduled === true) {
        return;
    }
    flush_scheduled = true;
    setImmediate(() => {
        flush_scheduled = false;
        flush_pending_requests();
    });
}

function flush_pending_requests(){
    while(in_flight < max_in_flight && pending_requests.length > 0){
        const request_item = pending_requests.shift();
        dispatch_request(request_item);
    }
}

function dispatch_request(request_item){
    in_flight++;
    const payload = serialize_payload(request_item.message);
    let settled = false;
    const options = {
        hostname: replier_ip,
        port,
        path: '/' + request_item.path,
        method: 'POST',
        agent,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = transport.request(options, (res) => {
        let data = '';
        const response_meta = {
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            path: request_item.path,
            target: replier_ip + ':' + port
        };
        let completed = false;

        if (request_item.expectsResponse === true) {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
        } else {
            res.resume();
        }
        res.on('end', () => {
            if (settled === true) {
                return;
            }
            completed = true;
            settled = true;
            in_flight--;
            if (request_item.expectsResponse === true) {
                parentPort.postMessage({
                    type: 'response',
                    id: request_item.id,
                    receivedData: parse_response_data(data),
                    responseMeta: response_meta
                });
            }
            schedule_flush();
        });
        res.on('error', (error) => {
            if (completed === true || settled === true) {
                return;
            }
            settled = true;
            requeue_request(request_item, error);
        });
    });

    req.setMaxListeners(0);
    req.on('error', (error) => {
        if (settled === true) {
            return;
        }
        settled = true;
        requeue_request(request_item, error);
    });
    req.end(payload);
}

function requeue_request(request_item, error){
    in_flight = Math.max(0, in_flight - 1);
    if (error != undefined && error.code !== 'ECONNREFUSED') {
        console.error(
            protocol.toLowerCase() + ' request error:',
            `${replier_ip}:${port}/${request_item.path}`,
            error.code || 'NO_CODE',
            error.message
        );
    }
    pending_requests.unshift(request_item);
    schedule_flush(retry_delay_ms);
}

parentPort.on('message', (message) => {
    if (message == undefined || message.type !== 'request') {
        return;
    }
    pending_requests.push({
        id: message.id,
        path: message.path,
        message: message.message,
        expectsResponse: message.expectsResponse === true
    });
    schedule_flush();
});
