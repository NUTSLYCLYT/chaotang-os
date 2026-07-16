#!/usr/bin/env python3
"""部门能力图谱查询——一条命令盘点六部+专署的真实实现状态。

替代人工维护 census 文档：直接读代码，不读文档里"声称"的状态。

数据源（全部只读，不修改任何文件）：
  1. backend/harness/chaotang_department_protocol/departments.yaml
     —— canonical 部门注册表：status（active/pending）、routing_keywords
  2. backend/src/shangshufang_loop.py
     —— DEPARTMENT_RULES：上书房路由用的关键词表（与 1 的 routing_keywords 是否同步）
  3. backend/src/real_department_engines.py
     —— REAL_ENGINE_ADAPTERS：哪些部门真正接了后端引擎函数（不是 None 兜底）
  4. backend/agent_design/buildAgent/**/{SOUL.md,IDENTITY.md}
     —— 边界声明覆盖率：用启发式规则找"只做 X 不做 Y"这类边界句

用法：
  python3 .claude/skills/dept-capability-map/scripts/audit.py [--repo-root PATH]

输出：每个部门一行的状态表 + 汇总缺口清单。
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - repo already depends on PyYAML
    yaml = None


BOUNDARY_PATTERN = re.compile(r"只[^。\n]{1,40}[，,][^。\n]{0,10}不[^。\n]{1,30}")


def load_departments_yaml(repo_root: Path) -> dict:
    path = repo_root / "backend/harness/chaotang_department_protocol/departments.yaml"
    if not path.exists() or yaml is None:
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    depts = {}
    # departments.yaml 结构随版本可能变化，做防御性遍历：找所有带 name/runtime_code 的节点
    def walk(node, key_hint=None):
        if isinstance(node, dict):
            if "name" in node and ("status" in node or "routing_keywords" in node):
                dept_id = key_hint or node.get("runtime_code") or node["name"]
                depts[dept_id] = {
                    "name": node.get("name"),
                    "status": node.get("status", "unknown"),
                    "runtime_code": node.get("runtime_code"),
                    "routing_keywords": node.get("routing_keywords", []),
                }
            for k, v in node.items():
                walk(v, key_hint=k if isinstance(v, dict) else key_hint)
        elif isinstance(node, list):
            for item in node:
                walk(item, key_hint=key_hint)

    walk(data)
    return depts


def load_department_rules(repo_root: Path) -> dict[str, list[str]]:
    path = repo_root / "backend/src/shangshufang_loop.py"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    m = re.search(r"DEPARTMENT_RULES:.*?=\s*\{(.*?)\n\}\n", text, re.S)
    if not m:
        return {}
    block = m.group(1)
    rules: dict[str, list[str]] = {}
    for entry in re.finditer(
        r'"([^"]+)":\s*\{\s*"keywords":\s*\[(.*?)\]', block, re.S
    ):
        dept, kw_raw = entry.group(1), entry.group(2)
        keywords = re.findall(r'"([^"]+)"', kw_raw)
        rules[dept] = keywords
    return rules


def load_real_engine_adapters(repo_root: Path) -> dict[str, str]:
    path = repo_root / "backend/src/real_department_engines.py"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    m = re.search(
        r"REAL_ENGINE_ADAPTERS:.*?=\s*\{(.*?)\n\}\n", text, re.S
    )
    if not m:
        return {}
    block = m.group(1)
    adapters: dict[str, str] = {}
    for entry in re.finditer(
        r'(canonical_name\("([^"]+)"\)|"([^"]+)")\s*:\s*(\w+)', block
    ):
        runtime_code, literal_key, fn = entry.group(2), entry.group(3), entry.group(4)
        key = runtime_code or literal_key
        adapters[key] = fn
    return adapters


def scan_boundary_declarations(repo_root: Path) -> dict[str, list[str]]:
    base = repo_root / "backend/agent_design/buildAgent"
    found: dict[str, list[str]] = {}
    if not base.exists():
        return found
    for md_path in base.rglob("*.md"):
        if md_path.name not in {"SOUL.md", "IDENTITY.md"}:
            continue
        dept_dir = md_path.parent.name
        text = md_path.read_text(encoding="utf-8", errors="ignore")
        hits = BOUNDARY_PATTERN.findall(text)
        if hits:
            found.setdefault(dept_dir, []).extend(hits[:2])
    return found


CANONICAL_TO_ZH = {
    "hubu": "户部",
    "libu": "吏部",
    "libu_rites": "礼部",
    "bingbu": "兵部",
    "xingbu": "刑部",
    "gongbu": "工部",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[4],
        help="仓库根目录（默认从脚本路径 .claude/skills/dept-capability-map/scripts/audit.py 反推上四级）",
    )
    args = parser.parse_args()
    repo_root = args.repo_root

    yaml_depts = load_departments_yaml(repo_root)
    rule_kws = load_department_rules(repo_root)
    engines = load_real_engine_adapters(repo_root)
    boundaries = scan_boundary_declarations(repo_root)

    print(f"# 部门能力图谱（数据源：{repo_root}）\n")
    header = f"{'部门':6} {'canonical状态':12} {'真实引擎':10} {'路由关键词(yaml/rules)':22} {'关键词同步':10} {'边界声明'}"
    print(header)
    print("-" * len(header))

    all_codes = sorted(set(CANONICAL_TO_ZH) | set(yaml_depts.keys()))
    gaps = []

    for code in all_codes:
        zh = CANONICAL_TO_ZH.get(code, code)
        yd = yaml_depts.get(code, {})
        status = yd.get("status", "unknown")
        engine_fn = engines.get(code) or engines.get(zh)
        engine_state = engine_fn if engine_fn else "无(None兜底)"
        yaml_kw = set(yd.get("routing_keywords", []))
        rule_kw = set(rule_kws.get(zh, []))
        if not yaml_kw and not rule_kw:
            sync_state = "两表皆缺"
        elif yaml_kw == rule_kw:
            sync_state = "完全一致"
        elif yaml_kw & rule_kw:
            sync_state = f"部分重叠({len(yaml_kw & rule_kw)}/{len(yaml_kw | rule_kw)})"
        else:
            sync_state = "完全不重叠"
        boundary_hit = "有" if any(zh in k or code in k for k in boundaries) else "缺"

        print(
            f"{zh:6} {status:12} {engine_state:10} "
            f"{len(yaml_kw):>2}/{len(rule_kw):<2}{'':16} {sync_state:10} {boundary_hit}"
        )

        if status != "active":
            gaps.append(f"{zh}: canonical状态={status}，未激活")
        if not engine_fn:
            gaps.append(f"{zh}: 无真实后端引擎，请求会退化到LLM人设兜底")
        if sync_state != "完全一致":
            gaps.append(f"{zh}: 路由关键词表(departments.yaml vs shangshufang_loop.py) {sync_state}")
        if boundary_hit == "缺":
            gaps.append(f"{zh}: agent_design 设计文档里未找到显式边界声明句")

    print("\n# 专署（非六部，独立注册）\n")
    for zh in ["锦衣卫", "钦天监"]:
        engine_fn = engines.get(zh)
        print(f"{zh:6} {'—':12} {engine_fn or '无(None兜底)':10}")
        if not engine_fn:
            gaps.append(f"{zh}: 无真实后端引擎")

    print("\n# 汇总缺口\n")
    if not gaps:
        print("未发现缺口。")
    for g in gaps:
        print(f"- {g}")


if __name__ == "__main__":
    main()
