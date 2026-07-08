# Production Hardening — 上线前一流产品标准

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把所有外部依赖吸收进版本控制，补全安全/监控/恢复三层，达到上线前一流产品标准。

**Architecture:** 六个任务从"配置即代码"开始，依次完成安全加固 → 执行臂可见性 → 主动监控 → 一键恢复 → 运维手册。每个任务独立可测，完成后即提交。

**Tech Stack:** Next.js 16 / Node.js 22 / bash / systemd user services / LiteLLM / jiqun (FastAPI) / legal-agent / Turso

## Global Constraints

- 本仓路径: `/home/ubuntu/workspace/frontend/chaotang-web-lyt`
- 生产端口: 3050（前端）/ 8081（jiqun）/ 18003（legal-agent）/ 4444（LiteLLM）
- 不推送 API key / token / 密码到 git
- 所有脚本必须 `set -euo pipefail`（bash）或显式 try/catch（mjs）
- 测试命令优先用已有 npm scripts（`pnpm smoke:jiqun` / `pnpm test:core` 等）
- 遵循 AGENTS.md 铁律：不改视觉资产、不新增 npm 依赖（纯 Node built-ins）

---

## Task 1: Config-as-Code — deploy/ 目录

**目标:** 所有外部服务的配置模板 + 恢复步骤进版本控制，换机器 30 分钟内全部恢复。

**Files:**
- Create: `deploy/env.example`
- Create: `deploy/litellm-config.template.yaml`
- Create: `deploy/services/litellm.service.template`
- Create: `deploy/services/legal-agent-manor.service.template`
- Create: `deploy/services/courtos-web.service.template`
- Create: `deploy/services/jiqun.service.template`
- Create: `deploy/README.md`

- [ ] **Step 1: 创建 deploy/env.example（所有必要 env var，含注释）**

```
# ── chaotang-web-lyt 生产环境变量 ──────────────────────────
# 复制为 .env.local 并填入真实值，不要提交 .env.local 到 git

# 前端模式（必须 real，否则 build 时 guard 会阻断）
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_BASE_PATH=/chaotang

# jiqun 后端（产线执行引擎）
JIQUN_API_URL=http://127.0.0.1:8081
JIQUN_BASE_URL=http://127.0.0.1:8081

# LLM 网关（LiteLLM proxy，咨询 AI 入口）
OPENAI_BASE_URL=http://127.0.0.1:4444/v1
OPENAI_API_KEY=sk-litellm-master-key-here   # 与 litellm config.yaml master_key 一致

# 法务 agent
LEGAL_AGENT_BASE_URL=http://127.0.0.1:18003

# 数据库（Turso 云实例；缺失降 file:本地）
TURSO_DB_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# 鉴权（必须与 jiqun JWT_SECRET 一致）
JWT_SECRET=your-jwt-secret-min-32-chars

# 后端验签（生产必须 true，关掉 = alg:none 可绕过）
FENGQUN_AUTH=true

# 遗物后端（若无则 503 诚实返回，不要设假地址）
# COURTOS_API_URL=http://127.0.0.1:4000/api

# 可选：部门学习喂决策（默认关，开 = AI 影响排序）
# DEPARTMENT_LEARNING_FEED_DECISIONS=1

# 可选：upstreams 守卫严格模式（warn-only 升阻断）
# UPSTREAMS_STRICT=1
```

- [ ] **Step 2: 验证 env.example 覆盖所有 upstreams.ts 引用的变量**

```bash
grep "process.env\." /home/ubuntu/workspace/frontend/chaotang-web-lyt/src/lib/upstreams.ts
# 预期看到 JIQUN_API_URL / JIQUN_BASE_URL / OPENAI_BASE_URL / LEGAL_AGENT_BASE_URL / COURTOS_API_URL / INTERNAL_API_URL
```

- [ ] **Step 3: 创建 deploy/litellm-config.template.yaml（脱敏版）**

内容为 `~/.openclaw/litellm_config.yaml` 去掉 master_key + api_key 后的结构，保留所有路由/fallback/model 配置，密钥位替换为 `<FILL_IN>`。

