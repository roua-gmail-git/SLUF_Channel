// this is a mock TCP server that sends SMU JSON payload data at a fixed interval

'use strict';

const net = require('net');

const HOST = process.env.LOCAL_ACTOR_HOST || '127.0.0.2';
const PORT = Number(process.env.LOCAL_ACTOR_PORT) || 5003;
const SEND_INTERVAL_MS = Number(process.env.SEND_INTERVAL_MS) || 100;

const SMU_PAYLOAD = {
    device: 'id',
    timestamp: '1771352743800',
    reading1: [['channel', 'V1'], ['magnitude', 3.56001], ['phase', -111.459], ['frequency', 49.9985], ['rocof', -0.000114441]],
    reading2: [['channel', 'V2'], ['magnitude', 5.6938e-05], ['phase', -40.2048], ['frequency', 50.7321], ['rocof', -0.95293]],
    reading3: [['channel', 'V3'], ['magnitude', 9.63462e-06], ['phase', -99.1412], ['frequency', 48.9311], ['rocof', -122.627]],
    reading4: [['channel', 'V4'], ['magnitude', 1.02068e-05], ['phase', 47.5138], ['frequency', 37.4269], ['rocof', -35.4777]],
    reading5: [['channel', 'I1'], ['magnitude', 1.08357e-05], ['phase', 206.701], ['frequency', 76.5793], ['rocof', 78.5133]],
    reading6: [['channel', 'I2'], ['magnitude', 1.04419e-05], ['phase', -12.2889], ['frequency', 48.6832], ['rocof', 6.003]],
    reading7: [['channel', 'I3'], ['magnitude', 1.15053e-05], ['phase', 28.1997], ['frequency', 61.6324], ['rocof', 71.6486]],
    reading8: [['channel', 'I4'], ['magnitude', 8.70892e-05], ['phase', 29.6225], ['frequency', 50.0772], ['rocof', 2.38091]]
};

const SMU_MESSAGE_BUFFER = Buffer.from(JSON.stringify(SMU_PAYLOAD) + '\n', 'utf8');

const server = net.createServer((socket) => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    /* console.log(`[SMU-TCP] client connected ${peer}`); */

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
            /* console.log(`[SMU-TCP] client ${peer} disconnected reason=${reason} error=${error.message}`); */
        } else {
            /* console.log(`[SMU-TCP] client ${peer} disconnected reason=${reason}`); */
        }
    };

    const schedule_next_send = () => {
        if (closed === true) {
            return;
        }
        sender_timer = setTimeout(send_one_message, Math.max(0, next_send_at - Date.now()));
    };

    const send_one_message = () => {
        if (closed === true || waiting_for_drain === true) {
            return;
        }
        const can_continue = socket.write(SMU_MESSAGE_BUFFER);
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

    socket.on('data', () => {
        // ignore incoming data from client
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
    /* console.log(`[SMU-TCP] server listening on ${HOST}:${PORT}`); */
    /* console.log(`[SMU-TCP] sending JSON payload every ${SEND_INTERVAL_MS} ms`); */
});

server.on('error', (error) => {
    console.error(`[SMU-TCP] server failed on ${HOST}:${PORT}: ${error.message}`);
    process.exit(1);
});
