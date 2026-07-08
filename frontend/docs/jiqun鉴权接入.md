# jiqun 后端鉴权接入（2026-06-29）

> 工部 PACK 等"产线侧"决策经 BFF 转后端 jiqun 蜂群（铁律9）。jiqun `/api/swarm/run` 需 `Authorization: Bearer <JWT>`。
> 前端 adapter（`jiqun-live-swarm-adapter.ts`）读 `process.env.JIQUN_ADMIN_TOKEN` 发 Bearer。

## 怎么配（dev / prod 都要）

token 是机密，**只放 `.env.local`（已 gitignore）/ 生产环境变量，禁提交进库、禁加 `NEXT_PUBLIC_` 前缀**（加了就进浏览器）。

```bash
# 在后端仓铸一个服务 token（用后端自己的签发函数 + .env 里的真密钥）
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
TOKEN=$(set -a; . ./.env; set +a; .venv/bin/python -c "
import sys; sys.path.insert(0,'.')
from src.tenant import _jwt_encode, DEFAULT_TENANT_SLUG
from datetime import datetime, timedelta
print(_jwt_encode({'user_id':1,'username':'svc-frontend-bff','tenant_slug':DEFAULT_TENANT_SLUG,'role':'admin','exp':(datetime.now()+timedelta(days=365)).isoformat()}))")

# 写进前端 .env.local
echo "JIQUN_ADMIN_TOKEN=$TOKEN" >> /home/ubuntu/workspace/frontend/chaotang-web-lyt/.env.local
# 重启读取：pnpm dev (3002) / pnpm start (3050)
```

**关键坑**：payload `user_id` 必须是 **int**（后端 `CurrentUser` 模型 int 解析；给字符串→500 而非 401）。

## 安全注（Schneier 纪律）

- ✅ **预铸单 token > 给前端 JWT 密钥**：密钥能伪造任意 token，爆炸半径无限；单 token 爆炸半径=它自己，可经轮换 `FENGQUN_JWT_SECRET` 一次性全吊销。
- ✅ **仅服务端**：`JIQUN_ADMIN_TOKEN`（无 `NEXT_PUBLIC_`）只在 Next API 路由/BFF 服务端可见，不进浏览器包。
- ⚠️ **会过期**：当前 365 天。到期前重铸并替换 `.env.local`，否则产线侧静默退回 401/FALLBACK。
- 🔜 **更稳的下一步**：BFF 用服务账号 username/password 走 `/api/auth/login` 按需取 token + 自动刷新（免手动轮换）；或最小权限 role（现 admin，可降到够用即可）。

## 验证

```bash
curl -s -X POST http://localhost:3002/chaotang/api/court/gongbu/pack-sizing \
  -H 'content-type: application/json' -d '{"requirement":"60V32Ah三轮电池包PACK方案"}'
# 期望：{"ok":true,"sourceLabel":"LIVE_SWARM",...}  ← 2026-06-29 实测通过
```

见 [[design-seal-document-system]] 同期；通电仪表盘 `power-status.ts` 工部已标 `live`。