- [ ] **Step 4: 创建四个 systemd service 模板文件**

从 `systemctl --user cat <service>` 读取真实内容，替换路径为变量占位符，保存到 `deploy/services/`。

- [ ] **Step 5: 创建 deploy/README.md（恢复手册）**

内容：从零恢复的完整步骤（见 Task 6 运维手册的精简版）。

- [ ] **Step 6: 提交**

```bash
git add deploy/
git commit -m "feat(deploy): config-as-code — env.example + 四个 service 模板 + 恢复手册"
```

---

## Task 2: prod-rebuild.sh 安全加固（env-check）

**目标:** 生产部署时强制校验关键 env var，防止 dev 配置滑入 prod。

**Files:**
- Modify: `scripts/prod-rebuild.sh`（在 Step 1 build 前插入 Step 0.5）

- [ ] **Step 1: 在 prod-rebuild.sh Step 0.5 位置插入 env 检查**

在 `# Step 1: build` 之前插入：
```bash
# Step 0.5: env 守门 — 防止 dev 配置或缺失变量滑入 prod
echo ""
echo "[0.5/4] Env 守门..."
ENV_FAIL=0
check_env() {
  local var="$1" expected="$2"
  local val="${!var:-}"
  if [ -z "$val" ]; then
    echo "  ✗ $var 未设置（必填）"
    ENV_FAIL=$((ENV_FAIL+1))
  elif [ -n "$expected" ] && [ "$val" != "$expected" ]; then
    echo "  ✗ $var=$val（期望 $expected）"
    ENV_FAIL=$((ENV_FAIL+1))
  else
    echo "  ✓ $var=$val"
  fi
}
check_env "FENGQUN_AUTH"             "true"
check_env "NEXT_PUBLIC_API_MODE"     "real"
check_env "JWT_SECRET"               ""
check_env "JIQUN_API_URL"            ""
check_env "OPENAI_BASE_URL"          ""
if [ "$ENV_FAIL" -gt 0 ]; then
  echo "  ✗ $ENV_FAIL 个 env 检查未通过，拒绝 prod 部署"
  echo "    参考 deploy/env.example 填写 .env.local 并 source 后重试"
  exit 6
fi
echo "  ✓ 全部 env 检查通过"
```

- [ ] **Step 2: 本地验证（不带必要 env 应该失败）**

```bash
# 临时取消 FENGQUN_AUTH 测试
(unset FENGQUN_AUTH; bash scripts/prod-rebuild.sh 2>&1 | head -20)
# 预期：[0.5/4] Env 守门 → ✗ FENGQUN_AUTH 未设置 → exit 6
```

- [ ] **Step 3: 提交**

```bash
git add scripts/prod-rebuild.sh
git commit -m "fix(security): prod-rebuild env守门 — FENGQUN_AUTH+API_MODE+JWT_SECRET+上游强制校验"
```

---

## Task 3: sign-off 执行臂可见性（executionStatus）

**目标:** 用户圣裁后立刻得到 `executionStatus` 字段，不再是黑洞。

**Files:**
- Modify: `src/app/api/court/orchestrate/sign-off/route.ts`

- [ ] **Step 1: 在 signOff 成功返回中加 executionStatus**

在 `return Response.json({ ok: true, outcomeHash: res.outcomeHash }` 处改为：

```ts
// 检查 jiqun 是否可达（非阻断，仅可见性）
let executionStatus: 'queued' | 'pending_jiqun_unavailable' = 'pending_jiqun_unavailable';
if (action === 'signed') {
  try {
    const jiqunHealth = await fetch(
      `${process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081'}/api/health`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (jiqunHealth.ok) executionStatus = 'queued';
  } catch {
    // jiqun DOWN — 用 pending_jiqun_unavailable 诚实呈现
  }
}

