#!/usr/bin/env python3
"""给真值台账通电 —— 用确定性检查器评判系统里已有的"历史真实蜂群输出"。

不灌参考值(那会把非判定混成假 PASS),而是对 data/default/runs/ 里的真实 final_output
**现场重跑确定性检查器**(pack_rd_check / sourcing_check),产出真·判定写入 truth_ledger。
全程零模型链路、零自评分:输出是历史真的,判定是当场算的。

映射:
  PACK研发蜂群流程 / 电池研发 Stage Gate → pack_rd_check (硬约束 C1-C5)
  电芯Sourcing搜寻流程                    → sourcing_check (对照真实电芯库)

用法: python scripts/seed_ledger.py            # 通电
      python scripts/seed_ledger.py --dry      # 只看会评判哪些,不写台账
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

RUNS = ROOT / "data" / "default" / "runs"

# 注意:Stage Gate 是决策门流程,不是 PACK 设计——用 C1-C5 评它是张冠李戴(会造假 FAIL)。
# 它需要自己的确定性检查器(见 #10),此处不混入,宁可不评也不错评。
PACK_FLOWS = {"PACK研发蜂群流程"}
SOURCING_FLOWS = {"电芯Sourcing搜寻流程"}
ARCHIVE_FLOWS = {"史馆归档流程"}
INTEL_FLOWS = {"锦衣卫情报蜂群"}
RECRUIT_FLOWS = {"吏部招聘蜂群"}
FORECAST_FLOWS = {"钦天监预测蜂群"}
HAOLONG_FLOWS = {"郝龙获客Pipeline"}


def _authenticated_run_ids() -> set:
    """源头鉴权(大神建议):从 data/fengqun.db 的 tasks 表取所有合法 run_id。

    真血必须同时存在于'不可随意伪造的数据库'和'文件系统'两处。
    只在 runs/ 目录、数据库查不到的孤儿运行 → 疑似投毒/测试残留,标 orphan 不计入可信真血。
    """
    import sqlite3

    db = ROOT / "data" / "fengqun.db"
    if not db.exists():
        return set()
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        ids = {r[0] for r in con.execute("select run_id from tasks where run_id is not null")}
        con.close()
        return ids
    except Exception:
        return set()


def _flatten(obj) -> str:
    """把 final_output(可能嵌套 dict/list)摊平成纯文本供检查器抽取。"""
    if isinstance(obj, dict):
        return "\n".join(f"{k}: {_flatten(v)}" for k, v in obj.items())
    if isinstance(obj, list):
        return "\n".join(_flatten(x) for x in obj)
    return str(obj)


def _final_text(run_dir: Path) -> str:
    fo = run_dir / "final_output.json"
    if not fo.exists():
        return ""
    data = json.loads(fo.read_text(encoding="utf-8"))
    # 真正内容通常在 data["final_output"]；连同 qa issues 一起摊平提高命中
    return _flatten(data.get("final_output", data)) + "\n" + _flatten(data.get("qa_result", ""))


def grade(flow: str, task: str, text: str, use_llm: bool = False):
    """返回 [(checker_name, verdict, evidence), ...] 或 [](此 flow 无确定性检查器)。
    一个 flow 可有多把尺子(如 sourcing=选芯 + 供应链两维)。"""
    if flow in PACK_FLOWS:
        import pack_rd_check as prc

        if use_llm:
            from src.llm_extract import extract_pack_llm

            ex = extract_pack_llm(text)  # LLM 只抽数字,降 blind_rate
        else:
            ex = prc.extract(text)
        checks = prc.check(ex, task)  # 传任务:C1电量按本运行自己的目标±15%判,不套用他例
        statuses = [c["status"] for c in checks]
        # 实质性检查=C1电量/C2软包/C3比能量(C4不得加热/C5为负向或弱信号,不足以单独证明通过)
        sub_pass = any(c["status"] == "PASS" and c["check"][:2] in ("C1", "C2", "C3") for c in checks)
        # 三态(诚实):任一硬约束 FAIL→FAIL;否则须有实质正向验证才 PASS;否则 UNKNOWN(绝不靠被动负向检查翻 PASS)
        if "FAIL" in statuses:
            verdict = "FAIL"
        elif sub_pass:
            verdict = "PASS"
        else:
            verdict = "UNKNOWN"
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("pack_rd_check", verdict, ev)]
    if flow in SOURCING_FLOWS:
        import io
        import contextlib
        import sourcing_check as sc
        import supply_chain_check as scc

        results = []
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            res = sc.check(task, text)
        if not res:
            results.append(("sourcing_check", "UNKNOWN", "未出现库内型号"))
        else:
            results.append(("sourcing_check", res[0], res[1]))
        # 供应链维度第二把尺子(风险情报/四类分离/询价/价格勾稽)
        sc_checks = scc.check(task, text)
        sc_ev = "; ".join(f"{c['check']}={c['status']}" for c in sc_checks)
        results.append(("supply_chain_check", scc.verdict_of(sc_checks), sc_ev))
        return results
    if flow in ARCHIVE_FLOWS:
        import archive_check as ac

        checks = ac.check(text)
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("archive_check", ac.verdict_of(checks), ev)]
    if flow in INTEL_FLOWS:
        import intel_check as ic

        checks = ic.check(text)
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("intel_check", ic.verdict_of(checks), ev)]
    if flow in RECRUIT_FLOWS:
        import recruit_check as rc

        checks = rc.check(text)
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("recruit_check", rc.verdict_of(checks), ev)]
    if flow in FORECAST_FLOWS:
        import forecast_check as fc

        checks = fc.check(text)
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("forecast_check", fc.verdict_of(checks), ev)]
    if flow in HAOLONG_FLOWS:
        import haolong_check as hc

        checks = hc.check(text)
        ev = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        return [("haolong_check", hc.verdict_of(checks), ev)]
    return []


def main() -> int:
    ap = argparse.ArgumentParser(description="给真值台账通电(评判历史真实运行)")
    ap.add_argument("--dry", action="store_true", help="只列会评判哪些,不写台账")
    ap.add_argument("--llm", action="store_true", help="用 LLM 抽取(需模型链路),降 blind_rate")
    a = ap.parse_args()
    if not RUNS.exists():
        print(f"无运行目录: {RUNS}", file=sys.stderr)
        return 1

    from src.truth_ledger import record, health

    swarm_of = {
        **{f: "pack_rd" for f in PACK_FLOWS},
        **{f: "sourcing" for f in SOURCING_FLOWS},
        **{f: "shiguan_archive" for f in ARCHIVE_FLOWS},
        **{f: "jinyiwei_intel" for f in INTEL_FLOWS},
        **{f: "libu_recruit" for f in RECRUIT_FLOWS},
        **{f: "tianjian_forecast" for f in FORECAST_FLOWS},
        **{f: "haolong" for f in HAOLONG_FLOWS},
    }
    valid_run_ids = _authenticated_run_ids()  # 源头鉴权:数据库里查得到的 run_id
    graded = skipped = 0
    by_v: dict[str, int] = {}
    for run_dir in sorted(RUNS.iterdir()):
        meta_f = run_dir / "run_meta.json"
        if not meta_f.is_dir() and not meta_f.exists():
            continue
        try:
            meta = json.loads(meta_f.read_text(encoding="utf-8"))
        except Exception:
            continue
        flow = meta.get("flow_name", "")
        if flow not in swarm_of:
            continue
        text = _final_text(run_dir)
        if not text.strip():
            skipped += 1
            continue
        try:
            g = grade(flow, meta.get("task_input", ""), text, use_llm=a.llm)
        except Exception as e:  # LLM 链路故障等:标 UNKNOWN,不静默丢
            print(f"  [ERROR  ] {flow[:14]:<14} {run_dir.name}  抽取失败: {e}")
            g = []
        if not g:
            skipped += 1
            continue
        rid = meta.get("run_id", run_dir.name)
        # 源头鉴权:run_id 在数据库 tasks 表查得到=authenticated(不可随意伪造);否则=orphan(疑似投毒/测试残留)
        prov = "authenticated" if rid in valid_run_ids else "orphan"
        prov_mark = "🔒" if prov == "authenticated" else "⚠️孤儿"
        for checker, verdict, ev in g:
            by_v[verdict] = by_v.get(verdict, 0) + 1
            print(f"  [{verdict:7}] {prov_mark} {flow[:12]:<12} {checker:<18} {rid}  {ev[:40]}")
            if not a.dry:
                record(
                    swarm_of[flow],
                    checker,
                    verdict,
                    case_id=f"run_{rid}_{checker}",
                    detail=ev,
                    evidence=ev,
                    provenance=prov,
                )
            graded += 1

    print(f"\n评判 {graded} 个真实运行  跳过 {skipped}  分布={by_v}")
    if not a.dry:
        print("\n=== 通电后 flywheel_health ===")
        print(json.dumps(health(), ensure_ascii=False, indent=2))
    else:
        print("(--dry 未写台账)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
