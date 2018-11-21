const KoaRouter = require('koa-router');

module.exports = (koaApp) => {
    const router = new KoaRouter();

    router.get('*', (ctx, next) => {
        ctx.status = 200;
        ctx.body = 'Success';
    });
    koaApp.use(router.routes());
    koaApp.use(router.allowedMethods());
}
