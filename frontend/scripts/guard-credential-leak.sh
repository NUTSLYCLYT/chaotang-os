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
diff_content=$(git diff --cached -U0 -- \
  ':(exclude)frontend/scripts/guard-credential-leak.sh' \
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

hits_raw=$(echo "$added_lines" | grep -inE "$pattern" || true)

# 白名单(2026-07-13，收到复审后再收紧一版)：只放行`const E2E_XXX = 'e2e...';`这一种
# 形状——变量名前缀 E2E_ 只是第一层信号，光靠它不够(把一个真实密钥随手改名叫
# E2E_API_KEY 就能绕过，之前那版就是这个漏洞)。真正的判据是**值本身**也以
# e2e(不分大小写)开头，这是本仓库已有先例的自证写法(E2E_PASSWORD='e2e-liubu-
# smoke-pw-2026'、'e2e-lifu-office-pw-2026')——真实凭据的值不会天然长这样，除非
# 有人故意伪装成这个前缀，那已经不是"顺手写错"能防的范畴了。变量名和值必须同时
# 匹配才放行，任一不满足仍然全挡。
safe_pattern='^[0-9]+:\+[[:space:]]*const[[:space:]]+E2E_[A-Z_]+[[:space:]]*=[[:space:]]*[`"'"'"'][Ee]2[Ee][A-Za-z0-9!@#$%^&*_.-]*[`"'"'"']'

hits=$(echo "$hits_raw" | grep -viE "$safe_pattern" || true)

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
