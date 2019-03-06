class Room {
    constructor() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
        this.cachedClients = [];
    }

    init() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
        this.cachedClients = [];
    }
}

module.exports = Room;
