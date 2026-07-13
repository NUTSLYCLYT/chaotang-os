#!/usr/bin/env bash
# CourtOS prod 一键重建：build → systemctl restart → smoke test
# 用法：pnpm prod:rebuild
# 退出码：0 = 成功，非 0 = 失败位置写在 stderr

set -euo pipefail

echo "STOP: legacy prod:rebuild is disabled; use the root Release Commander with a signed attestation." >&2
exit 64

# 加载 .env.local 让 env 守门能读到生产变量
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE_URL="http://127.0.0.1:3050/chaotang"
SERVICE="courtos-web.service"
BUILD_TIMEOUT=120  # webpack build 上限秒数

echo "════════════════════════════════════════════════"
echo "  CourtOS prod:rebuild  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════"

# Step 0.5: env 守门 — 防止 dev 配置或缺失变量滑入 prod
echo ""
echo "[0.5/4] Env 守门..."
_ENV_FAIL=0
_check_env() {
  local var="$1" expected="$2"
  local val="${!var:-}"
  if [ -z "$val" ]; then
    echo "  ✗ $var 未设置（必填）"
    _ENV_FAIL=$((_ENV_FAIL+1))
  elif [ -n "$expected" ] && [ "$val" != "$expected" ]; then
    echo "  ✗ $var=$val（期望 $expected）"
    _ENV_FAIL=$((_ENV_FAIL+1))
  else
    echo "  ✓ $var=$val"
  fi
}
_check_env "FENGQUN_AUTH"          "true"
_check_env "NEXT_PUBLIC_API_MODE"  "real"
_check_env "JWT_SECRET"            ""
_check_env "JIQUN_API_URL"         ""
_check_env "OPENAI_BASE_URL"       ""
if [ "$_ENV_FAIL" -gt 0 ]; then
  echo ""
  echo "  ✗ $_ENV_FAIL 个 env 检查未通过，拒绝 prod 部署"
  echo "    参考 deploy/env.example 填写 .env.local"
  exit 6
fi
echo "  ✓ 全部 env 检查通过"

# Step 0: 部署源守门 — prod 只认 origin/master，杜绝把未合/未过门禁的代码(含未提交改动)直接上公网。
# 紧急回滚用 PROD_ALLOW_DETACHED=1 显式放行(留告警痕迹)。
echo ""
echo "[0/4] 部署源守门 (master only)..."
if [ "${PROD_ALLOW_DETACHED:-0}" = "1" ]; then
  echo "  ⚠ PROD_ALLOW_DETACHED=1 显式放行(紧急回滚)，跳过 master 守门"
else
  git fetch origin master --quiet || { echo "  ✗ git fetch origin master 失败"; exit 5; }
  HEAD_SHA="$(git rev-parse HEAD)"
  MASTER_SHA="$(git rev-parse origin/master)"
  if [ "$HEAD_SHA" != "$MASTER_SHA" ]; then
    echo "  ✗ HEAD($HEAD_SHA) != origin/master($MASTER_SHA)"
    echo "    prod 只认 master：先推 feat→开 PR→过 CI→合 master 再重建；紧急回滚用 PROD_ALLOW_DETACHED=1。"
    exit 5
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "  ✗ 工作树不干净，拒绝用未提交改动重建 prod"
    exit 5
  fi
  echo "  ✓ HEAD == origin/master 且工作树干净"
fi

# Step 1: build — 经 next-with-base-path 包装器走，才会触发 #2 构建门(NEXT_PUBLIC_API_MODE 必须=real，
# 否则整仓静默退化 mock 假数据冒充 LIVE)。直接 npx next build 会绕过该门。
echo ""
echo "[1/4] Build (webpack mode)..."
START=$SECONDS
BASE_PATH=/chaotang node scripts/next-with-base-path.mjs build --webpack > /tmp/prod-rebuild-build.log 2>&1 || {
  echo "  ✗ build 失败，看 /tmp/prod-rebuild-build.log"
  tail -10 /tmp/prod-rebuild-build.log
  exit 1
}
echo "  ✓ build 完成（${SECONDS}s 内）"

# Step 2: systemctl restart
echo ""
echo "[2/4] systemctl restart $SERVICE..."
systemctl --user restart "$SERVICE" || {
  echo "  ✗ restart 失败 — 老的 RefuseManualStop 还在？"
  echo "    workaround: systemctl --user kill $SERVICE"
  exit 2
}
echo "  ✓ 已发起 restart"

# Step 3: 等就绪 — Next.js prod start 实测 14-25s，不能太紧
echo ""
echo "[3/4] 等 :3050 重新监听..."
for i in $(seq 1 45); do
  # 双重检查：端口监听 + 真能 200 响应（避免端口起了但还在初始化）
  if ss -tlnp 2>/dev/null | grep -q ":3050.*LISTEN" \
     && curl -s --noproxy 127.0.0.1,localhost --max-time 2 -o /dev/null -w "%{http_code}" "$BASE_URL/admin" 2>/dev/null | grep -qE "^(200|308|401)$"; then
    echo "  ✓ 端口已监听 + HTTP 响应正常（${i}s）"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "  ✗ 45s 内服务没就绪"
    systemctl --user status "$SERVICE" --no-pager | head -10
    exit 3
  fi
  sleep 1
done

# Step 4: 烟测
echo ""
echo "[4/4] 烟测主路径..."
PATHS=(/admin /more /throne /tasks /prime /court-briefing)
FAIL=0
for p in "${PATHS[@]}"; do
  CODE=$(curl -s --noproxy 127.0.0.1,localhost -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL$p" || echo "TIMEOUT")
  if [[ "$CODE" =~ ^(200|308|401)$ ]]; then
    printf "  ✓ %-25s %s\n" "$p" "$CODE"
  else
    printf "  ✗ %-25s %s\n" "$p" "$CODE"
    FAIL=$((FAIL+1))
  fi
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "🟢 prod:rebuild 全绿（${SECONDS}s 总时长）"
  exit 0
else
  echo "🔴 prod:rebuild 完成但有 $FAIL 个端点异常"
  exit 4
fi
