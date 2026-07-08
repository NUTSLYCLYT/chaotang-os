> ⚠️ 吸收自 `chaotang-web-ui`(旧生产仓),快照 2026-05-12。三点需先核实再当 SoT:
> ① 它描述的是 **chaotang-web-ui** 的部署,主线切到 **chaotang-web-lyt** 上线时 nginx/systemd 的源目录与构建命令要相应改;
> ② 当前公网 :3050 实际跑的仍是 chaotang-web-ui,迁到 lyt 前别照抄端口/路径;
> ③ 配套生产踩坑教训见同目录 `PROD_LESSONS.md`(beforeFiles/prerender-404 等)。
> —— 2026-06-16 大神会审吸收(charity-majors 警示:快照需对照当前生产核实)。

# 朝堂 OS · CourtOS V2 — 前端部署文档

> 基于 2026-05-12 在 `132.232.137.45` 完成部署的实际过程整理。所有命令均已实测、可复现。
> 配套后端文档：`/opt/jiqun_ai/DEPLOYMENT.md`（蜂群系统）。

---

## 一、项目概述

**朝堂 OS (CourtOS V2)** 是面向多 Agent 协作平台的前端控制台，与后端蜂群系统 (jiqun_ai / fengqun) 配套使用。

| 项目 | 值 |
|---|---|
| 前端代码量 | ~50 路由 / 26 业务文件 / Next.js App Router |
| 公网入口 | http://132.232.137.45/ → 重定向到 `/chaotang/intro` |
| 服务器 | 腾讯云 Ubuntu 22.04 / 4 vCPU / 7.6GB RAM / 50GB SSD |
| 部署完成 | 2026-05-12 |

---

## 二、技术栈

### 前端 (apps/web)

| 类别 | 选型 | 版本 |
|---|---|---|
| **运行时** | Node.js | 24.15.0 |
| **包管理** | pnpm (corepack) | 11.1.0 |
| **框架** | Next.js (App Router + webpack 模式) | 16.2.4 |
| **UI** | React | 19.2.4 |
| **样式** | Tailwind CSS 4 (`@theme` 块) | ^4 |
| **状态** | Zustand + SWR | 5.0.12 / 2.4.1 |
| **动画** | motion (新版 framer-motion) | 12.38.0 |
| **图标** | lucide-react | 1.14.0 |
| **流程图** | @xyflow/react | 12.10.2 |
| **Schema** | Zod | 4.4.1 |
| **实时通信** | socket.io-client | 4.8.3 |
| **Toast** | sonner | 2.0.7 |
| **TypeScript** | 严格模式 | ^5 |

### 后端 (jiqun_ai，已存在)

| 类别 | 选型 |
|---|---|
| 运行时 | Python 3.12 (venv 在 `/opt/jiqun_ai/.venv`) |
| Web 框架 | Flask + gunicorn (gthread, 2 worker × 8 thread) |
| LLM 编排 | LiteLLM + 自研 FlowEngine |
| 持久化 | 文件系统 (`runs/`、`data/`、`memory/`) |
| 协议 | MCP (Model Context Protocol) |

### 基础设施

| 组件 | 角色 |
|---|---|
| **nginx 1.18** | 反向代理 (80 → 3050) + 静态资源缓存 |
| **systemd** | 进程守护 (开机自启、failure 自重启) |
| **journald** | 日志集中化 |

---

## 三、系统架构

### 3.1 网络拓扑

```
                         公网 80 (http)
                              │
              ┌───────────────▼─────────────────────┐
              │  nginx 1.18                         │
              │  /              → 302 /chaotang     │
              │  /chaotang      → upstream 3050     │
              │  /chaotang/*    → upstream 3050     │
              │  /socket.io/*   → upstream 3050     │
              │  /healthz       → 200 ok            │
              └───────────────┬─────────────────────┘
                              │ proxy_pass
                              ▼
              ┌─────────────────────────────────────┐
              │  chaotang-web.service               │
              │  Next.js 16 (next start)            │
              │  Port 3050, basePath=/chaotang      │
              │  WorkingDir: /opt/chaotang_web/     │
              └────┬──────────────────┬─────────────┘
                   │ rewrite          │ rewrite
                   │ /api/v1/*        │ /jiqun/api/*
                   ▼                  ▼
        ┌──────────────────┐  ┌─────────────────────┐
        │  NestJS :3000    │  │  Flask :8011        │
        │  (业务后端)        │  │  (jiqun_ai)        │
        │  ❌ 未部署         │  │  ✅ active          │
        │  /api/v1/auth     │  │  /api/runs         │
        │  /api/v1/swarms   │  │  /api/flows        │
        │  /api/v1/tasks    │  │  /api/prompts      │
        │  ...              │  │  /api/analytics    │
        └──────────────────┘  └─────────────────────┘
```

