#!/usr/bin/env python3
"""
gen_project_manifest.py
-----------------------
生成项目结构化摘要 (PROJECT_MANIFEST.md)。

作用：让 Claude Code / 任何 AI 助手在新会话时只需读这一个文件，
即可获得足够的项目上下文，无需遍历所有源文件，大幅减少 Token 消耗。

使用：
    python3 scripts/gen_project_manifest.py
    # 生成 PROJECT_MANIFEST.md 到项目根目录

建议：在 git commit 前自动运行，或加入 Makefile/CI。
"""

import ast
import hashlib
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── 配置 ─────────────────────────────────────────────────────────────────────

# 扫描的 Python 文件（src/ + web/main.py + web/routers/*.py，已替换原 web/app.py）
PY_DIRS = [ROOT / "src", ROOT / "web"]

# 扫描的配置文件
CONFIG_DIR = ROOT / "config"

# 扫描的 Agent prompt 目录
PROMPT_DIR = ROOT / "runtime_prompts"

# 输出文件
OUTPUT = ROOT / "PROJECT_MANIFEST.md"


# ── 工具函数 ──────────────────────────────────────────────────────────────────

def file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]


def extract_py_summary(path: Path) -> dict:
    """提取 Python 文件的顶层结构：类、函数、常量。"""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    classes, functions, constants = [], [], []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            methods = [n.name for n in ast.iter_child_nodes(node) if isinstance(n, ast.FunctionDef)]
            docstring = ast.get_docstring(node) or ""
            classes.append({
                "name": node.name,
                "doc": docstring[:100].replace("\n", " "),
                "methods": methods[:10],
            })
        elif isinstance(node, ast.FunctionDef):
            docstring = ast.get_docstring(node) or ""
            functions.append({
                "name": node.name,
                "doc": docstring[:80].replace("\n", " "),
            })
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    constants.append(target.id)
    return {"classes": classes, "functions": functions[:20], "constants": constants[:15]}


def extract_yaml_summary(path: Path) -> dict:
    """提取 Flow YAML 的关键字段。"""
    try:
        import yaml
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        steps = data.get("steps", [])
        return {
            "flow_name": data.get("flow_name", ""),
            "default_model": data.get("default_model", ""),
            "qa_version": data.get("qa_version", ""),
            "step_count": len(steps),
            "steps": [{"id": s.get("id"), "name": s.get("name")} for s in steps],
            "output_fields": data.get("output_fields", []),
        }
    except Exception:
        return {}


