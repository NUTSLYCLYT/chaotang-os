# 朝堂 OS 本地封闭试用

这个入口用于 Windows 本地封闭试用：启动真实 FastAPI 后端和真实 Next.js 前端，绑定到 `127.0.0.1`，不自动打开浏览器，不创建或猜测任何模型密钥。

## 首次准备

在仓库根目录执行：

```powershell
cd frontend
npm ci
cd ..\backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..
```

启动脚本不会自动下载依赖，也不会访问公共网络。

## 启动

最简单的方式是双击 `scripts\start-local.cmd`，或在 PowerShell 执行：

```powershell
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1 -Action Start -Build
```

`-Build` 会在本地依赖已经安装的前提下构建生产前端；省略它时，如果没有 `.next\BUILD_ID`，脚本会明确进入 Next.js 开发模式。服务就绪后访问：

- 前端：`http://127.0.0.1:3000/`
- 健康页：`http://127.0.0.1:3000/health`

## 状态和停止

```powershell
pwsh -File scripts\start-local.ps1 -Action Status
pwsh -File scripts\start-local.ps1 -Action Stop
```

停止动作按 PID 树回收本次启动的前后端，不触碰其他端口或其他项目进程。日志写入 `%LOCALAPPDATA%\ChaotangOS\logs`，运行状态写入 `%LOCALAPPDATA%\ChaotangOS\local-runtime.json`。

## 真实模型边界

启动脚本只负责本地服务，不会自动发送模型请求。用户提交上书房任务时，后端才会依据现有 provider 配置和预算门调用模型；没有凭据时应返回明确的配置错误。不要把 API key 写入脚本、仓库或日志。

## 回退

若本地试用后需要回退，先执行 `-Action Stop`，保留日志，再切换回已验证提交 `19367a82228f6e9bd7a4624b7895f35e59adc02d`。脚本本身不修改数据库 schema、不迁移数据、不发布到公网。
