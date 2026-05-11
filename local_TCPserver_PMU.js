// this a mock TCP server that sends C37.118 frames with dummy payload data at a fixed interval


'use strict';

const net = require('net');

const HOST = "127.0.0.2";
const PORT =  5000;
const SEND_INTERVAL_MS = Number(process.env.SEND_INTERVAL_MS) || 20;
const FRAME_SIZE = 132;
const ID_CODE = Number(process.env.C37118_ID_CODE) || 1;
const SYNC_WORD = 0xaa01; // 0xAA sync + data frame type

let global_sequence = 0;

function crc16_ccitt_false(buffer) {
    let crc = 0xffff;
    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i] << 8;
        for (let bit = 0; bit < 8; bit++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }
    return crc;
}

function build_c37118_frame(sequence) {
    const frame = Buffer.alloc(FRAME_SIZE);
    const now_ms = Date.now();
    const soc = Math.floor(now_ms / 1000) >>> 0;
    const millis = now_ms % 1000;
    const fracsec = Math.floor((millis * 0x00ffffff) / 1000) >>> 0;

    frame.writeUInt16BE(SYNC_WORD, 0);
    frame.writeUInt16BE(FRAME_SIZE, 2);
    frame.writeUInt16BE(ID_CODE, 4);
    frame.writeUInt32BE(soc, 6);
    frame.writeUInt32BE(fracsec, 10);

    // Payload region: bytes 14..71 (58 bytes)
    for (let i = 14; i < FRAME_SIZE - 2; i++) {
        frame[i] = (sequence + i - 14) & 0xff;
    }

    const checksum = crc16_ccitt_false(frame.subarray(0, FRAME_SIZE - 2));
    frame.writeUInt16BE(checksum, FRAME_SIZE - 2);

    return frame;
}

const server = net.createServer((socket) => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    /* console.log(`[C37.118-TCP] client connected ${peer}`); */ 

    let closed = false;
    let sender_timer;
    let waiting_for_drain = false;
    let next_send_at = Date.now() + SEND_INTERVAL_MS;

    socket.setNoDelay(true);
    socket.setKeepAlive(true);

    const stop_sender = (reason, error) => {
        if (closed) {
            return;
        }
        closed = true;
        clearTimeout(sender_timer);
        if (error != undefined) {
            /* console.log(`[C37.118-TCP] client ${peer} disconnected reason=${reason} error=${error.message}`); */ 
        } else {
            /* console.log(`[C37.118-TCP] client ${peer} disconnected reason=${reason}`); */ 
        }
    };

    const schedule_next_send = () => {
        if (closed === true) {
            return;
        }
        sender_timer = setTimeout(send_one_frame, Math.max(0, next_send_at - Date.now()));
    };

    const send_one_frame = () => {
        if (closed === true || waiting_for_drain === true) {
            return;
        }
        const frame = build_c37118_frame(global_sequence++);
        const can_continue = socket.write(frame);
        if (can_continue === false) {
            waiting_for_drain = true;
            return;
        }
        next_send_at += SEND_INTERVAL_MS;
        while (next_send_at <= Date.now()) {
            next_send_at += SEND_INTERVAL_MS;
        }
        schedule_next_send();
    };

    socket.on('drain', () => {
        if (closed === true) {
            return;
        }
        waiting_for_drain = false;
        next_send_at = Date.now() + SEND_INTERVAL_MS;
        schedule_next_send();
    });

    schedule_next_send();

    socket.on('data', (chunk) => {
        //console.log(`[C37.118-TCP] received ${chunk.length} bytes from ${peer}`); 
    });
    socket.on('end', () => {
        stop_sender('end');
    });
    socket.on('close', () => {
        stop_sender('close');
    });
    socket.on('error', (error) => {
        stop_sender('error', error);
    });
});

server.listen(PORT, HOST, () => {
    /* console.log(`[C37.118-TCP] server listening on ${HOST}:${PORT}`); */ 
    /* console.log(`[C37.118-TCP] sending ${FRAME_SIZE}-byte frames every ${SEND_INTERVAL_MS} ms`); */ 
});

server.on('error', (error) => {
    console.error(`[C37.118-TCP] server failed on ${HOST}:${PORT}: ${error.message}`);
    process.exit(1);
});