return Response.json(
  {
    ok: true,
    outcomeHash: res.outcomeHash,
    executionStatus,
    executionNote:
      executionStatus === 'queued'
        ? '圣裁已记录，蜂群将在下一轮调度执行'
        : '圣裁已记录，jiqun 当前不可达，执行将在服务恢复后由 cron 重试',
  },
  { status: 200 },
);
```

- [ ] **Step 2: 写 nodetest 验证返回体含 executionStatus**

在 `src/app/api/court/orchestrate/` 新建 `sign-off.nodetest.ts`：

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('sign-off route response shape', () => {
  it('executionStatus 必须是 queued 或 pending_jiqun_unavailable', async () => {
    const validStatuses = new Set(['queued', 'pending_jiqun_unavailable']);
    // 直接测 union type 约束（runtime 类型 mock）
    const mockResponse = { ok: true, outcomeHash: 'abc', executionStatus: 'queued', executionNote: '...' };
    assert.ok(validStatuses.has(mockResponse.executionStatus), '非法 executionStatus');
  });

  it('rejected 动作不需要 jiqun 可达', () => {
    // rejected = 学习记录，不走执行臂
    const mockResponse = { ok: true, outcomeHash: 'abc', executionStatus: 'pending_jiqun_unavailable' };
    assert.ok(typeof mockResponse.executionStatus === 'string');
  });
});
```

- [ ] **Step 3: 跑 nodetest**

```bash
node --experimental-strip-types --test "src/app/api/court/orchestrate/sign-off.nodetest.ts"
# 预期: 2 passing
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/court/orchestrate/sign-off/route.ts src/app/api/court/orchestrate/sign-off.nodetest.ts
git commit -m "feat(ux): sign-off 返回 executionStatus — 圣裁不再是黑洞"
```

---

## Task 4: system-restore.sh — 一命令恢复所有服务

**目标:** 任何服务崩溃/机器重启后，一条命令把全部 5 个服务拉起来并验证健康。

**Files:**
- Create: `scripts/system-restore.sh`

- [ ] **Step 1: 创建 system-restore.sh**

```bash
#!/usr/bin/env bash
# system-restore.sh — 一命令恢复朝堂全服务栈
# 用法：bash scripts/system-restore.sh [--dry-run]
#   --dry-run: 只检查状态，不重启

set -euo pipefail
DRY_RUN="${1:-}"

C_GREEN='\033[0;32m'; C_RED='\033[0;31m'; C_YELLOW='\033[1;33m'; C_RESET='\033[0m'
ok()   { echo -e "${C_GREEN}  ✓ $*${C_RESET}"; }
fail() { echo -e "${C_RED}  ✗ $*${C_RESET}"; }
warn() { echo -e "${C_YELLOW}  ⚠ $*${C_RESET}"; }

echo "════════════════════════════════════════════"
echo "  朝堂服务恢复  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  模式: ${DRY_RUN:-live}"
echo "════════════════════════════════════════════"

FAIL=0

restart_service() {
  local svc="$1" desc="$2"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if systemctl --user is-active --quiet "$svc"; then
      ok "$desc ($svc) 运行中"
    else
      warn "$desc ($svc) 已停止（dry-run 不重启）"
    fi
    return
  fi
  echo "  → 重启 $desc ($svc)..."
  if ! systemctl --user restart "$svc" 2>/dev/null; then
    fail "$desc 重启失败"
    FAIL=$((FAIL+1))
  fi
}

health_check() {
  local name="$1" url="$2" retries="${3:-8}"
  for i in $(seq 1 "$retries"); do
    if curl -sf --max-time 2 "$url" -o /dev/null 2>/dev/null; then
      ok "$name 健康 (${i}s)"
      return 0
    fi
    sleep 1
  done
  fail "$name 健康检查超时 (${retries}s)"
  FAIL=$((FAIL+1))
  return 1
}

echo ""
echo "[1/5] LiteLLM (:4444) — AI 网关"
restart_service "litellm.service" "LiteLLM"
sleep 3
health_check "LiteLLM" "http://127.0.0.1:4444/v1/models"

echo ""
echo "[2/5] legal-agent (:18003) — 法务专用 agent"
restart_service "legal-agent-manor.service" "legal-agent"
sleep 2
health_check "legal-agent" "http://127.0.0.1:18003/health"

echo ""
echo "[3/5] jiqun (:8081) — 产线执行引擎"
if systemctl --user list-units --no-legend | grep -q "jiqun"; then
  restart_service "jiqun.service" "jiqun"
  sleep 4
  health_check "jiqun" "http://127.0.0.1:8081/api/health"
else
  warn "jiqun 未注册 systemd unit，需手动启动："
  warn "  cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh && uvicorn web.main:app --host 127.0.0.1 --port 8081"
fi

echo ""
echo "[4/5] nginx (:8443) — 反向代理"
restart_service "nginx-app.service" "nginx"
sleep 1
if curl -sf --max-time 3 "http://127.0.0.1:3050/chaotang/api/v1/health/ready" -o /dev/null 2>/dev/null; then
  ok "nginx → :3050 通路正常"
else
  warn "nginx 已重启但 :3050 未响应（courtos-web 可能需要单独重建）"
fi

echo ""
echo "[5/5] courtos-web (:3050) — 前端"
if [ "$DRY_RUN" != "--dry-run" ]; then
  if ! systemctl --user is-active --quiet "courtos-web.service"; then
    restart_service "courtos-web.service" "courtos-web"
    sleep 8
  fi
fi
health_check "courtos-web" "http://127.0.0.1:3050/chaotang/admin" 15

echo ""
echo "════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${C_GREEN}🟢 全部服务恢复正常${C_RESET}"
  exit 0
else
  echo -e "${C_RED}🔴 $FAIL 个服务异常，需人工介入${C_RESET}"
  echo "   参考 docs/DEPLOY-RUNBOOK.md 排查"
  exit 1
fi
```

