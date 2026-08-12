# chaotang-os 单机容器部署设计

## 状态与范围

本文记录 2026-08-11 已确认的首期生产部署基座设计。目标主机为 Ubuntu
22.04 单机，采用 Docker Compose、Caddy、Next.js frontend 和 FastAPI backend。
本设计不授权实际部署、服务器写入、公网切流或密钥操作。

本文不修改或绕过 ADR 0028。浏览器仍只访问 Next.js 同源入口，Next.js BFF
通过 `BACKEND_BASE_URL` 调用 FastAPI，业务流与证据治理边界保持不变。

## 已确认决策

- 首期为单机、单 backend 容器、单 Uvicorn worker。
- 暂无域名，不配置 TLS，不开放公网 HTTP。
- Caddy 只绑定宿主机 `127.0.0.1:8080`，使用 SSH 隧道验收。
- frontend 的 3000 和 backend 的 8000 仅存在于 Compose 内部网络。
- 首期没有私有镜像仓库；镜像由可信构建机生成，以离线镜像包交付。
- 所有镜像、镜像包、Compose 清单和备份都必须可校验、可追溯、可回滚。

## 运行拓扑

```text
本机浏览器 http://127.0.0.1:8080
        |
        | SSH 加密隧道
        v
服务器 127.0.0.1:8080
        |
      Caddy
        |
 frontend:3000
        |
        | BACKEND_BASE_URL=http://backend:8000
        v
 backend:8000
        |
        +-- 持久化 SQLite 数据目录
        +-- 持久化报告附件目录
        +-- 只读财务源数据目录
```

Caddy 是唯一宿主机入口。Compose 不发布 frontend 或 backend 端口。Caddy
配置关闭自动 HTTPS，只提供 loopback HTTP；未来启用域名和 TLS 时必须通过新的生产授权门禁。

## 容器设计

### Caddy

- 使用固定语义版本和镜像摘要，禁止 `latest`。
- 只绑定 `127.0.0.1:8080`。
- 反向代理到 `frontend:3000`。
- 为同步模型调用保留不短于前端既有 120 秒契约的代理超时预算。
- 添加基础安全响应头；在无 TLS 阶段不声明依赖 HTTPS 的 HSTS。
- 配置文件只读挂载，运行数据与日志不得包含应用密钥。

### Frontend

- 使用 Next.js standalone 生产输出。
- Node 基础镜像必须通过完整镜像引用（版本和摘要）传入构建，不提供浮动默认值。
- 运行时使用固定非 root UID/GID，监听容器内 `3000`。
- `BACKEND_BASE_URL` 固定为 `http://backend:8000`。
- 不挂载业务数据，不接收 backend 密钥。
- 根文件系统只读；仅为框架确实需要的临时路径提供受限 tmpfs。

### Backend

- Python 基础镜像必须通过完整镜像引用（版本和摘要）传入构建，不提供浮动默认值。
- 按 backend 锁定依赖构建；生产镜像不安装开发依赖。
- 使用固定非 root UID/GID，监听容器内 `8000`。
- 只运行一个 backend 容器和一个 Uvicorn worker。
- `CHAOTANG_DECREE_JOB_WORKER_ENABLED` 只在该实例启用。
- 锦衣卫外网保持默认关闭；生产凭据来源为环境注入，不读取 Windows DPAPI。
- 根文件系统只读，仅数据、附件和必要临时目录可写。

## 宿主机目录与权限

```text
/opt/chaotang-os/
  releases/       离线镜像包、校验清单、发布清单
  current/        当前发布清单，不存密钥

/srv/chaotang-os/
  data/           backend SQLite 数据库及 WAL/SHM
  artifacts/      报告附件
  accounting/     财务源数据，只读提供给 backend
  backups/        本机备份和恢复演练输出

/etc/chaotang-os/
  production.env  运行密钥和环境变量，仓库外，权限 0600
```

应用容器使用非 root 身份。数据与附件目录只授权 backend UID/GID 写入；财务源数据
目录只读；frontend 与 Caddy 无权访问业务数据。部署操作员不加入 `docker` 组，避免获得
等价 root 权限；需要的 Compose 生命周期操作通过受限 sudo/systemd 路径执行。

## 密钥与配置

- `DEEPSEEK_API_KEY`、`WESTOCK_MCP_CREDENTIAL` 等仅在服务器仓库外配置。
- 密钥不得进入镜像层、离线镜像包、Compose 文件、Git、命令参数或日志。
- `/etc/chaotang-os/production.env` 由 root 管理并设置 0600；创建和写入密钥需要单独确认。
- 非密钥配置进入版本化 Compose/Caddy 配置；生产专用值通过明确的环境接口注入。
- `JINYIWEI_EXTERNAL_NETWORK_ENABLED` 默认关闭。任何真实外网调用另行授权。

## 镜像构建与离线交付

可信构建环境按以下顺序产出发布包：

