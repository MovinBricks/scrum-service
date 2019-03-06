class Room {
    constructor() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
        this.cachedClients = new Map();
    }

    init() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
        this.cachedClients = new Map();
    }
}

module.exports = Room;
