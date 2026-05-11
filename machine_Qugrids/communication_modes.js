const SUPPORTED_COMMUNICATION_TYPES = ['HTTPS', 'QKD', 'PQC'];
const DEFAULT_COMMUNICATION_TYPE = 'HTTPS';

function normalize_communication_type(value){
    const normalized_value = String(value ?? DEFAULT_COMMUNICATION_TYPE).trim().toUpperCase();
    if(normalized_value === 'TLS'){
        return 'HTTPS';
    }
    return normalized_value;
}

function resolve_configured_communication_type(configFile){
    if(typeof configFile.Communication_Type === 'string'){
        return normalize_communication_type(configFile.Communication_Type);
    }
    if(typeof configFile.CommunicationType === 'string'){
        return normalize_communication_type(configFile.CommunicationType);
    }

    const configured_types =
        Array.isArray(configFile.Communication_Type)
            ? configFile.Communication_Type
            : (
                Array.isArray(configFile.Communication_Types)
                    ? configFile.Communication_Types
                    : undefined
            );

    if(configured_types == undefined){
        return DEFAULT_COMMUNICATION_TYPE;
    }

    const configured_index = Number(configFile.Communication_Type_index ?? configFile.Communication_index ?? 0);
    if(Number.isInteger(configured_index) === false || configured_index < 0 || configured_index >= configured_types.length){
        throw new Error(
            'Invalid Communication_Type_index=' + configFile.Communication_Type_index
            + '. Expected an index in Communication_Type.'
        );
    }

    return normalize_communication_type(configured_types[configured_index]);
}

function resolveCommunicationMode(configFile){
    const communication_type = resolve_configured_communication_type(configFile);

    if(SUPPORTED_COMMUNICATION_TYPES.includes(communication_type) === false){
        throw new Error(
            'Unsupported Communication_Type "' + communication_type + '". '
            + 'Use one of: ' + SUPPORTED_COMMUNICATION_TYPES.join(', ')
        );
    }

    return {
        type: communication_type,
        transportProtocol: communication_type === 'HTTPS' ? 'HTTPS' : 'HTTP',
        qkdSecurity:
            communication_type === 'QKD'
                ? require('../QKD').createQkdSecurity({
                    localMachineId: configFile.myID,
                    keyStorePath: configFile.QKD_KeyStorePath
                })
                : undefined
    };
}

function createConfiguredRequesterClass(Requester, communicationMode){
    return class ConfiguredRequester extends Requester{
        constructor(replierIP, replier_name, port, replier_publicKey, myPublic_key){
            super(replierIP, replier_name, port, replier_publicKey, myPublic_key, communicationMode);
        }
    };
}

module.exports = {
    resolveCommunicationMode,
    createConfiguredRequesterClass
};