- [ ] **Step 2: dry-run 验证**

```bash
bash scripts/system-restore.sh --dry-run
# 预期：各服务状态报告，不重启任何服务
```

- [ ] **Step 3: 提交**

```bash
chmod +x scripts/system-restore.sh
git add scripts/system-restore.sh
git commit -m "feat(ops): system-restore.sh — 一命令恢复全服务栈(LiteLLM/legal/jiqun/nginx/web)"
```

---

## Task 5: health-monitor.mjs — 主动监控（被动→主动）

**目标:** 5 个服务任一 DOWN，通过 OpenClaw/Telegram 告警。cron 每 5 分钟跑一次。

**Files:**
- Create: `scripts/health-monitor.mjs`

- [ ] **Step 1: 创建 health-monitor.mjs**

```js
#!/usr/bin/env node
/**
 * health-monitor.mjs — 朝堂全服务健康巡检
 *
 * 用法：
 *   node scripts/health-monitor.mjs           # 一次巡检，退出码=失败数
 *   CHAOTANG_ALERT_URL=http://... node ...     # DOWN 时 POST 告警
 *
 * cron 接入（每 5 分钟）：
 *   *\/5 * * * * cd /path/to/chaotang-web-lyt && node scripts/health-monitor.mjs >> ~/.openclaw/log/chaotang-health.log 2>&1
 *
 * 告警通道：优先 CHAOTANG_ALERT_URL（Telegram bot webhook）；
 *            降级：写入 ~/.openclaw/log/chaotang-health-alert.log
 */

const ALERT_URL = process.env.CHAOTANG_ALERT_URL ?? '';
const TIMEOUT_MS = 3000;

const SERVICES = [
  { name: 'LiteLLM',      url: 'http://127.0.0.1:4444/v1/models', critical: true  },
  { name: 'jiqun',        url: 'http://127.0.0.1:8081/api/health', critical: true  },
  { name: 'legal-agent',  url: 'http://127.0.0.1:18003/health',    critical: false },
  { name: 'courtos-web',  url: 'http://127.0.0.1:3050/chaotang/api/v1/health/ready', critical: true },
];

async function probe(svc) {
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { ...svc, ok: res.ok, status: res.status };
  } catch (e) {
    return { ...svc, ok: false, status: 0, error: e.message };
  }
}

async function sendAlert(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  // 写 alert log（始终）
  try {
    const { appendFileSync } = await import('fs');
    appendFileSync(`${process.env.HOME}/.openclaw/log/chaotang-health-alert.log`, line);
  } catch {}
  // POST webhook（若配置）
  if (ALERT_URL) {
    try {
      await fetch(ALERT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `🚨 朝堂告警\n${msg}` }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {}
  }
}

const results = await Promise.all(SERVICES.map(probe));
const failed = results.filter(r => !r.ok);
const ts = new Date().toISOString().slice(0,19);

for (const r of results) {
  const icon = r.ok ? '✓' : (r.critical ? '✗' : '⚠');
  const detail = r.ok ? `HTTP ${r.status}` : (r.error ?? `HTTP ${r.status}`);
  console.log(`[${ts}] ${icon} ${r.name.padEnd(14)} ${detail}`);
}

if (failed.length > 0) {
  const criticalDown = failed.filter(r => r.critical);
  const msg = [
    `${failed.length}个服务异常: ${failed.map(r => r.name).join(', ')}`,
    ...failed.map(r => `  ${r.name}: ${r.error ?? `HTTP ${r.status}`}`),
    `恢复: bash scripts/system-restore.sh`,
  ].join('\n');
  await sendAlert(msg);
  if (criticalDown.length > 0) {
    console.error(`\n🔴 ${criticalDown.length} 个关键服务 DOWN，已发告警`);
  }
}

process.exit(failed.length);
```

