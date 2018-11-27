const WebSocket = require('ws');
const uuidv4 = require('uuid/v4');

const TYPE = require('../data/operationType');
const STATUS = require('../data/operationStatus');
const AppInfo = require('../data/applicationInfo');
const { computeAverage } = require('../utils');

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

    wss.APP_INFO = new AppInfo();


    wss.broadcast = (data) => {
        const broadcastMsg = Object.assign({}, data, { isBroadcast: true });

        console.log('broadcast:', JSON.stringify(broadcastMsg));

        wss.APP_INFO.master && wss.APP_INFO.master.sendMessage && wss.APP_INFO.master.sendMessage(broadcastMsg);

        wss.APP_INFO.clients.forEach((item) => {
            item.sendMessage(broadcastMsg);
        });
    }


    wss.on('connection', function (ws, req) {
        ws.sendMessage = sendMessage;

        console.log(`[SERVER] connection()`);

        ws.on('message', function (data) {
            const message = JSON.parse(data) || {};
            const { userInfo = {}, type = '', roomID = '', score, kickedUids = [] } = message;
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
                        // 重连状态
                        if (wss.APP_INFO.master.userInfo
                            && wss.APP_INFO.master.userInfo.uid
                            && wss.APP_INFO.roomID
                            && wss.APP_INFO.roomID === roomID) {
                            ws.userInfo = Object.assign({}, userInfo, { uid: wss.APP_INFO.master.userInfo.uid });
                            wss.APP_INFO.master = ws;

                            ws.sendMessage({
                                type,
                                userInfo: ws.userInfo,
                                roomID: wss.APP_INFO.roomID,
                                status: STATUS.SUCCESS,
                                users: wss.APP_INFO.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        } else {
                            const newRoomID = uuidv4().slice(0, 4).toUpperCase();

                            wss.APP_INFO.init();
                            ws.userInfo = Object.assign({}, userInfo, { uid: uuidv4() });
                            wss.APP_INFO.master = ws;
                            wss.APP_INFO.roomID = newRoomID;

                            ws.sendMessage({
                                type,
                                userInfo: ws.userInfo,
                                roomID: newRoomID,
                                status: STATUS.SUCCESS,
                                users: wss.APP_INFO.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        }

                        break;
                    case TYPE.JOIN:
                        if (!wss.APP_INFO.roomID || wss.APP_INFO.roomID !== roomID.toUpperCase()) {

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
                            ws.userInfo = Object.assign({}, userInfo, { uid: uuidv4() });
                            wss.broadcast({
                                type: 'JOIN_USER',
                                userInfo: ws.userInfo,
                                users: [...wss.APP_INFO.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }), { userInfo: ws.userInfo }],
                            });
                            wss.APP_INFO.clients.push(ws);

                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            });
                        }

                        break;
                    case TYPE.LEAVE:
                        if (wss.APP_INFO.roomID && wss.APP_INFO.roomID === roomID) {
                            wss.APP_INFO.clients = wss.APP_INFO.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);
                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            });
                            ws.terminate();

                            wss.broadcast({
                                type,
                                userInfo: ws.userInfo,
                                users: wss.APP_INFO.clients.map(item => {
                                    return {
                                        userInfo: item.userInfo
                                    }
                                }),
                            });
                        }

                        break;
                    case TYPE.GRADE:
                        if (score && score > 0) {
                            ws.score = score;
                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                            })
                            wss.broadcast({
                                users: wss.APP_INFO.clients.map(client => {
                                    return {
                                        score: client.score,
                                        userInfo: client.userInfo,
                                    }
                                }),
                                type,
                            });
                        } else {
                            ws.send(JSON.stringify({
                                type,
                                status: STATUS.FAIL,
                                message: 'Score Invalid'
                            }));
                        }

                        break;

                    case TYPE.KICK:
                        if (wss.APP_INFO.master.userInfo.uid !== ws.userInfo.uid) {
                            ws.sendMessage({
                                type,
                                status: STATUS.FAIL,
                                message: '无权限踢人'
                            });
                            break;
                        }

                        const kickedUsers = wss.APP_INFO.clients.filter(client => kickedUids.includes(client.userInfo.uid));

                        if (kickedUsers.length) {
                            wss.APP_INFO.clients = wss.APP_INFO.clients.filter(client => !kickedUids.includes(client.userInfo.uid));

                            kickedUsers.forEach((user) => {
                                user.terminate();
                            });
                            
                            ws.sendMessage({
                                type,
                                status: STATUS.SUCCESS,
                                users: wss.APP_INFO.clients.map(item => {
                                    return {
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
                        const scores = wss.APP_INFO.clients.map(item => +item.score)
                            .filter(item => !isNaN(item));

                        wss.broadcast({
                            type,
                            average: computeAverage(scores),
                            status: STATUS.SUCCESS,
                        });
                        break;
                    case TYPE.RESTART:
                        // 重置用户分数
                        wss.APP_INFO.clients.forEach((client)=>{
                            client.score = 0;
                        })

                        wss.broadcast({
                            type,
                            users: wss.APP_INFO.clients.map(client => {
                                return {
                                    score: client.score,
                                    userInfo: client.userInfo,
                                }
                            }),
                            status: STATUS.SUCCESS,
                        });
                        break;
                    case TYPE.PONG:
                        ws.sendMessage({
                            type,
                            status: STATUS.SUCCESS,
                        });
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

        ws.on('close', function (data) {
            try {
                wss.APP_INFO.clients = wss.APP_INFO.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);
                wss.broadcast({
                    type: TYPE.CLOSE,
                    userInfo: ws.userInfo,
                    users: wss.APP_INFO.clients.map(item => {
                        return {
                            userInfo: item.userInfo
                        }
                    }),
                })
            } catch (e) {
                console.log('[SERVER] error on close: ', e)
            }

        });
    });
}