def count_py_lines(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8").splitlines())
    except Exception:
        return 0


def get_git_log(n: int = 5) -> str:
    try:
        result = subprocess.run(
            ["git", "log", f"--oneline", f"-{n}"],
            cwd=ROOT, capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return "(无法读取 git log)"


def get_agent_summary(agent_dir: Path) -> dict:
    """读取 Agent 的 IDENTITY.md 第一行作为简介。"""
    identity = agent_dir / "IDENTITY.md"
    soul = agent_dir / "SOUL.md"
    summary = {"name": agent_dir.name, "identity_line": "", "soul_rules": 0}
    if identity.exists():
        lines = [l.strip() for l in identity.read_text(encoding="utf-8").splitlines() if l.strip()]
        # 跳过⚠️警告行，取第一个正式描述行
        for line in lines:
            if not line.startswith("⚠") and not line.startswith("---"):
                summary["identity_line"] = line[:120]
                break
    if soul.exists():
        text = soul.read_text(encoding="utf-8")
        summary["soul_rules"] = len(re.findall(r"^\d+\.", text, re.MULTILINE))
    return summary


# ── 主生成函数 ────────────────────────────────────────────────────────────────

def generate():
    lines = []

    def h1(t): lines.append(f"# {t}\n")
    def h2(t): lines.append(f"\n## {t}\n")
    def h3(t): lines.append(f"\n### {t}\n")
    def p(t):  lines.append(f"{t}\n")
    def code(t, lang=""): lines.append(f"```{lang}\n{t}\n```\n")

    h1("PROJECT MANIFEST — jiqun_ai 蜂群系统")
    p(f"> 自动生成于 {datetime.now().strftime('%Y-%m-%d %H:%M')}，勿手动编辑。")
    p("> 本文件是项目的完整结构摘要，供 AI 助手快速获取上下文，无需通读源文件。")

    # ── 1. 项目总览 ──────────────────────────────────────────────────────────
    h2("1. 项目总览")

    # 统计代码量
    py_files = list((ROOT / "src").glob("*.py")) + list((ROOT / "web").glob("*.py"))
    total_lines = sum(count_py_lines(f) for f in py_files)
    agent_count = len([d for d in PROMPT_DIR.iterdir() if d.is_dir()]) if PROMPT_DIR.exists() else 0
    flow_count = len(list(CONFIG_DIR.glob("flow_*.yaml"))) if CONFIG_DIR.exists() else 0

    p(f"| 指标 | 值 |")
    p(f"|------|---|")
    p(f"| Python 源文件 | {len(py_files)} 个 |")
    p(f"| 总代码行数 | {total_lines:,} 行 |")
    p(f"| Agent 数量 | {agent_count} 个 |")
    p(f"| Flow 配置 | {flow_count} 个 |")
    p(f"| 运行时数据目录 | `data/default/runs/` |")

    # ── 2. 核心模块索引 ──────────────────────────────────────────────────────
    h2("2. 核心模块索引 (src/)")

    KEY_MODULES = {
        "flow_engine.py":       "核心执行引擎：顺序执行/累积上下文/重跑/多模型切换",
        "swarm_orchestrator.py":"跨蜂群编排：事件驱动+质量门控+数据转换",
        "prompt_composer.py":   "5文件Prompt组装（IDENTITY/SOUL/AGENTS/USER/TOOLS）",
        "context_budget.py":    "Context预算管理：3级阈值(40/60/75%)+语义压缩",
        "guard_rails.py":       "GuardRails：lint检查/assertions/force_compress",
        "knowledge_rag.py":     "RAG知识库：ChromaDB+混合检索(向量70%+关键词30%)",
        "step_log.py":          "运行日志：StepLog/RunLog dataclass+文件读写",
        "model_adapter.py":     "模型适配层：LiteLLM统一调用+动态切换",
        "tool_router.py":       "MCP工具路由：三级合并(global/flow/step)+草稿审批",
        "repair.py":            "QA驱动自动修复循环",
        "ab_test.py":           "AB测试引擎：并行执行+自动对比",
        "output_linter.py":     "输出格式校验：必填字段/结构/长度",
        "quality.py":           "质量评估：六维度评分",
    }

    for fname, desc in KEY_MODULES.items():
        fpath = ROOT / "src" / fname
        if fpath.exists():
            lines_count = count_py_lines(fpath)
            p(f"- **`{fname}`** ({lines_count}行) — {desc}")
        else:
            p(f"- `{fname}` — {desc} _(文件不存在)_")

    # ── 3. Flow 配置索引 ──────────────────────────────────────────────────────
    h2("3. Flow 配置索引 (config/flow_*.yaml)")

    if CONFIG_DIR.exists():
        for yaml_file in sorted(CONFIG_DIR.glob("flow_*.yaml")):
            summary = extract_yaml_summary(yaml_file)
            if not summary:
                continue
            step_names = " → ".join(s["name"] for s in summary.get("steps", []))
            p(f"- **`{yaml_file.name}`** [{summary.get('flow_name')}]  "
              f"{summary.get('step_count')}步 · {summary.get('default_model','').split('/')[-1]}")
            p(f"  步骤: {step_names}")
            if summary.get("output_fields"):
                p(f"  输出字段: {', '.join(summary['output_fields'])}")

    # ── 4. Agent 索引 ─────────────────────────────────────────────────────────
    h2("4. Agent 索引 (runtime_prompts/)")

    if PROMPT_DIR.exists():
        agents = sorted([d for d in PROMPT_DIR.iterdir() if d.is_dir()])
        for agent_dir in agents:
            s = get_agent_summary(agent_dir)
            files = [f.name for f in agent_dir.iterdir() if f.suffix == ".md"]
            p(f"- **`{s['name']}`** ({s['soul_rules']}条铁律) — {s['identity_line']}")

    # ── 5. Web API 端点摘要 ───────────────────────────────────────────────────
    h2("5. Web API 关键端点 (web/routers/*.py — FastAPI)")

    routers_dir = ROOT / "web" / "routers"
    if routers_dir.exists():
        # FastAPI 装饰器形如 @router.get("/api/runs")
        deco_re = re.compile(
            r'@router\.(get|post|put|delete|patch)\(\s*[\'"]([^\'"]+)[\'"]'
        )
        # router 模块顶部 APIRouter(prefix="/api/...") 决定 prefix
        prefix_re = re.compile(
            r'APIRouter\([^)]*prefix\s*=\s*[\'"]([^\'"]+)[\'"]'
        )
        groups: dict[str, list] = {}
        for f in sorted(routers_dir.glob("*.py")):
            if f.name == "__init__.py":
                continue
            text = f.read_text(encoding="utf-8")
            m = prefix_re.search(text)
            prefix = m.group(1) if m else ""
            for method, sub in deco_re.findall(text):
                full = prefix + sub if sub else prefix
                # 顶层 prefix 桶用 /api/{第二段}
                parts = full.strip("/").split("/")
                bucket = "/" + parts[1] if len(parts) >= 2 else full
                groups.setdefault(bucket, []).append(
                    f"`{method.upper()} {full}`"
                )
        for bucket, endpoints in sorted(groups.items()):
            p(
                f"- **{bucket}**: {', '.join(endpoints[:5])}"
                f"{'...' if len(endpoints) > 5 else ''}"
            )

    # ── 6. 关键设计决策 ───────────────────────────────────────────────────────
    h2("6. 关键设计决策与约定")

    decisions = [
        ("执行模型", "自研极简引擎，**不用** LangGraph/CrewAI/AutoGen"),
        ("模型层", "LiteLLM统一调用，支持step级模型覆盖"),
        ("上下文传递", "累积式：每步看到所有前序输出（GuardRails在75%时裁剪至最后2步）"),
        ("Prompt结构", "5文件分离：IDENTITY/SOUL/AGENTS/USER/TOOLS，SOUL存放铁律"),
        ("运行日志", "不可变：rerun创建新run_id，不覆盖历史"),
        ("run_id格式", "`%Y%m%d_%H%M%S_%f`（微秒精度，防并发碰撞）"),
        ("工具路由", "step级显式`tools:`配置才触发formal tool_call；global/flow级只注入文本"),
        ("质量评分", "QA v3：六维度(完整性/逻辑一致性/需求匹配/信息密度/行业专业性/可执行性)"),
        ("pass/fail规则", "任一维度<3 OR 存在[high]/[critical]级别issue → fail"),
        ("前端部署", "Nginx alias /jiqun/ → follow_jiqun_ui/dist/，index.html no-cache"),
        ("后端端口", "8081（8080被RAGFlow占用）"),
    ]
    for k, v in decisions:
        p(f"- **{k}**：{v}")

    # ── 7. 近期 git log ────────────────────────────────────────────────────────
    h2("7. 近期提交记录")
    code(get_git_log(8))

    # ── 8. 已知问题与待办 ─────────────────────────────────────────────────────
    h2("8. 已知问题 & 注意事项")
    known = [
        "产品部产品规划流程：任务输入含不可能约束(0.8元/Wh+CE+12周)时Agent无法给出可行方案",
        "flow_haolong.yaml：lead_outreach step 的 formal tools 会导致模型只输出77字总结，已移除",
        "Nginx配置有duplicate MIME type warning（不影响功能）",
        "混合运行检测：UI在RunList用step_index=0计数判断，历史遗留混合run会显示'混合'标签",
        "OPC流程：未提供地理位置时market_intel默认浙江，可能与实际不符",
    ]
    for item in known:
        p(f"- {item}")

    # ── 写出文件 ──────────────────────────────────────────────────────────────
    content = "\n".join(lines)
    OUTPUT.write_text(content, encoding="utf-8")

    # 统计
    token_est = len(content) // 3  # 中英混合约3字/token
    print(f"✅ 生成完成: {OUTPUT}")
    print(f"   文件大小: {len(content):,} 字符 / 约 {token_est:,} tokens")
    print(f"   对比通读项目: ~{total_lines//4:,} tokens → 节省 ~{(total_lines//4 - token_est):,} tokens")


if __name__ == "__main__":
    generate()
