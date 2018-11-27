const path = require('path');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');

const ws = require('./ws');
const router = require('./router');

const resolve = file => path.resolve(__dirname, file);

const app = new Koa();
const port = 9000;

// 将请求体转换为 JSON 的中间件
app.use(bodyParser());
// 路由处理
router(app)

const server = app.listen(port, () => {
    console.log('application start at ', port);
});

// 开启webscoket
ws(server);