### 3.2 三层服务

| 服务 | 端口 | 单元 | 进程 | 状态 |
|---|---|---|---|---|
| nginx | 80 | `nginx.service` | 1 master + 4 worker | ✅ active |
| chaotang-web | 3050 | `chaotang-web.service` | 1 next-server | ✅ active |
| jiqun_ai | 8011 | `jiqun_ai.service` | gunicorn 2W×8T | ✅ active |

### 3.3 关键设计

| 决策 | 原因 |
|---|---|
| **basePath = `/chaotang`** | 同一域名可挂多个子产品（与后端 `/opt/jiqun_ai/web` 共存） |
| **3050 不用 3001** | AGENTS.md 第 0 节硬约束：nginx upstream 固定指向 3050，禁止其他端口 |
| **webpack 模式（不用 standalone）** | `next start` 启动方式与 systemd `ExecStart` 兼容；standalone 模式需要走 `node server.js`，不利于直接 swap |
| **hybrid API 模式** | NestJS 后端缺失时前端自动 fallback 到 mock 数据，UI 不崩 |
| **`/jiqun/api/*` 走 Next.js rewrite** | Next.js 同源代理到 Flask :8011，浏览器看到的都是同源请求，绕开 CORS |

### 3.4 目录布局（服务器）

```
/opt/
├── jiqun_ai/                # 后端蜂群系统
│   ├── .venv/                # Python 虚拟环境
│   ├── web/app.py           # Flask 入口 (gunicorn 启动这个)
│   └── ...
├── chaotang_web/            # 前端
│   ├── .env.production.local  # 生产环境变量
│   ├── .next/               # webpack 构建产物 (~536MB)
│   ├── .npmrc               # verify-deps-before-run=false
│   ├── node_modules/        # 依赖 (~2GB)
│   ├── public/              # 静态资源
│   ├── src/                 # 源码
│   ├── package.json
│   └── pnpm-lock.yaml
└── fengqun/                 # 旧版本 (历史遗留)

/etc/systemd/system/
├── jiqun_ai.service
└── chaotang-web.service

/etc/nginx/sites-available/chaotang  →  symlink to sites-enabled/
```

---

## 四、从零到一安装部署

完整可复现流程。已假定服务器是裸 Ubuntu 22.04 + 后端 `jiqun_ai.service` 已经在跑。

### 4.1 服务器环境准备

```bash
# 装 nginx + curl + ca + gnupg
apt-get update
apt-get install -y nginx curl ca-certificates gnupg

# 装 Node.js 24 (NodeSource 官方源)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

# 启用 corepack 并装 pnpm
corepack enable
corepack prepare pnpm@latest --activate

# 验证
node -v    # v24.15.0
pnpm -v    # 11.1.0
nginx -v   # nginx version: nginx/1.18.0
```

### 4.2 上传前端源码

**本地 (Windows) 打包**：

```bash
cd D:/workspace/chaotang/web
tar --exclude='node_modules' --exclude='.next' --exclude='.tmp' \
    --exclude='*.DS_Store' --exclude='tsconfig.tsbuildinfo' \
    -czf /tmp/chaotang-web.tar.gz .
# 产物 ~4.2MB
```

**上传到服务器**（用 plink + pscp，Windows OpenSSH 没 sshpass）：

```bash
pscp -hostkey "ssh-ed25519 ..." -pw "<密码>" \
     /tmp/chaotang-web.tar.gz \
     root@132.232.137.45:/opt/chaotang_web/source.tar.gz
```