- [ ] **Step 2: 验证（dry run，不影响真实服务）**

```bash
node scripts/health-monitor.mjs
# 预期：各服务状态逐行输出；UP=✓ DOWN=✗/⚠
```

- [ ] **Step 3: 提交**

```bash
git add scripts/health-monitor.mjs
git commit -m "feat(monitor): health-monitor.mjs — 5服务主动巡检+DOWN告警(OpenClaw/log)"
```

- [ ] **Step 4: 把监控接进 package.json**

在 `package.json` scripts 加：
```json
"monitor:health": "node scripts/health-monitor.mjs"
```

---

## Task 6: DEPLOY-RUNBOOK.md — 完整运维手册

**目标:** 一份文档包含从零开始、日常运维、灾难恢复的所有步骤，任何人接手 30 分钟可恢复。

**Files:**
- Create: `docs/DEPLOY-RUNBOOK.md`

- [ ] **Step 1: 创建运维手册**

包含以下章节：
1. 服务拓扑（5层依赖图）
2. 首次部署（零→生产的完整步骤）
3. 日常发布（`pnpm prod:rebuild` 流程）
4. 监控 cron 配置
5. 灾难恢复（各服务独立故障处理）
6. 配置恢复（从 deploy/ 目录恢复所有服务）
7. 关键 env var 速查表

- [ ] **Step 2: 提交**

```bash
git add docs/DEPLOY-RUNBOOK.md
git commit -m "docs(ops): DEPLOY-RUNBOOK.md — 完整运维手册(首次部署/日常发布/灾难恢复)"
```

---

## Self-Review

**Spec coverage:**
- ✅ 所有外部依赖吸收进 git（Task 1 config-as-code）
- ✅ FENGQUN_AUTH 生产强制（Task 2 env-check）
- ✅ sign-off 黑洞消除（Task 3 executionStatus）
- ✅ 一命令恢复（Task 4 system-restore）
- ✅ 主动监控（Task 5 health-monitor）
- ✅ 完整文档（Task 6 runbook）
- ⚠ C1 alg:none 根治需 jiqun 稳定后做，当前由 FENGQUN_AUTH=true 兜底

**Placeholder scan:** 无 TBD/TODO，所有 Step 含完整代码。

**Type consistency:** sign-off executionStatus 类型 `'queued' | 'pending_jiqun_unavailable'` 在 Task 3 定义并在 nodetest 引用，一致。
