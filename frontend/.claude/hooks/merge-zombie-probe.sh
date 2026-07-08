#!/bin/bash
# 铁律3 守门人 · merge-zombie-probe（合并即清理的确定性检查）
#
# 把 CLAUDE.md「铁律3：合并即清理(merge = resolve + simplify)」从一句口号变成账面上
# 看得见转的检查（Deming：没有度量的飞轮和没有飞轮，账面上无法区分）。
#
# 作用：在 git commit / merge 收尾时，扫描本次改动文件，检测「同一文件内并存的双实现(twin)」
# —— 合并最危险的「编译通过但逻辑冗余」僵尸态（Bezos）。命中即把告警喂回 Claude，逼其
# resolve 之后再 simplify，而非依赖下一个 agent 自觉记得简化。
#
# 两种入口：
#   (hook)   PostToolUse(Bash)：stdin 收 JSON，自动判断命令是否 git commit/merge，命中 exit 2
#   (手动)   merge-zombie-probe.sh --scan      全量扫描配置 path（CI/审计用，命中 exit 1）
#            merge-zombie-probe.sh --changed   仅扫 HEAD 改动（等价 hook 的扫描集）
#
# 配置：同目录 zombie-twins.json —— twins:[{name,a,b,pathContains}]
#   a/b 为 *固定字符串*（grep -F），务必选「活代码签名」（setter 调用 / 函数定义 / 声明），
#   切勿选注释里也会出现的散词（如裸的旧状态名），否则注释提及旧名会误报。
#   a、b 皆出现于同一文件即判定僵尸态。pathContains 限定扫描范围，杜绝扫到规则文档自身。
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config="$here/zombie-twins.json"
repo="$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || pwd)"

mode="hook"
case "${1:-}" in
  --scan) mode="scan" ;;
  --changed) mode="changed" ;;
esac

# hook 模式：读 stdin，只在 git commit/merge 边界触发；其余一律放行
if [[ "$mode" == "hook" ]]; then
  payload="$(cat 2>/dev/null || true)"
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
  printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(commit|merge)' || exit 0
fi

[[ -f "$config" ]] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

# 待扫文件集
if [[ "$mode" == "scan" ]]; then
  mapfile -t files < <(git -C "$repo" ls-files 2>/dev/null)
else
  # 本次提交（含 merge commit，对第一父）改动的文件
  mapfile -t files < <(git -C "$repo" diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null)
fi
[[ ${#files[@]} -eq 0 ]] && exit 0

twin_count="$(jq '.twins | length' "$config" 2>/dev/null || echo 0)"
[[ "$twin_count" =~ ^[0-9]+$ ]] || exit 0

warnings=""
for ((i = 0; i < twin_count; i++)); do
  name="$(jq -r ".twins[$i].name // \"twin\"" "$config")"
  a="$(jq -r ".twins[$i].a // empty" "$config")"
  b="$(jq -r ".twins[$i].b // empty" "$config")"
  pc="$(jq -r ".twins[$i].pathContains // empty" "$config")"
  [[ -z "$a" || -z "$b" ]] && continue
  for f in "${files[@]}"; do
    [[ -n "$pc" && "$f" != *"$pc"* ]] && continue
    full="$repo/$f"
    [[ -f "$full" ]] || continue
    if grep -Fq -- "$a" "$full" && grep -Fq -- "$b" "$full"; then
      la="$(grep -Fn -- "$a" "$full" | head -1 | cut -d: -f1)"
      lb="$(grep -Fn -- "$b" "$full" | head -1 | cut -d: -f1)"
      warnings+="  ⚠ $f —〔$name〕：「$a」@L$la 与「$b」@L$lb 并存"$'\n'
    fi
  done
done

if [[ -n "$warnings" ]]; then
  {
    echo "🚨 铁律3 守门 · 合并僵尸态（编译过但逻辑冗余）—— 同一文件并存双实现："
    printf '%s' "$warnings"
    echo "→ 合并尚未完成：resolve 之后必须 simplify。收敛到唯一通路、删除失活旁路，再提交（见 CLAUDE.md 铁律3）。"
  } >&2
  [[ "$mode" == "scan" ]] && exit 1 # CI/手动：命中即非零
  exit 2                            # hook：exit 2 把告警喂回 Claude
fi
exit 0