**服务器解压**：

```bash
cd /opt/chaotang_web
tar xzf source.tar.gz
rm source.tar.gz
```

### 4.3 关键：处理 pnpm 11 的 build script 检查

pnpm 11 把 ignored builds 视为致命错误。**必须**先写项目级 `.npmrc`：

```bash
cd /opt/chaotang_web
cat > .npmrc <<'EOF'
verify-deps-before-run=false
ignored-built-dependencies=
EOF
```

### 4.4 配置生产环境变量

```bash
cat > /opt/chaotang_web/.env.production.local <<'EOF'
# basePath - 与 nginx 反代路径对齐
BASE_PATH=/chaotang
NEXT_PUBLIC_BASE_PATH=/chaotang

# jiqun_ai Flask 后端真实端口是 8011，不是项目默认的 8081
JIQUN_API_URL=http://127.0.0.1:8011
JIQUN_BASE_URL=http://127.0.0.1:8011

# NestJS 后端缺失，留占位
NEXT_PUBLIC_API_URL=
COURTOS_API_URL=http://127.0.0.1:3000/api/v1
NEXT_PUBLIC_WS_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_MODE=hybrid
NEXT_PUBLIC_V1_API_URL=/chaotang/api/v1

# Console basic-auth
COURT_CONSOLE_BASIC_AUTH=admin:chaotang2026

JIQUN_ADMIN_TOKEN=
NODE_ENV=production
EOF
```

### 4.5 安装依赖 + 构建

```bash
cd /opt/chaotang_web
pnpm install --frozen-lockfile
# 如果 sharp 报错，pnpm rebuild sharp

# 不走 pnpm build (会触发 verify-deps 失败)，直接 next build
BASE_PATH=/chaotang ./node_modules/.bin/next build --webpack
# 约 90-120s，产物 ~536MB .next/
```

### 4.6 systemd 单元

```bash
cat > /etc/systemd/system/chaotang-web.service <<'EOF'
[Unit]
Description=Chaotang Web (Next.js 16, basePath=/chaotang, port 3050)
After=network-online.target jiqun_ai.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chaotang_web
EnvironmentFile=/opt/chaotang_web/.env.production.local
Environment=NODE_ENV=production
Environment=PORT=3050
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node /opt/chaotang_web/node_modules/next/dist/bin/next start -p 3050 -H 0.0.0.0
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=chaotang-web
LimitNOFILE=65536
MemoryMax=2G

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now chaotang-web
```

### 4.7 nginx 反向代理

```bash
cat > /etc/nginx/sites-available/chaotang <<'EOF'
upstream chaotang_web {
    server 127.0.0.1:3050;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    location = / {
        return 302 /chaotang;
    }

    # 前缀匹配：同时覆盖 /chaotang 和 /chaotang/*
    # 不能拆成两条，否则 Next.js 的 trailing-slash 308 跳转会和 nginx 死循环
    location /chaotang {
        proxy_pass http://chaotang_web;
    }

    location /socket.io/ {
        proxy_pass http://chaotang_web;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /healthz {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/chaotang /etc/nginx/sites-enabled/chaotang
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

### 4.8 烟测验证

```bash
for p in '/' '/healthz' '/chaotang/intro' '/chaotang/login' '/chaotang/jiqun/runs'; do
  printf '%-30s ' "$p"
  curl -s -o /dev/null -w 'http=%{http_code} size=%{size_download}b\n' "http://127.0.0.1$p"
done
```

期望输出：

```
/                              http=302  size=154b
/healthz                       http=200  size=3b
/chaotang/intro                http=200  size=10655b
/chaotang/login                http=200  size=10622b
/chaotang/jiqun/runs           http=200  size=56154b
```

---

## 五、配置说明

### 5.1 环境变量优先级

`.env.production.local` 覆盖一切。注意几个易错点：

| 变量 | 默认 | 实际生产值 | 说明 |
|---|---|---|---|
| `BASE_PATH` | (空) | `/chaotang` | 编译期，决定 Next.js basePath |
| `NEXT_PUBLIC_BASE_PATH` | (空) | `/chaotang` | 浏览器端，SWR fetcher 必须知道这个才能命中 rewrite |
| `JIQUN_API_URL` | `http://localhost:8081` | `http://127.0.0.1:8011` | **项目默认 8081 是错的**，实际后端在 8011 |
| `NEXT_PUBLIC_API_URL` | (空) | (空) | 走 basePath rewrite |
| `COURTOS_API_URL` | `http://localhost:3000/api/v1` | 同 | NestJS BFF 路由用，缺失时降级 |

