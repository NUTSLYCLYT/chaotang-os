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
# 1. 克隆两个主仓
git clone git@gitee.com:msxn/chaotang-web-lyt.git \
  /home/ubuntu/workspace/frontend/chaotang-web-lyt

git clone git@gitee.com:msxn/jiqun_ai.git \
  /home/ubuntu/fe/fengQun/jiqun_ai_fresh

git clone git@github.com:NUTSLYCLYT/legal-agent.git \
  /home/ubuntu/legal-agent

# 2. 配置前端 env
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
cp deploy/env.example .env.local
# 编辑 .env.local，填写所有真实值

# 3. 配置 LiteLLM
cp deploy/litellm-config.template.yaml ~/.openclaw/litellm_config.yaml
# 编辑 ~/.openclaw/litellm_config.yaml，填写所有 <FILL_IN>

# 4. 安装 systemd service
for svc in courtos-web litellm legal-agent-manor jiqun; do
  cp deploy/services/${svc}.service.template ~/.config/systemd/user/${svc}.service
done
systemctl --user daemon-reload

# 5. 一键恢复
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
