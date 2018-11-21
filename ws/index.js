const WebSocket = require('ws');
const uuidv4 = require('uuid/v4');

const ApplicationInfo = require('../data/applicationInfo');

const noop = () => { };


module.exports = (server) => {
    const wss = new WebSocket.Server({
        server,
    });

    const interval = setInterval(function ping() {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping(noop);
        })
    });

    function heartbeat() {
        this.isAlive = true;
    }

    wss.APP_INFO = new ApplicationInfo();



    wss.broadcast = (data) => {
        wss.APP_INFO.clients.forEach((item) => {
            item.send(JSON.stringify(data));
        })
    }

    wss.on('connection', function (ws, req) {
        console.log(`[SERVER] connection()`);
        const clientIp = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        ws.clientIp = clientIp;

        ws.isAlive = true;

        ws.on('pong', heartbeat);

        ws.on('message', function (data) {
            const message = JSON.parse(data);
            const { userInfo, type, roomID = '', score } = message;
            console.log(`[SERVER] Received: ${JSON.parse(data)}`);

            if (!message) {
                ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: 'Invalid Message!'
                }));
                return;
            }

            switch (type) {
                case 'CREATE':
                    try {
                        const roomID = uuidv4().slice(0, 4).toUpperCase();

                        wss.APP_INFO.init();
                        ws.userInfo = userInfo;
                        wss.APP_INFO.master = ws;
                        wss.APP_INFO.roomID = roomID;
                        ws.send(JSON.stringify({
                            type: 'CREATE_SUCCESS',
                            roomID,
                        }));
                        console.log('CREATE triggered');
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            message: `[Server Error] type:CREATE User:${JSON.stringify(userInfo)} Error:${JSON.stringify(err)}`
                        }));
                    }

                    break;
                case 'JOIN':
                    try {
                        if (!wss.APP_INFO.roomID || wss.APP_INFO.roomID !== roomID) {
                            ws.send(JSON.stringify({
                                type: 'ERROR',
                                message: '房间不存在'
                            }));
                        } else {
                            ws.userInfo = userInfo;
                            wss.broadcast({
                                type: 'JOIN_USER',
                                userInfo,
                            });
                            wss.APP_INFO.clients.push(ws);
                            ws.send({
                                type: 'JOIN_SUCCESS',
                            });
                        }
                        console.log('JOIN triggered');
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'EEROR',
                            message: `[Server] type:JOIN User:${JSON.stringify(userInfo)} Error:${JSON.stringify(err)}`
                        }));
                    }

                    break;
                case 'LEAVE':
                    try {
                        if (wss.APP_INFO.roomID && wss.APP_INFO.roomID === roomID) {
                            wss.APP_INFO.clients = wss.APP_INFO.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);
                            ws.send({
                                type: 'LEAVE_SUCCESS',
                            });
                            ws.terminate();

                            wss.broadcast({
                                type: 'LEAVE_USER',
                                userInfo: ws.userInfo,
                            });
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'EEROR',
                            message: `[Server] type:LEAVE User:${JSON.stringify(ws.userInfo)} Error:${JSON.stringify(err)}`
                        }));
                    }

                    break;
                case 'GRADE':
                    try {
                        if (score && score > 0) {
                            ws.score = score;
                            ws.send(JSON.stringify({
                                type: 'GRADE_SUCCESS',
                            }));
                            wss.broadcast({
                                users: wss.APP_INFO.clients.map(client => {
                                    return {
                                        score: client.score,
                                        userInfo: client.userInfo,
                                    }

                                }),
                                type: 'GRADE_UPDATE',
                            });
                        } else {
                            ws.send(JSON.stringify({
                                type: 'EEROR',
                                message: 'SCORE ERROR'
                            }));
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'EEROR',
                            message: `[Server] type:LEAVE User:${JSON.stringify(ws.userInfo)} Error:${JSON.stringify(err)}`
                        }));
                    }
                    break;
                default:
                    break;
            }
            ws.send(JSON.stringify(message), (err) => {
                if (err) {
                    console.log(`[SERVER] error: ${err}`);
                }
            });
        });

        ws.on('close', function (data) {
            wss.APP_INFO.clients.filter((item) => item.userInfo.uid !== ws.userInfo.uid);
        });
    });
}
