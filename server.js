const path = require('path');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');

const ws = require('./ws');
const router = require('./router');

const resolve = file => path.resolve(__dirname, file);

const app = new Koa();

// 将请求体转换为 JSON 的中间件
app.use(bodyParser());
// 路由处理
router(app)

const server = app.listen(9000, () => {
    console.log('application start');
});

// 开启webscoket
ws(server);