### 5.2 前端两套 API 路径

| 浏览器请求 | Next.js rewrite 目标 | 实际状态 |
|---|---|---|
| `/chaotang/api/v1/*` | `${NEXT_PUBLIC_API_URL}/api/v1/*` → NestJS :3000 | ❌ 后端缺失 |
| `/chaotang/jiqun/api/*` | `${JIQUN_API_URL}/api/*` → Flask :8011 | ✅ 可用 |

前端 `lib/api.ts`（SWR fetcher）调用 `/api/v1/*` 时，因 hybrid 模式 fallback 到 mock 数据，UI 不报错但显示假数据。

---

## 六、运维操作

### 6.1 日常命令

```bash
# 状态
systemctl status chaotang-web
systemctl status jiqun_ai
systemctl status nginx

# 重启 (前端 2s 就绪，后端 ~5s)
systemctl restart chaotang-web
systemctl restart jiqun_ai
systemctl reload nginx       # nginx 改配置后 reload 不重启

# 看日志 (实时)
journalctl -u chaotang-web -f
journalctl -u jiqun_ai -f

# 看最近 100 行
journalctl -u chaotang-web -n 100 --no-pager

# 端口检查
ss -tlnp | grep -E ':(80|3050|8011) '
```

### 6.2 代码更新流程

服务器上无 git 克隆（避免暴露源代码到公网仓库），全部走 scp 上传：

```bash
# 本地
cd D:/workspace/chaotang/web
tar --exclude='node_modules' --exclude='.next' -czf /tmp/chaotang-web.tar.gz .
pscp -hostkey "..." -pw "..." /tmp/chaotang-web.tar.gz \
     root@132.232.137.45:/opt/chaotang_web/source-new.tar.gz

# 服务器
cd /opt/chaotang_web
mv .env.production.local /tmp/env.bak
tar xzf source-new.tar.gz --overwrite
mv /tmp/env.bak .env.production.local
pnpm install --frozen-lockfile
BASE_PATH=/chaotang ./node_modules/.bin/next build --webpack
systemctl restart chaotang-web
# 烟测
curl -sI http://127.0.0.1/chaotang/intro | head -1
```

### 6.3 故障排查清单

| 现象 | 检查 |
|---|---|
| 浏览器 502 | `systemctl status chaotang-web` + `journalctl -u chaotang-web -n 50` |
| 浏览器 504 | `journalctl -u jiqun_ai`，可能是 LLM 调用超时 |
| `ERR_TOO_MANY_REDIRECTS` | nginx 配置是否把 `/chaotang` 和 `/chaotang/` 拆成两条 location（不能，必须合并） |
| 控制台大量 401 | jiqun_ai 启用了 auth middleware，需要 JWT token |
| 控制台 ERR_CONNECTION_REFUSED | NestJS :3000 后端缺失，hybrid 模式会自动 fallback |
| 字体不渲染 | 检查 `app/layout.tsx` 的 4 个 `next/font` import，CSS `--font-*` 变量是否挂在 `<html>` |

---

## 七、已知限制（非部署问题）

### 7.1 NestJS 后端缺失

**影响范围**：`/api/v1/*` 路径（约 70% 业务接口）

| 涉及功能 | 当前状态 |
|---|---|
| 登录认证 (`/api/v1/auth/login`) | mock fallback 或显示后端错误 |
| 御座 (`/throne`) | UI 可显示，数据是 mock |
| 蜂群 (`/swarm`) | 同上 |
| 任务 (`/task/*`) | 同上 |
| 智能体 (`/agent/*`) | 同上 |
| 公告 / 谏言 / 史馆等 | 同上 |

**修复方向**：找回 NestJS 后端代码，部署到 `:3000`。

