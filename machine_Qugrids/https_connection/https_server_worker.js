const fs = require('fs');
const http = require('http');
const https = require('https');
const { parentPort, workerData } = require('worker_threads');

function normalize_request_body(body){
    if (typeof body !== 'string') {
        return body;
    }
    const trimmed = body.trim();
    if (trimmed.length === 0) {
        return body;
    }
    try{
        return JSON.parse(trimmed);
    }catch(error){
        return body;
    }
}

function json_response(res, status_code, payload){
    if (res.writableEnded === true) {
        return;
    }
    const body = JSON.stringify(payload);
    res.writeHead(status_code, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-cache'
    });
    res.end(body);
}

function text_response(res, status_code, payload){
    if (res.writableEnded === true) {
        return;
    }
    res.writeHead(status_code, {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': Buffer.byteLength(payload)
    });
    res.end(payload);
}

function get_pathname(req){
    const request_url = req.url || '/';
    const query_index = request_url.indexOf('?');
    if (query_index === -1) {
        return request_url;
    }
    return request_url.slice(0, query_index);
}

function read_request_body(req, res, callback){
    let body = '';
    let aborted = false;

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
        if (aborted === true) {
            return;
        }
        body += chunk;
    });
    req.on('end', () => {
        if (aborted === true) {
            return;
        }
        callback(body);
    });
    req.on('error', () => {
        if (aborted === false) {
            text_response(res, 500, 'Request Error');
        }
    });
}

const ip = workerData.ip;
const port = workerData.port;
const protocol = String(workerData.protocol ?? 'HTTPS').trim().toUpperCase();
const pending_transactions = [];
const pending_acks = [];
const pending_control_events = [];
const pending_responses = new Map();
let flush_scheduled = false;
let next_response_id = 1;

const control_event_by_path = {
    '/ReplierTOreplier_ACK': 'ReplierTOreplier_ACK',
    '/END': 'END',
    '/Requester_Filehash': 'got_RequesterFileHash',
    '/Replier_Filehash': 'got_ReplierFileHash',
    '/CloseFile': 'CloseFile',
    '/auditor_Filehash': 'auditor_Filehash'
};

function schedule_parent_flush(){
    if (flush_scheduled === true) {
        return;
    }
    flush_scheduled = true;
    setImmediate(() => {
        flush_scheduled = false;
        if (pending_transactions.length > 0) {
            parentPort.postMessage({
                type: 'transaction_batch',
                items: pending_transactions.splice(0, pending_transactions.length)
            });
        }
        if (pending_acks.length > 0) {
            parentPort.postMessage({
                type: 'ack_batch',
                items: pending_acks.splice(0, pending_acks.length)
            });
        }
        if (pending_control_events.length > 0) {
            parentPort.postMessage({
                type: 'control_batch',
                items: pending_control_events.splice(0, pending_control_events.length)
            });
        }
        if (pending_transactions.length > 0 || pending_acks.length > 0 || pending_control_events.length > 0) {
            schedule_parent_flush();
        }
    });
}

function handle_hot_path(pathname, req, res, body){
    json_response(res, 202, { status: 202 });
    if (pathname === '/transaction') {
        pending_transactions.push({
            body
        });
        schedule_parent_flush();
        return;
    }
    pending_acks.push({
        rawData: body,
        sourceIp: req.socket?.remoteAddress,
        sourcePort: req.socket?.remotePort
    });
    schedule_parent_flush();
}

function handle_control_path(pathname, res, body){
    const event = control_event_by_path[pathname];
    if (event == undefined) {
        text_response(res, 404, 'Not Found');
        return;
    }

    json_response(res, 202, { status: 202 });
    pending_control_events.push({
        event,
        body: normalize_request_body(body)
    });
    schedule_parent_flush();
}

function handle_response_path(res, body){
    const id = next_response_id++;
    const timeout = setTimeout(() => {
        if (pending_responses.delete(id) === true) {
            json_response(res, 202, { status: 202 });
        }
    }, 5000);

    pending_responses.set(id, { res, timeout });
    parentPort.postMessage({
        type: 'response_event',
        id,
        event: 'Start_external_Auditor',
        body: normalize_request_body(body)
    });
}

function handle_request(req, res){
    const pathname = get_pathname(req);
    if (req.method !== 'POST') {
        text_response(res, 404, 'Not Found');
        return;
    }

    read_request_body(req, res, (body) => {
        if (pathname === '/transaction' || pathname === '/ACK') {
            handle_hot_path(pathname, req, res, body);
            return;
        }
        if (pathname === '/Start_external_Auditor') {
            handle_response_path(res, body);
            return;
        }
        handle_control_path(pathname, res, body);
    });
}

parentPort.on('message', (message) => {
    if (message == undefined || message.type !== 'response') {
        return;
    }
    const pending_response = pending_responses.get(message.id);
    if (pending_response == undefined) {
        return;
    }
    pending_responses.delete(message.id);
    clearTimeout(pending_response.timeout);

    const status_code = message.statusCode || 202;
    const body = message.body == undefined ? '' : String(message.body);
    const headers = message.headers || {
        'content-type': 'text/plain; charset=utf-8'
    };
    if (headers['content-length'] == undefined && headers['Content-Length'] == undefined) {
        headers['content-length'] = Buffer.byteLength(body);
    }
    pending_response.res.writeHead(status_code, headers);
    pending_response.res.end(body);
});

let server;
if(protocol === 'HTTP'){
    server = http.createServer(handle_request);
}else if(protocol === 'HTTPS'){
    server = https.createServer({
        key: fs.readFileSync(workerData.keyPath),
        cert: fs.readFileSync(workerData.certPath)
    }, handle_request);
}else{
    throw new Error('Unsupported machine communication transport: ' + protocol);
}

server.listen(port, ip);

server.on('error', (error) => {
    console.error(protocol.toLowerCase() + ' server worker error:', error.message);
});
