# deploy/ — 所有部署依赖的版本化备份

这里收录了朝堂系统全部外部依赖的**脱敏配置模板**，换机器或重装后从这里恢复。

## 目录结构

```
deploy/
├── env.example                          → 复制为 .env.local 并填写真实值
├── litellm-config.template.yaml         → 复制为 ~/.openclaw/litellm_config.yaml 并填写 API key
├── services/
│   ├── courtos-web.service.template     → systemd: Next.js 前端 (:3050)
│   ├── litellm.service.template         → systemd: LiteLLM AI 网关 (:4444)
│   ├── legal-agent-manor.service.template → systemd: 法务 agent (:18003)
│   └── jiqun.service.template           → systemd: 产线执行引擎 (:8081)
└── README.md                            → 本文件
```

## 快速恢复（换机器/重装后）

```bash
# 1. 克隆唯一代码真源（前端与后端同属一个 monorepo）
git clone git@gitee.com:msxn/chaotang-os.git \
  /home/ubuntu/Projects/chaotang-os

# 法务 agent 是独立外部依赖，不属于朝堂 OS 代码真源。
git clone git@github.com:NUTSLYCLYT/legal-agent.git \
  /home/ubuntu/legal-agent

# 2. 配置前端 env
cd /home/ubuntu/Projects/chaotang-os/frontend
cp deploy/env.example .env.local
# 编辑 .env.local，填写所有真实值

# 3. 安装并验证后端生产运行环境
cd /home/ubuntu/Projects/chaotang-os/backend
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip check
.venv/bin/python -c "import gunicorn, uvicorn, web.main"

# 4. 配置 LiteLLM
cd /home/ubuntu/Projects/chaotang-os/frontend
cp deploy/litellm-config.template.yaml ~/.openclaw/litellm_config.yaml
# 编辑 ~/.openclaw/litellm_config.yaml，填写所有 <FILL_IN>

# 5. 安装 systemd service
for svc in courtos-web litellm legal-agent-manor jiqun; do
  cp deploy/services/${svc}.service.template ~/.config/systemd/user/${svc}.service
done
systemctl --user daemon-reload

# 6. 一键恢复
bash scripts/system-restore.sh
```

## 真实 API key 存放位置（绝不进 git）

| 配置项 | 存放位置 |
|--------|---------|
| LiteLLM API key (claude/deepseek/openai) | `~/.openclaw/litellm_config.yaml` |
| LiteLLM master_key | `~/.openclaw/litellm_config.yaml` + `.env.local` (OPENAI_API_KEY) |
| JWT_SECRET | `.env.local` + jiqun `.env` (两处必须一致) |
| TURSO_AUTH_TOKEN | `.env.local` |
| CHAOTANG_ALERT_URL (Telegram webhook) | `.env.local` |

## 完整运维手册

见 `docs/DEPLOY-RUNBOOK.md`。
