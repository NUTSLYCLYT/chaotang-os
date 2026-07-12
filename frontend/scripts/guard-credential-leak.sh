#!/usr/bin/env bash
# 防复发守卫(2026-07-12)：拦截把疑似真实密码/密钥提交进版本库。
#
# 起因(真实事故)：P0-A 真实闭环验证时，把测试账号的明文密码写进了 harness 文档
# (review-handoff.md)，随 commit 提交进版本库——事后靠删账号让凭据失效 + 本地
# git history rewrite 补救(分支从未 push，没有扩散出去，算侥幸)。这条守卫就是
# 为了让"忘了这是真实密码，顺手写进文档/代码里"这一步在提交前就被拦下来，而不是
# 靠人事后想起来才补救。
#
# 只是最小的关键词+样式匹配，不是熵值/密钥格式检测(那是 gitleaks/git-secrets 的
# 活，本仓库暂未引入这类工具)——只挡"中文/英文密码关键词紧跟着一个反引号或引号
# 包裹的凭据样字符串"这种最常见、最容易顺手犯的模式。会有漏网(比如没加引号的
# 凭据)和极少数误报(比如巧合命中的示例值)，误报时人工确认后可以调整这个脚本的
# 排除规则，而不是绕过这条守卫。
#
# 用法：pre-commit 钩子里跑 `bash scripts/guard-credential-leak.sh`，命中就 exit 1。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 只查本次真正要提交的新增行(staged diff)，不是整棵树——否则历史遗留内容会
# 一直噪音式挡住每一次不相关的提交。

# 2026-07-13 加排除：frontend/e2e/*.spec.ts 里的 E2E_PASSWORD/E2E_USERNAME 是给
# 一次性 e2e 测试账号(如 e2e_lifu_office)用的固定 fixture 凭据，注册在真后端但
# 只用于本地/CI 跑测试——liubu-bureau-pages-smoke.spec.ts 已有同款先例(2026-07-09
# 提交，早于本守卫，从未被这条规则检查过)。这类账号本身就是低权限、可随时重建，
# 跟本守卫要拦的"真实账号密码写进文档"不是一类事，人工确认后排除，而不是弱化整条
# 守卫。
diff_content=$(git diff --cached -U0 -- \
  ':(exclude)frontend/scripts/guard-credential-leak.sh' \
  ':(exclude)frontend/e2e/*.spec.ts' \
  '*.md' '*.ts' '*.tsx' '*.js' '*.mjs' '*.py' '*.json' '*.yaml' '*.yml' 2>/dev/null || true)

added_lines=$(echo "$diff_content" | grep -E '^\+[^+]' || true)

if [ -z "$added_lines" ]; then
  exit 0
fi

# 关键词(中文"密码"/英文 password/passwd/api key/secret) + 分隔符 + 一个反引号
# 或引号包裹、8 位以上的凭据样字符串。要求引号/反引号包裹是关键——真实密码/密钥
# 被写进文档或代码字面量时几乎总是这个形状，而变量名(PASSWORD_MIN_LENGTH)、
# 列定义(password_hash: str)、环境变量引用(os.environ["DB_PASSWORD"])、cookie
# 别名(alias="token")都不会被误伤。
pattern='(密码|password|passwd|api[_-]?key|secret)[^A-Za-z0-9]{0,15}[`"'"'"'][A-Za-z0-9!@#$%^&*_.-]{8,}[`"'"'"']'

hits=$(echo "$added_lines" | grep -inE "$pattern" || true)

if [ -n "$hits" ]; then
  echo "✗ 疑似把真实密码/密钥写进了本次提交(禁止提交):"
  echo "$hits"
  echo ""
  echo "先确认："
  echo "  - 如果是真实凭据：立刻先让它失效(改密码/删账号/吊销 token)，再决定要不要"
  echo "    改动本次提交或 rewrite 已有历史。"
  echo "  - 如果是误报(占位符/示例/哈希值)：调整本脚本的正则或排除规则，而不是绕过"
  echo "    这条守卫(不要用 --no-verify)。"
  exit 1
fi
echo "✓ 未发现疑似凭据泄露"