### 7.2 Flask 鉴权 + nginx 头部

直接 curl `http://127.0.0.1:8011/api/health` → 200，但经过 nginx X-Forwarded-* 头转发后 Flask auth middleware 拒绝。需要：
- 方案 A：Flask 一侧信任 `X-Forwarded-*`（修 jiqun_ai 代码）
- 方案 B：nginx 不带 `X-Forwarded-Host` 头转发到 `/jiqun/api/*`

不阻塞页面渲染。

### 7.3 HTTPS 缺失

当前是 80 端口裸 HTTP。生产建议：

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d app.mingshuoxny.com   # 需要先把域名 A 记录指过来
```

---

## 八、烟测脚本（建议加 cron）

`/usr/local/bin/chaotang-smoke.sh`：

```bash
#!/usr/bin/env bash
set -uo pipefail
PATHS=('/' '/healthz' '/chaotang/intro' '/chaotang/login' '/chaotang/jiqun/runs')
FAIL=0
for p in "${PATHS[@]}"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1$p")
  if [[ "$CODE" =~ ^(200|302|307|308)$ ]]; then
    printf '  ✓ %-25s %s\n' "$p" "$CODE"
  else
    printf '  ✗ %-25s %s\n' "$p" "$CODE"
    FAIL=$((FAIL+1))
  fi
done
[ "$FAIL" -eq 0 ] && echo "🟢 all green" || { echo "🔴 $FAIL failed"; exit 1; }
```

```bash
chmod +x /usr/local/bin/chaotang-smoke.sh
# cron 每 5 分钟跑一次（失败时报警自己加）
echo '*/5 * * * * /usr/local/bin/chaotang-smoke.sh >> /var/log/chaotang-smoke.log 2>&1' | crontab -
```

---

## 九、本次部署遇到的坑（教训）

1. **`pnpm build` 死循环** — pnpm 11 的 `verify-deps-before-run` 默认 on，触发 install 时 sharp 的 build script 被 ignore 后整体退出 1。修复：项目根写 `.npmrc` 关掉 `verify-deps-before-run`，或绕过 `pnpm build` 直接调 `./node_modules/.bin/next build`。

2. **nginx redirect 死循环** — 初版配了两条 `location /chaotang` 和 `location /chaotang/`，后者代理到 Next.js，前者 302 到带斜杠版本。但 Next.js 16 默认 `trailingSlash: false`，会把 `/chaotang/` 308 到 `/chaotang`，再被 nginx 302 回 `/chaotang/`，死循环。修复：合并成一条 `location /chaotang { proxy_pass ...; }`，让 Next.js 自己处理。

3. **`JIQUN_API_URL` 默认 8081 但后端在 8011** — `next.config.ts` 写死的 fallback 是 8081，必须在 env 文件里覆盖。

4. **Windows 本地 `pnpm build` 失败** — `package.json` 的 `build` script 是 `BASE_PATH=/chaotang next build --webpack`，这是 bash 语法。在 PowerShell 里要先 `$env:BASE_PATH = '/chaotang'` 再跑 `pnpm exec next build --webpack`。Linux 服务器无此问题。

5. **SSH 长命令会断** — plink 长时间不返回数据会被网络中断（`Remote side unexpectedly closed network connection`）。3 分钟以上的命令（如 next build）应该用 `nohup ... &` 后台跑，分开命令查结果。

---

## 十、关键文件清单

| 文件 | 位置 |
|---|---|
| 前端源码 | `/opt/chaotang_web/` |
| 前端构建产物 | `/opt/chaotang_web/.next/` |
| 前端环境变量 | `/opt/chaotang_web/.env.production.local` |
| 前端 systemd | `/etc/systemd/system/chaotang-web.service` |
| nginx 配置 | `/etc/nginx/sites-available/chaotang` |
| 后端代码 | `/opt/jiqun_ai/` |
| 后端环境变量 | `/opt/jiqun_ai/.env` |
| 后端 systemd | `/etc/systemd/system/jiqun_ai.service` |
| 后端文档 | `/opt/jiqun_ai/DEPLOYMENT.md` |

---

**文档版本**：v1.0 · 2026-05-12 初版
