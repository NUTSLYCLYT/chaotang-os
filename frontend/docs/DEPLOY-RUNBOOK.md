# 朝堂部署手册 (DEPLOY-RUNBOOK)

> 目标：任何人从零开始，30 分钟内把朝堂完整跑起来。  
> 机器崩溃/重装后，`bash scripts/system-restore.sh` 一命令恢复全部服务。

---

## 服务拓扑

```
用户 (browser)
   │
   ▼
nginx-app.service (:8443 → :3050)
   │
   ▼
courtos-web.service (:3050)   ← Next.js prod
   ├── litellm.service (:4444)  ← AI 网关（callLLM 入口）
   │       ├── Claude OAuth proxy (:8767)
   │       ├── Codex OAuth proxy (:8771)
   │       └── DeepSeek / local Ollama
   ├── jiqun.service (:8081)    ← 产线执行引擎（蜂群/flow/真实交付）
   ├── legal-agent-manor.service (:18003) ← 刑部法务专用
   └── Turso (libsql 云)         ← 主数据库
```

---

## 前提条件

- Ubuntu 22.04 / WSL2
- `nvm` 已安装，Node.js v22 已激活（`node -v | grep v22`）
- `pnpm` 全局安装（`npm i -g pnpm`）
- Python 3.11+（`python3 --version`）
- git + SSH key 配置好 Gitee + GitHub
- Telegram bot token（可选，用于告警推送）

---

## 首次部署（从零到生产）

### 步骤一：拉代码

```bash
# 前端主仓
git clone git@gitee.com:msxn/chaotang-web-lyt.git \
  /home/ubuntu/workspace/frontend/chaotang-web-lyt

# 后端 jiqun（产线引擎）
git clone git@gitee.com:msxn/jiqun_ai.git \
  /home/ubuntu/fe/fengQun/jiqun_ai_fresh

# 法务 agent
git clone git@github.com:NUTSLYCLYT/legal-agent.git \
  /home/ubuntu/legal-agent
```

### 步骤二：配置环境变量

```bash
# 前端 env
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
cp deploy/env.example .env.local
nano .env.local    # 填写所有真实值（见下方"关键 env var 速查"）

# LiteLLM 配置
cp deploy/litellm-config.template.yaml ~/.openclaw/litellm_config.yaml
nano ~/.openclaw/litellm_config.yaml    # 替换所有 <FILL_IN>

# jiqun env（若无 .env.example 则手动建）
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
# 确保含 JWT_SECRET（必须与前端 .env.local 一致）、DATABASE_URL、FENGQUN_AUTH=true
```

### 步骤三：安装依赖

```bash
# 前端
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
pnpm install

# jiqun
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# legal-agent
cd /home/ubuntu/legal-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 步骤四：安装 systemd service

```bash
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
for svc in courtos-web litellm legal-agent-manor jiqun; do
  cp "deploy/services/${svc}.service.template" \
     "$HOME/.config/systemd/user/${svc}.service"
done
systemctl --user daemon-reload
```

### 步骤五：一键启动并验证

```bash
bash scripts/system-restore.sh
```

---

## 日常发布

只有 `master` 分支可以发布：

```bash
# 确认在 master
git checkout master && git pull origin master

# 一键重建（含 env 守门 + build + restart + 烟测）
pnpm prod:rebuild
```

`prod:rebuild` 做了什么：
1. `[0.5/4]` env 守门 — FENGQUN_AUTH/API_MODE/JWT_SECRET/JIQUN_API_URL/OPENAI_BASE_URL 全检
2. `[0/4]` 部署源守门 — HEAD 必须等于 origin/master
3. `[1/4]` webpack build
4. `[2/4]` `systemctl --user restart courtos-web.service`
5. `[3/4]` 等 :3050 就绪（最长 45s）
6. `[4/4]` 烟测主路径

---

## 主动监控 + 自愈 cron（每 5 分钟）

推荐使用**自愈 cron**而非纯探测 cron：DOWN → 先自动重启 → 25s 后再探 → 仍挂才告警（MTTR 从 5-30 分钟压到 ~30 秒）。

```bash
crontab -e
# 加入以下一行：
*/5 * * * * cd /home/ubuntu/workspace/frontend/chaotang-web-lyt && bash scripts/self-healing-monitor.sh >> ~/.openclaw/log/chaotang-self-healing.log 2>&1
```

可选：配置 Telegram 告警（自愈失败后推送）

```bash
# 在 .env.local 加：
# CHAOTANG_ALERT_URL=https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
```

手动操作：

```bash
pnpm monitor:health         # 只探测，不自愈
pnpm monitor:self-healing   # 探测+自动尝试恢复
pnpm restore:system         # 直接强制恢复所有服务
pnpm restore:system:dry     # 只检查状态，不重启
```

---

## 关键 env var 速查

| 变量 | 说明 | 生产要求 |
|------|------|---------|
| `FENGQUN_AUTH` | 后端验签门 | **必须 `true`**（false = alg:none 可绕过） |
| `NEXT_PUBLIC_API_MODE` | 前端数据源 | **必须 `real`**（mock = 假数据冒充 LIVE） |
| `JWT_SECRET` | JWT 签名密钥 | **必填**，与 jiqun `.env` 完全一致 |
| `JIQUN_API_URL` | jiqun 产线引擎地址 | `http://127.0.0.1:8081` |
| `OPENAI_BASE_URL` | LiteLLM proxy 地址 | `http://127.0.0.1:4444/v1` |
| `OPENAI_API_KEY` | LiteLLM master_key | 与 `~/.openclaw/litellm_config.yaml` 一致 |
| `TURSO_DB_URL` | 云数据库 | 缺失时降 `file:本地 SQLite` |
| `TURSO_AUTH_TOKEN` | 云数据库 token | 与 `TURSO_DB_URL` 配对 |
| `LEGAL_AGENT_BASE_URL` | 法务 agent | `http://127.0.0.1:18003` |
| `CHAOTANG_ALERT_URL` | Telegram 告警 | 可选 |

