const LocalActorConnectionPMU = require('./local_connectionPMU')
const LocalActorConnectionSMU = require('./local_connectionSMU')

class CombinedLocalSocket {
    constructor(resolveSockets){
        this.resolveSockets = resolveSockets
    }

    write(...args){
        let wrote_to_any_socket = false
        for(const socket of this.resolveSockets()){
            if(socket == undefined || typeof socket.write !== 'function'){
                continue
            }
            socket.write(...args)
            wrote_to_any_socket = true
        }
        return wrote_to_any_socket
    }
}

class LocalActor_Connection{
    constructor(connectionType,config_file,eventEmitter,myIP,streaming){
        this.connections = [
            new LocalActorConnectionPMU(connectionType,config_file,eventEmitter,myIP,streaming),
            new LocalActorConnectionSMU(connectionType,config_file,eventEmitter,myIP,streaming),
        ]
        this.localsocket = new CombinedLocalSocket(() => {
            return this.connections
                .map((connection) => connection?.localsocket)
                .filter((socket) => socket != undefined)
        })
    }
}

module.exports = LocalActor_Connection
