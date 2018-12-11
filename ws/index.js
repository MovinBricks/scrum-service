const WebSocket = require('ws');
const uuidv4 = require('uuid/v4');

const TYPE = require('../data/operationType');
const STATUS = require('../data/operationStatus');
const AppInfo = require('../data/applicationInfo');
const Room = require('../data/room');
const { computeAverage, generateRoomID } = require('../utils');

const noop = () => { };

module.exports = (server) => {
    const wss = new WebSocket.Server({
        server,
    });

    /**
     * 发送消息
     *
     * @param {*} args 原始消息
     */
    function sendMessage(args) {
        const handleError = (err) => {
            if (err) {
                console.log(`[SERVER] error: ${err}`);
            }
        };
        const type = typeof args;

        switch (type) {
            case 'undefined':
                this.send('');
                break;
            case 'string':
            case 'boolean':
            case 'number':
                this.send(args, handleError);
                break;
            case 'function':
            case 'object':
                this.send(JSON.stringify(args), handleError);
                break;
            default:
                break;
        }
    }

    /**
     * 心跳连接
     *
     */
    function heartbeat() {
        this.isAlive = true;
    }

    wss.APP_INFO = new AppInfo();


    wss.broadcast = (data, roomID = 0) => {
        const broadcastMsg = Object.assign({}, data, { isBroadcast: true });
        const room = wss.APP_INFO.rooms.find((item) => item.roomID === roomID);

        console.log('broadcast:', JSON.stringify(broadcastMsg));

        if (room) {
            room.master && room.master.sendMessage && room.master.sendMessage(broadcastMsg);

            room.clients.forEach((item) => {
                item.sendMessage(broadcastMsg);
            });
        }
    }

    wss.initRoom = function initRoom(roomID = 0) {
        const { APP_INFO = {} } = this;
        const room = APP_INFO.rooms.find((item) => item.roomID === roomID);

        if (room) {
            if (room.master && room.master.userInfo && room.master.userInfo.uid) {
                room.master.terminate();
            }

            if (room.clients && room.clients.length > 0) {
                room.clients.forEach(client => {
                    client.terminate();
                });
            }
        }
    }


    wss.on('connection', function (ws, req) {
        ws.isAlive = true;
        ws.sendMessage = sendMessage;

        console.log(`[SERVER] connection()`);

        ws.on('message', function (data) {
            const message = JSON.parse(data) || {};
            const { userInfo = {}, type = '', roomID = '', score, kickedUids = [] } = message;
            let room;
            console.log(`[SERVER] Received: ${data}`);

            if (!message) {
                ws.sendMessage({
                    type: 'ERROR',
                    message: 'Invalid Message!'
                });
                return;
            }

            try {
                switch (type) {
                    case TYPE.CREATE:
                        
                    room = wss.APP_INFO.rooms.length > 0 ? wss.APP_INFO.rooms.find((item)=>item.roomID === roomID) : undefined;

                        // 重连状态
                        if (room && room.master.userInfo && room.master.userInfo) {
                            ws.userInfo = Object.assign({}, userInfo, { uid: room.master.userInfo.uid });
                            ws.roomID = room.roomID;
                            room.master = ws;

                            ws.sendMessage({
                                type,
                                userInfo: ws.userInfo,
                                roomID: room.roomID,
                                status: STATUS.SUCCESS,
                                users: room.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        } else {
                            const roomIDs = wss.APP_INFO.rooms.map(room => room.roomID);
                            const newRoomID = generateRoomID(roomIDs);
                            let newRoom = new Room();

                            newRoom.roomID = newRoomID;
                            // wss.initRoom();
                            // wss.APP_INFO.init();
                            ws.userInfo = Object.assign({}, userInfo, { uid: uuidv4() });
                            ws.roomID = newRoomID;
                            newRoom.master = ws;
                            wss.APP_INFO.rooms.push(newRoom);

                            ws.sendMessage({
                                type,
                                userInfo: ws.userInfo,
                                roomID: newRoomID,
                                status: STATUS.SUCCESS,
                                users: newRoom.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        }

                        break;
                    case TYPE.JOIN:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === roomID);

                        if (!room) {

                            ws.sendMessage({
                                type,
                                status: STATUS.FAIL,
                                message: '房间不存在'
                            })
                        } else if (ws.userInfo && ws.userInfo.uid) { // 用户已经加入，连接未中断

                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            });
                        } else {
                            ws.score = 0;
                            ws.roomID = roomID;
                            ws.userInfo = Object.assign({}, userInfo, { uid: uuidv4() });
                            wss.broadcast({
                                type: 'JOIN_USER',
                                userInfo: ws.userInfo,
                                users: [...room.clients.map(item => {
                                    return {
                                        score: item.score,
                                        userInfo: item.userInfo
                                    }
                                }), {
                                    score: ws.score,
                                    userInfo: ws.userInfo
                                }],
                            }, roomID);
                            room.clients.push(ws);

                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            });
                        }

                        break;
                    case TYPE.LEAVE:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);

                        if (room) {
                            room.clients = room.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);
                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            });
                            ws.terminate();

                            wss.broadcast({
                                type,
                                userInfo: ws.userInfo,
                                users: room.clients.map(item => {
                                    return {
                                        score: item.score,
                                        userInfo: item.userInfo
                                    }
                                }),
                            }, ws.roomID);
                        }

                        break;
                    case TYPE.GRADE:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);

                        if (!isNaN(+score) || score === '?') {
                            ws.score = score;
                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            })
                            wss.broadcast({
                                users: room.clients.map(client => {
                                    return {
                                        score: client.score,
                                        userInfo: client.userInfo,
                                    }
                                }),
                                type,
                            }, room.roomID);
                        } else {
                            ws.send(JSON.stringify({
                                type,
                                status: STATUS.FAIL,
                                message: 'Score Invalid'
                            }));
                        }

                        break;

                    case TYPE.KICK:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);

                        if (room.master.userInfo.uid !== ws.userInfo.uid) {
                            ws.sendMessage({
                                type,
                                status: STATUS.FAIL,
                                message: '无权限踢人'
                            });
                            break;
                        }

                        const kickedUsers = room.clients.filter(client => kickedUids.includes(client.userInfo.uid));

                        if (kickedUsers.length) {
                            room.clients = room.clients.filter(client => !kickedUids.includes(client.userInfo.uid));

                            kickedUsers.forEach((user) => {
                                user.terminate();
                            });

                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                                users: room.clients.map(item => {
                                    return {
                                        score: item.score,
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        } else {
                            ws.sendMessage({
                                type,
                                status: STATUS.FAIL,
                                message: '用户不存在'
                            });
                        }

                        break;
                    case TYPE.SHOW:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);
                        if (room) {
                            const scores = room.clients.map(item => +item.score)
                                .filter(item => !isNaN(item) || item === 0);

                            wss.broadcast({
                                type,
                                average: computeAverage(scores),
                                status: STATUS.SUCCESS,
                            }, room.roomID);
                        }

                        break;
                    case TYPE.RESTART:
                        room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);

                        if (room) {
                            // 重置用户分数
                            room.clients.forEach((client) => {
                                client.score = 0;
                            })

                            wss.broadcast({
                                type,
                                users: room.clients.map(client => {
                                    return {
                                        score: client.score,
                                        userInfo: client.userInfo,
                                    }
                                }),
                                status: STATUS.SUCCESS,
                            }, room.roomID);
                        }

                        break;
                    default:
                        break;
                }

                console.log(type + ' triggered');

            } catch (err) {
                const errMessage = {
                    type,
                    status: STATUS.ERROR,
                    userInfo,
                    roomID,
                    score,
                    errMessage: err.toString(),
                    errStack: err.stack,
                }

                console.log(errMessage);

                ws.sendMessage(errMessage);
            }

        });

        ws.on('pong', heartbeat);

        ws.on('close', function (data) {
            try {
                const room = wss.APP_INFO.rooms.find(item => item.roomID === ws.roomID);

                if (room) {
                    room.clients = room.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);

                    wss.broadcast({
                        type: TYPE.CLOSE,
                        userInfo: ws.userInfo,
                        users: room.clients.map(item => {
                            return {
                                score: item.score,
                                userInfo: item.userInfo,
                            }
                        }),
                    })
                }
            } catch (e) {
                console.log('[SERVER] error on close: ', e)
            }

        });
    });

    const interval = setInterval(function ping() {

        wss.APP_INFO.rooms.forEach((room) => {
            if (room.master.isAlive === false) {
                room.master.terminate();
            } else {
                room.master.isAlive = false;
                room.master.ping(noop);
            }

            room.clients.forEach((ws) => {
                if (ws.isAlive === false) return ws.terminate();

                ws.isAlive = false;
                ws.ping(noop);
            })

        });
    }, 60000);

    wss.on('error', () => {
        clearInterval(interval);
    });

    wss.on('close', () => {
        clearInterval(interval);
    });
}