1. 从干净、已确认的 Git HEAD 构建。
2. 前后端严格按锁文件安装依赖。
3. 运行仓库规定的 lint、typecheck、test、build 和集成验证。
4. 构建 frontend/backend 镜像；所有基础镜像按摘要固定。
5. 记录 Git HEAD、依赖锁文件摘要、基础镜像摘要、最终镜像 ID 和构建命令退出码。
6. 生成 SBOM 和发布清单。
7. 使用 `docker save` 导出镜像并压缩。
8. 为所有交付文件生成 SHA-256 清单。

上传服务器前后都校验 SHA-256。校验失败时停止，不执行 `docker load`。生产 Compose
使用发布清单中的不可变镜像引用，不使用浮动标签。至少保留当前版和上一可恢复版的镜像包。

## 启动、健康检查与 systemd

启动门禁为：

1. backend 容器启动，`/health` 通过存活检查。
2. backend `/readyz` 返回 ready。
3. frontend 启动并通过同源健康页面检查。
4. Caddy loopback 入口返回成功。
5. 通过 SSH 隧道完成端到端验收。

systemd 单元管理整套 Compose 生命周期，失败时保留日志并按受限策略重启。Compose
服务设置健康检查和有界重启策略。Docker 日志使用大小和文件数量上限轮转；systemd 与
Docker 日志不得记录环境变量或请求密钥。

SSH 隧道由操作端建立：

```powershell
ssh -N -L 8080:127.0.0.1:8080 root@132.232.137.45
```

访问入口为 `http://127.0.0.1:8080`。这不是公网发布，也不授权修改防火墙或 SSH 策略。

## 备份与恢复

日常备份使用 SQLite 安全备份接口逐库生成一致文件，不直接复制活动数据库。发布前和
涉及 schema 的操作前执行一致性冷备：先停止 backend 写入，再一起备份全部 SQLite、
相关 WAL/SHM 状态、附件目录、发布清单和 schema 版本。

每份备份包含：

- 创建时间、应用 Git HEAD 与镜像 ID；
- 各 SQLite schema 版本；
- 文件清单与 SHA-256；
- 备份命令及退出码；
- 恢复演练结果。

备份完成不等于可恢复。首次上线前必须在隔离目录完成一次恢复演练，验证数据库完整性、
附件关联、`/readyz` 和只读业务查询。远端或异地备份不在首期执行范围，后续单独设计和授权。

## 发布与回滚

发布前必须具备当前数据冷备、上一版镜像包、上一版 Compose/Caddy 清单和对应 SHA-256。
发布失败时：

1. 停止故障版本并保留日志。
2. 对故障现场制作只读证据快照，不覆盖发布前备份。
3. 加载上一版镜像并恢复上一版清单。
4. 若 schema 不向后兼容，恢复对应发布前数据备份；禁止让旧代码直接打开新 schema。
5. 重新执行 backend、frontend、Caddy 和 SSH 隧道端到端验收。

任何数据恢复、覆盖、删除或数据库迁移都属于生产数据写操作，执行前需要单独确认。

## 验证与最终验收

仓库实现阶段至少验证：

- Dockerfile/Compose 静态安全检查；
- 镜像以非 root 身份运行且根文件系统只读；
- frontend 只能通过 BFF 访问 backend；
- 3000/8000 未发布到宿主机；
- Caddy 只绑定 loopback；
- `/health`、`/readyz`、frontend 健康页和入口代理；
- 数据持久化、重启后读取与备份恢复；
- 离线镜像包摘要失败时拒绝加载；
- 上一版镜像和数据的回滚演练；
- ADR 0028 完整性与仓库 harness。

同一最终版本按根 `AGENTS.md` 规定连续完整通过十轮最终验收；任一轮失败，或代码、配置、
验收流程发生实质变化后，从第一轮重新计数。真实密钥、真实外网和生产数据不用于仓库测试。

## 分阶段门禁

### 仓库实现阶段已授权

- 新增部署 ADR、Dockerfile、Compose、Caddy 配置、构建/校验脚本、测试和运维文档。
- 调整 Next.js 为 standalone 输出，前提是保持现有业务行为并通过回归验证。
- 不提交、不推送，不修改 ADR 0028。

### 未授权，必须逐项确认

- 安装或升级服务器软件，包括 Docker、Compose 和 Caddy 相关组件；
- 创建服务器用户、目录、systemd 单元或写入任何生产配置；
- 上传源码、镜像、真实数据、备份或密钥；
- 执行 `docker load`、启动容器或部署应用；
- 修改防火墙、SSH 登录策略、DNS、证书或域名；
- 开放 80/443/3000/8000 或实施公网切流；
- 数据库迁移、恢复、覆盖、删除或导入真实数据；
- 启用锦衣卫真实外网或付费 API。

## 完成标准

仓库部署基座只有在配置、测试、构建、离线交付、备份和回滚脚本均通过新鲜验证后才可称为
实现完成。服务器只有在单独授权的准备步骤、恢复演练和十轮最终验收全部通过后才可标记为
上线准备 PASS；未获得授权的生产动作保持门禁状态，不以文档或本地测试替代。
