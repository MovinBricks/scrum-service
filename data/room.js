class Room {
    constructor() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
    }

    init() {
        this.clients = [];
        this.master = {};
        this.roomID = '';
    }
}

module.exports = Room;
