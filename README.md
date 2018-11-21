# scrum-service
node service websocket

## 本地调试
推荐使用nodemon，可以支持热更新
### DEV
```
npm run dev
```
### PROD
```
npm start
```
### 使用VSCode Debug
在VSCode Debug功能下的`launch.json`配置如下:
```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
        "type": "node",
        "request": "launch",
        "name": "nodemon",
        "runtimeExecutable": "${env:HOME}/.nvm/versions/node/v8.9.4/bin/nodemon", // 如果使用了nvm，可以这样配置。如果没有，直接配置"nodemon"即可
        "skipFiles": [
            "${workspaceFolder}/node_modules/**/*.js",
        ],
        "program": "${workspaceFolder}/server.js",
        "protocol": "inspector",
        "restart": true,
        "console": "integratedTerminal",
        "internalConsoleOptions": "neverOpen"
    }, ]
}
```