---

## 端口速查

| 服务 | 端口 | 健康检查命令 |
|------|------|------------|
| courtos-web (prod) | **3050** | `curl http://127.0.0.1:3050/chaotang/api/v1/health/ready` |
| courtos-web (dev)  | **3002** | `curl http://127.0.0.1:3002/chaotang` |
| LiteLLM 网关 | 4444 | `curl http://127.0.0.1:4444/v1/models` |
| jiqun 后端 | 8081 | `curl http://127.0.0.1:8081/api/health` |
| legal-agent | 18003 | `curl http://127.0.0.1:18003/health` |
| Claude OAuth proxy | 8767 | `curl http://127.0.0.1:8767/v1/models` |
| Codex OAuth proxy | 8771 | `curl http://127.0.0.1:8771/v1/models` |
| nginx 公网 | 8443 | `curl https://app.mingshuoxny.com/chaotang` |

---

## 灾难恢复

### 单服务故障

```bash
# 查状态
systemctl --user status <service-name>
journalctl --user -u <service-name> -n 50

# 重启
systemctl --user restart <service-name>

# 若 restart 失败（thrash limit）
systemctl --user reset-failed <service-name>
systemctl --user start <service-name>
```

### jiqun DOWN（执行臂断路）

```bash
systemctl --user status jiqun.service
systemctl --user restart jiqun.service
sleep 5 && curl http://127.0.0.1:8081/api/health

# 若无 jiqun.service，手动启动：
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
nohup bash scripts/serve-dev.sh > ~/.openclaw/log/jiqun.log 2>&1 &
```

注意：jiqun DOWN 时，sign-off 仍可成功（圣裁记录在本地 Turso），  
返回 `executionStatus: "pending_jiqun_unavailable"` — 蜂群执行将在 jiqun 恢复后重试。

### LiteLLM DOWN（AI 全降 FALLBACK）

```bash
systemctl --user restart litellm.service
# 检查 API key 是否过期：
nano ~/.openclaw/litellm_config.yaml
```

### 前端挂了

```bash
systemctl --user status courtos-web.service
# build 失败时前端会挂，先手动 build：
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
pnpm build 2>&1 | tail -20    # 看报错
# 修完再：
systemctl --user restart courtos-web.service
```

### 数据库无法连接（Turso 云不可达）

```bash
# 自动降本地 SQLite，不影响功能
ls /home/ubuntu/workspace/frontend/chaotang-web-lyt/.chaotang-main-dev.db
# 若不存在则首次 briefing 会创建
```

### 全面崩溃（换机器/重装）

```bash
git clone git@gitee.com:msxn/chaotang-web-lyt.git /home/ubuntu/workspace/frontend/chaotang-web-lyt
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
# 参考 deploy/README.md 完成 env + service 配置
bash scripts/system-restore.sh
```

---

## 安全核查（上线前必过）

```bash
# 验证 env 守门生效（缺 FENGQUN_AUTH 应失败，退出码 6）
(unset FENGQUN_AUTH; bash scripts/prod-rebuild.sh 2>&1 | head -5)

# 核心测试套件（必须 253 passed）
pnpm test:core

# 跨仓契约烟测
pnpm smoke:jiqun

# 日常门禁
pnpm gate:daily
```

---

## 相关文档

- `deploy/README.md` — 配置模板说明和快速恢复步骤
- `deploy/env.example` — 所有 env var 模板
- `AGENTS.md` — 前端开发规则和铁律
- `CLAUDE.md` — 工程铁律（大神圆桌会审沉淀）
- `docs/superpowers/plans/2026-06-27-production-hardening.md` — 本次上线加固计划
