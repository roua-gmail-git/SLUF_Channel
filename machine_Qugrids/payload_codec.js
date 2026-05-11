function isBinaryPayload(candidate) {
    return (
        Buffer.isBuffer(candidate) ||
        candidate instanceof ArrayBuffer ||
        ArrayBuffer.isView(candidate)
    );
}

function toBuffer(candidate) {
    if (Buffer.isBuffer(candidate)) {
        return Buffer.from(candidate);
    }
    if (candidate instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(candidate));
    }
    if (ArrayBuffer.isView(candidate)) {
        return Buffer.from(
            new Uint8Array(candidate.buffer, candidate.byteOffset, candidate.byteLength)
        );
    }
    throw new Error('Payload is not binary');
}

function normalizePlainPayload(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (value != undefined && typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value ?? '');
}

function extractPayloadSource(candidate) {
    if (candidate == undefined || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return undefined;
    }
    const source = candidate.DataSource ?? candidate.dataSource ?? candidate.source;
    return typeof source === 'string' && source.length > 0 ? source : undefined;
}

function extractPayload(data) {
    if (isBinaryPayload(data)) {
        return toBuffer(data);
    }

    if (data != undefined && typeof data === 'object') {
        const payloadSource = extractPayloadSource(data);
        const payload = data.payload ?? data.data ?? data.Data;
        if (payload != undefined) {
            const normalizedPayload = isBinaryPayload(payload)
                ? toBuffer(payload)
                : normalizePlainPayload(payload);
            if (payloadSource != undefined) {
                return {
                    DataSource: payloadSource,
                    payload: normalizedPayload,
                };
            }
            return normalizedPayload;
        }
        return JSON.stringify(data);
    }

    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (parsed != undefined && typeof parsed === 'object' && Array.isArray(parsed) === false) {
                const payloadSource = extractPayloadSource(parsed);
                const payload = parsed.payload ?? parsed.data ?? parsed.Data;
                if (payload != undefined) {
                    const normalizedPayload = isBinaryPayload(payload)
                        ? toBuffer(payload)
                        : normalizePlainPayload(payload);
                    if (payloadSource != undefined) {
                        return {
                            DataSource: payloadSource,
                            payload: normalizedPayload,
                        };
                    }
                    return normalizedPayload;
                }
            }
        } catch (error) {
        }
        return data;
    }

    return normalizePlainPayload(data);
}

function serializePayloadForMessage(payload) {
    const nestedPayload =
        payload != undefined && typeof payload === 'object' && Array.isArray(payload) === false
            ? (payload.payload ?? payload.data ?? payload.Data)
            : undefined;
    const payloadValue = nestedPayload != undefined ? nestedPayload : payload;

    return {
        Data: isBinaryPayload(payloadValue)
            ? toBuffer(payloadValue).toString('base64')
            : Buffer.from(normalizePlainPayload(payloadValue), 'utf8').toString('base64'),
    };
}

function copyPayloadFieldsFromMessage(message) {
    const payloadFields = {};
    if (message != undefined && Object.prototype.hasOwnProperty.call(message, 'Data')) {
        payloadFields.Data = normalizePlainPayload(message.Data);
    }
    return payloadFields;
}

function signaturePayloadValue(message) {
    if (message == undefined || Object.prototype.hasOwnProperty.call(message, 'Data') === false) {
        return '';
    }

    const dataValue = normalizePlainPayload(message.Data);
    return dataValue;
}

function decodeMessagePayload(message) {
    if (message == undefined || Object.prototype.hasOwnProperty.call(message, 'Data') === false) {
        return undefined;
    }

    const dataValue = normalizePlainPayload(message.Data);
    return Buffer.from(dataValue, 'base64');
}

function normalizeLocalPayload(value) {
    if (value == undefined) {
        return undefined;
    }
    if (isBinaryPayload(value)) {
        return toBuffer(value);
    }
    return normalizePlainPayload(value);
}

module.exports = {
    copyPayloadFieldsFromMessage,
    decodeMessagePayload,
    extractPayloadSource,
    extractPayload,
    normalizeLocalPayload,
    serializePayloadForMessage,
    signaturePayloadValue,
};
