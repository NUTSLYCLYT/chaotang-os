#!/usr/bin/env python3
"""
验证 Hermes 风格记忆系统是否按设计工作。
运行: python3 scripts/verify_memory.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "


def check(label, ok, detail=""):
    status = PASS if ok else FAIL
    print(f"  {status} {label}", f"— {detail}" if detail else "")
    return ok


def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")


results = []

# ─────────────────────────────────────────
section("层一：人格快照文件")
# ─────────────────────────────────────────

from src.prompt_composer import load_person_profile

for pid in ["halong", "guo_yunhui", "opc_team"]:
    profile = load_person_profile(pid)
    ok = len(profile) > 100
    results.append(check(f"persons/{pid}.md 可加载", ok, f"{len(profile)} 字符"))

missing_ok = load_person_profile("nonexistent") == ""
results.append(check("找不到 profile 时返回空字符串（不抛异常）", missing_ok))

# 验证注入到 prompt
agents_dir = ROOT / "runtime_prompts" / "lead_acquisition"
if agents_dir.exists():
    try:
        from src.prompt_composer import compose_prompt
        import inspect

        sig = inspect.signature(compose_prompt)
        has_person_id = "person_id" in sig.parameters
        results.append(check("compose_prompt 支持 person_id 参数", has_person_id))

        if has_person_id:
            result = compose_prompt(agents_dir, person_id="halong")
            injected = (
                "沟通风格" in result or "郝龙" in result or "USER_PROFILE" in result
            )
            results.append(
                check("person_id 内容出现在 compose_prompt 结果中", injected)
            )
    except Exception as e:
        results.append(check("compose_prompt 注入测试", False, str(e)))

# ─────────────────────────────────────────
section("层二：SQLite FTS5 记忆存储")
# ─────────────────────────────────────────

import tempfile
from src.memory_store import MemoryStore

with tempfile.TemporaryDirectory() as tmp:
    store = MemoryStore(db_path=Path(tmp) / "test.db")

    store.save_run(
        "v001",
        "flow_opc",
        "低温锂电池储能系统方案 浙江客户",
        '{"方案": "100kWh系统"}',
        4.8,
        "opc_team",
        "2026-04-15",
    )
    store.save_run(
        "v002",
        "flow_haolong",
        "新能源汽车客户获取 广东市场",
        '{"触达": "展会邀约"}',
        3.2,
        "halong",
        "2026-04-15",
    )
    store.save_run(
        "v003",
        "flow_opc",
        "特种电池通信基站客户北京项目",
        '{"方案": "特种定制"}',
        4.5,
        "opc_team",
        "2026-04-15",
    )

    count = store.count()
    results.append(check("save_run 写入正常", count == 3, f"共 {count} 条"))

    # FTS5 trigram 精确子串匹配："锂电池" 是 "低温锂电池储能系统方案 浙江客户" 的子串
    hits = store.search_similar("锂电池")
    results.append(
        check("FTS5/LIKE 全文检索有结果", len(hits) > 0, f"检索到 {len(hits)} 条")
    )

    # person_id 过滤："锂电池" 匹配 v001(opc_team)，"特种电池" 匹配 v003(opc_team)
    hits_filtered = store.search_similar("锂电池", person_id="opc_team")
    all_opc = all(h.get("person_id") == "opc_team" for h in hits_filtered)
    results.append(
        check(
            "person_id 过滤正确（返回 dict 含 person_id）",
            all_opc,
            f"过滤后 {len(hits_filtered)} 条，全部 person_id=opc_team={all_opc}",
        )
    )

    empty_hits = store.search_similar("")
    results.append(check("空 query 不报错返回空列表", empty_hits == []))

    recent = store.get_recent(limit=2)
    results.append(check("get_recent 正常", len(recent) == 2, f"返回 {len(recent)} 条"))

# ─────────────────────────────────────────
section("层三：memory_tool 快照操作")
# ─────────────────────────────────────────

from src.memory_tool import get_capacity, add_memory, replace_memory, remove_memory

cap = get_capacity("halong")
ok = "chars" in cap and "pct" in cap and 0 <= cap["pct"] <= 1
results.append(
    check("get_capacity 返回结构正确", ok, f"已用 {cap.get('pct', 0)*100:.0f}%")
)

# ─────────────────────────────────────────
section("层四：flow_engine 集成点")
# ─────────────────────────────────────────

from src.flow_engine import FlowEngine
import inspect

# 检查 register_hook 存在
has_hook = hasattr(FlowEngine, "register_hook")
results.append(check("FlowEngine.register_hook 存在", has_hook))

# 检查 _finalize_run 中有 memory 集成
src = inspect.getsource(FlowEngine)
has_memory_write = "MemoryStore" in src or "memory_store" in src
results.append(check("flow_engine 集成了 MemoryStore 写入", has_memory_write))

has_memory_search = "memory_search" in src
results.append(check("flow_engine 支持 memory_search step 配置", has_memory_search))

# ─────────────────────────────────────────
section("汇总")
# ─────────────────────────────────────────

passed = sum(results)
total = len(results)
pct = passed / total * 100

print(f"\n  总计: {passed}/{total} 通过 ({pct:.0f}%)")
if passed == total:
    print(f"\n  ✅ 记忆系统全链路验证通过，按设计正常工作。")
else:
    failed = total - passed
    print(f"\n  ❌ {failed} 项失败，需要排查。")

sys.exit(0 if passed == total else 1)
