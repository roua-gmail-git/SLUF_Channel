var net = require('net');
const configFile = require('../../ConfigFile1.json');
const metadata = require('../../metadata.json');

const myDataActor = Object.values(metadata).find((item) => item.ID === configFile.myID);
const LOCAL_ACTOR_HOST = process.env.LOCAL_ACTOR_HOST || myDataActor.IP;
const LOCAL_ACTOR_PORT = Number(process.env.LOCAL_ACTOR_PORT) || Number(configFile.localRepliePort) || 5001;
const TEST_FRAME_SIZE = 132;
const TEST_ID_CODE = Number(process.env.C37118_ID_CODE) || 1;
const TEST_SYNC_WORD = 0xaa01;

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
    const frame = Buffer.alloc(TEST_FRAME_SIZE);
    const now_ms = Date.now();
    const soc = Math.floor(now_ms / 1000) >>> 0;
    const millis = now_ms % 1000;
    const fracsec = Math.floor((millis * 0x00ffffff) / 1000) >>> 0;

    frame.writeUInt16BE(TEST_SYNC_WORD, 0);
    frame.writeUInt16BE(TEST_FRAME_SIZE, 2);
    frame.writeUInt16BE(TEST_ID_CODE, 4);
    frame.writeUInt32BE(soc, 6);
    frame.writeUInt32BE(fracsec, 10);

    for (let i = 14; i < TEST_FRAME_SIZE - 2; i++) {
        frame[i] = (sequence + i - 14) & 0xff;
    }

    const checksum = crc16_ccitt_false(frame.subarray(0, TEST_FRAME_SIZE - 2));
    frame.writeUInt16BE(checksum, TEST_FRAME_SIZE - 2);
    return frame;
}

function extract_c37118_frames(buffer) {
    let working_buffer = buffer;
    const frames = [];
    while (true) {
        if (working_buffer.length < 4) {
            break;
        }

        const sync_start = working_buffer.indexOf(0xaa);
        if (sync_start < 0) {
            working_buffer = Buffer.alloc(0);
            break;
        }
        if (sync_start > 0) {
            working_buffer = working_buffer.subarray(sync_start);
        }
        if (working_buffer.length < 4) {
            break;
        }

        const frame_size = working_buffer.readUInt16BE(2);
        if (frame_size < 14) {
            working_buffer = working_buffer.subarray(1);
            continue;
        }
        if (working_buffer.length < frame_size) {
            break;
        }

        frames.push(Buffer.from(working_buffer.subarray(0, frame_size)));
        working_buffer = working_buffer.subarray(frame_size);
    }

    return { frames, remaining: Buffer.from(working_buffer) };
}

let sent_sequence = 0;
let receive_buffer = Buffer.alloc(0);
let received_frames_this_second = 0;

setInterval(() => {
    // console.log(`frames/sec=${received_frames_this_second}`);
    received_frames_this_second = 0;
}, 1000);

var client = new net.Socket();
client.setNoDelay(true);
client.setKeepAlive(true);

client.connect(LOCAL_ACTOR_PORT, LOCAL_ACTOR_HOST);

client.on('connect', () => {
    const frame = build_c37118_frame(sent_sequence++);
    client.write(frame);
});

client.on('data', (data) => {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
    receive_buffer = Buffer.concat([receive_buffer, chunk]);
    const extracted = extract_c37118_frames(receive_buffer);
    receive_buffer = extracted.remaining;
    received_frames_this_second += extracted.frames.length;
});

client.on('error', (error) => {
    console.error('localTcpClient error:', error.message);
});
