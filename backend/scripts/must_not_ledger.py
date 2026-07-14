#!/usr/bin/env python3
"""must_not 条目管理器 — 缺陷→禁令闭环的幂等核心。

大神共识实现（Harrison Chase + 大野耐一 + Schneier）:
  - 不能 AI 直接写禁令：必须经 pending → approved 两阶段确认
  - 幂等去重：每条禁令生成内容哈希 id，重复添加自动合并，不重复写入
  - 拉动式：当同一 pattern 第二次被审查官标记时，自动拉动"建议 approved"信号
  - 安全隔离：具体漏洞路径不明文存入向量库（输出时脱敏摘要）

存储：data/must_not_ledger.json
  {
    "<hash_id>": {
      "id": "sha256_prefix8",
      "swarm_id": "quotation",
      "prohibited_pattern": "...",
      "trigger_condition": "...",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "evidence_run_id": "...",
      "hit_count": 2,           ← 命中2次时自动拉动 approved
      "status": "pending|approved|rejected",
      "created_at": "...",
      "approved_by": null|"张三(工程师)",
      "must_not_text": "..."     ← 可直接写入 golden_cases 的文本
    }
  }

用法:
  python scripts/must_not_ledger.py list               # 查看所有条目
  python scripts/must_not_ledger.py list --pending     # 只看待审核
  python scripts/must_not_ledger.py approve <id> "张三" # 审批通过
  python scripts/must_not_ledger.py reject <id>        # 驳回
  python scripts/must_not_ledger.py add-from-review <run_id>  # 从工部审查run写入
  python scripts/must_not_ledger.py export <swarm_id>  # 导出到 golden_cases must_not
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from src.runtime_paths import resolve_runtime_paths

LEDGER_PATH = resolve_runtime_paths().data / "must_not_ledger.json"
AUTO_APPROVE_THRESHOLD = 2  # 同一 pattern 第N次复现时自动推送 approved 建议


def _load() -> dict:
    if not LEDGER_PATH.exists():
        return {}
    return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))


def _save(ledger: dict) -> None:
    import os as _os

    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    _os.replace(tmp, LEDGER_PATH)


def _hash(swarm_id: str, prohibited_pattern: str) -> str:
    """内容哈希作为幂等 id（前8位）。"""
    content = f"{swarm_id}:{prohibited_pattern.strip().lower()}"
    return hashlib.sha256(content.encode()).hexdigest()[:8]


def add_entry(
    swarm_id: str,
    prohibited_pattern: str,
    trigger_condition: str,
    severity: str,
    evidence_run_id: str,
    must_not_text: str,
    auto_approve: bool = False,
) -> tuple[str, bool]:
    """添加或更新一条 must_not 条目。返回 (hash_id, is_new)。"""
    ledger = _load()
    hid = _hash(swarm_id, prohibited_pattern)
    now = datetime.now(tz=timezone.utc).isoformat()

    if hid in ledger:
        # 幂等合并：更新命中次数
        entry = ledger[hid]
        entry["hit_count"] += 1
        entry["last_seen_run_id"] = evidence_run_id
        entry["last_seen_at"] = now
        is_new = False
        # 拉动式：达到阈值 → 自动建议 approved
        if entry["hit_count"] >= AUTO_APPROVE_THRESHOLD and entry["status"] == "pending":
            entry["auto_approve_suggested"] = True
            if auto_approve:
                entry["status"] = "approved"
                entry["approved_by"] = "auto(复现≥2次)"
                entry["approved_at"] = now
    else:
        ledger[hid] = {
            "id": hid,
            "swarm_id": swarm_id,
            "prohibited_pattern": prohibited_pattern,
            "trigger_condition": trigger_condition,
            "severity": severity,
            "evidence_run_id": evidence_run_id,
            "hit_count": 1,
            "status": "approved" if auto_approve else "pending",
            "created_at": now,
            "approved_by": "auto(首次)" if auto_approve else None,
            "must_not_text": must_not_text,
            "auto_approve_suggested": False,
        }
        is_new = True

    _save(ledger)
    return hid, is_new


CHROMA_DB_DIR = ROOT / "knowledge" / "chroma_db"
CHROMA_COLLECTION = "fengqun_knowledge"
CODE_REVIEW_DOMAIN = "code_review_rules"


def index_to_chroma(entry: dict) -> bool:
    """把 approved must_not 写入 ChromaDB（domain=code_review_rules）。
    Karpathy 方案核心：让 quotation/opc 的 knowledge_pre_retrieval 在
    generation 之前检索到禁令，用数据覆盖幻觉，而非靠规则文本拦截。
    """
    try:
        import chromadb
        from src.knowledge_rag import KnowledgeRAG

        rag = KnowledgeRAG()
        client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))
        col = client.get_or_create_collection(CHROMA_COLLECTION, embedding_function=rag._embedding_fn)

        doc = (
            f"【工部审查禁令 · {entry['swarm_id']}】\n"
            f"禁止行为：{entry['prohibited_pattern']}\n"
            f"触发条件：{entry['trigger_condition']}\n"
            f"严重度：{entry['severity']}\n"
            f"规范表达：{entry['must_not_text']}"
        )
        col.upsert(
            ids=[f"must_not_{entry['id']}"],
            documents=[doc],
            metadatas=[
                {
                    "knowledge_domain": CODE_REVIEW_DOMAIN,
                    "swarm_id": entry["swarm_id"],
                    "severity": entry["severity"],
                    "indexed_at": datetime.now(tz=timezone.utc).isoformat(),
                }
            ],
        )
        return True
    except Exception as e:
        print(f"⚠️ ChromaDB 写入失败(非致命): {e}")
        return False


def approve(entry_id: str, approver: str) -> bool:
    ledger = _load()
    if entry_id not in ledger:
        return False
    ledger[entry_id]["status"] = "approved"
    ledger[entry_id]["approved_by"] = approver
    ledger[entry_id]["approved_at"] = datetime.now(tz=timezone.utc).isoformat()
    _save(ledger)
    # Karpathy 方案：审批通过立即写入 ChromaDB 供 RAG 检索
    indexed = index_to_chroma(ledger[entry_id])
    if indexed:
        print(f"  → ChromaDB 已写入 code_review_rules 域")
    return True


def seed_known_rules(rules: list[dict], auto_approve: bool = True) -> int:
    """批量种入已验证的规则（来自 score_swarm 历史失败案例）。"""
    count = 0
    for r in rules:
        hid, is_new = add_entry(
            swarm_id=r["swarm_id"],
            prohibited_pattern=r["prohibited_pattern"],
            trigger_condition=r.get("trigger_condition", "score_swarm 历史失败验证"),
            severity=r.get("severity", "HIGH"),
            evidence_run_id=r.get("evidence_run_id", "seed_20260605"),
            must_not_text=r["must_not_text"],
            auto_approve=auto_approve,
        )
        if is_new or auto_approve:
            indexed = index_to_chroma(_load()[hid])
            print(
                f"  {'新增' if is_new else '已存在'} [{hid}] → ChromaDB={'✅' if indexed else '⚠️'}: {r['must_not_text'][:55]}"
            )
            count += 1
    return count


def reject(entry_id: str, reason: str = "") -> bool:
    ledger = _load()
    if entry_id not in ledger:
        return False
    ledger[entry_id]["status"] = "rejected"
    ledger[entry_id]["reject_reason"] = reason
    _save(ledger)
    return True


def export_approved(swarm_id: str) -> list[str]:
    """导出 swarm 的所有 approved must_not 文本（可直接写入 golden_cases）。"""
    ledger = _load()
    return [e["must_not_text"] for e in ledger.values() if e["swarm_id"] == swarm_id and e["status"] == "approved"]


def add_from_review_output(review_output: dict, run_id: str) -> list[str]:
    """从工部 review_synthesizer 的输出中解析并写入 must_not 条目。
    返回新写入的 hash_id 列表。
    """
    raw = review_output.get("must_not条目建议", "") or ""
    if not raw:
        return []

    added = []
    for line in raw.splitlines():
        line = line.strip().lstrip("-•*").strip()
        if not line or len(line) < 10:
            continue
        # 解析格式：<swarm_id> must_not: <text>
        if "must_not:" in line:
            parts = line.split("must_not:", 1)
            swarm = parts[0].strip()
            pattern = parts[1].strip()
        else:
            swarm = "general"
            pattern = line

        hid, is_new = add_entry(
            swarm_id=swarm,
            prohibited_pattern=pattern,
            trigger_condition="工部代码审查发现",
            severity="HIGH",
            evidence_run_id=run_id,
            must_not_text=pattern,
        )
        added.append(hid)
        status = "新增(pending)" if is_new else "已存在(命中+1)"
        print(f"  [{hid}] {status}: {pattern[:60]}")

    return added


def main() -> int:
    ap = argparse.ArgumentParser(description="must_not 条目管理器")
    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("list").add_argument("--pending", action="store_true")
    app_p = sub.add_parser("approve")
    app_p.add_argument("id")
    app_p.add_argument("approver", nargs="?", default="(未具名)")
    rej_p = sub.add_parser("reject")
    rej_p.add_argument("id")
    rej_p.add_argument("reason", nargs="?", default="")
    exp_p = sub.add_parser("export")
    exp_p.add_argument("swarm_id")
    add_p = sub.add_parser("add-from-review")
    add_p.add_argument("run_id")
    sub.add_parser("seed")  # 种入已验证规则并写入 ChromaDB
    sub.add_parser("reindex")  # 重新把所有 approved 条目写入 ChromaDB

    args = ap.parse_args()
    if not args.cmd:
        ap.print_help()
        return 1

    ledger = _load()

    if args.cmd == "list":
        entries = list(ledger.values())
        if getattr(args, "pending", False):
            entries = [e for e in entries if e["status"] == "pending"]
        if not entries:
            print("(空)")
            return 0
        print(f"{'ID':10} {'swarm':15} {'严重':6} {'状态':10} {'命中':4} {'禁令摘要'}")
        print("─" * 80)
        for e in sorted(entries, key=lambda x: (-x["hit_count"], x["created_at"])):
            suggest = " ★建议approve" if e.get("auto_approve_suggested") else ""
            print(
                f"{e['id']:10} {e['swarm_id']:15} {e['severity']:6} "
                f"{e['status']:10} {e['hit_count']:4}  {e['must_not_text'][:35]}{suggest}"
            )

    elif args.cmd == "approve":
        if approve(args.id, args.approver):
            print(f"✅ 已 approved: {args.id} (by {args.approver})")
        else:
            print(f"❌ 未找到: {args.id}")
            return 1

    elif args.cmd == "reject":
        if reject(args.id, args.reason):
            print(f"已驳回: {args.id}")
        else:
            print(f"❌ 未找到: {args.id}")
            return 1

    elif args.cmd == "export":
        texts = export_approved(args.swarm_id)
        if not texts:
            print(f"swarm '{args.swarm_id}' 没有 approved 条目。")
            return 0
        print(f"# {args.swarm_id} 的 approved must_not 条目（可写入 golden_cases）")
        for t in texts:
            print(f"- {t}")

    elif args.cmd == "add-from-review":
        # 读取 run_id 对应的飞轮输出
        from src.run_logger import load_flywheel

        recs = load_flywheel(limit=50)
        rec = next((r for r in recs if r.run_id.startswith(args.run_id)), None)
        if not rec:
            print(f"❌ 未找到 run_id={args.run_id}")
            return 1
        fo = rec.final_output_fields or {}
        added = add_from_review_output(fo, args.run_id)
        print(f"写入 {len(added)} 条，状态均为 pending，需人工 approve 后生效。")

    elif args.cmd == "seed":
        # score_swarm 历史失败案例提炼的已验证规则 — 直接 approved + 写 ChromaDB
        KNOWN_RULES = [
            # ── quotation ──────────────────────────────────────────────
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "用LFP大方形电芯（280Ah储能级）对消费级便携产品（≤10kWh/户外/便携）报价",
                "must_not_text": "用LFP大方形电芯对消费级便携电池报价（-30℃性能差且体积不符，应用21700低温圆柱）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "对消费级便携产品使用元/Wh定价单位（如0.38元/Wh）",
                "must_not_text": "A类消费级产品用元/Wh报价（正确单位：整机元/套，1.5kWh低温版≥¥15,000）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "给出确定性单一价格而非区间（尤其是急单场景）",
                "must_not_text": "给出确定性单一报价，不给区间（急单也必须给区间+前提条件）",
                "severity": "HIGH",
            },
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "报价不含有效期/税率/签批声明",
                "must_not_text": "输出不含价格有效期、含/不含税声明、签批免责句",
                "severity": "HIGH",
            },
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "未验算串并联容量即对电芯配组报价",
                "must_not_text": "跳过串并联容量验算（系统容量=S×P×V×Ah）直接报价（可能导致容量严重不符）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "quotation",
                "prohibited_pattern": "未核实-30℃低温电芯库存即承诺可用",
                "must_not_text": "未确认-30℃专用电芯库存即承诺该温度可用",
                "severity": "HIGH",
            },
            # ── opc / solution_architect ───────────────────────────────
            {
                "swarm_id": "opc",
                "prohibited_pattern": "声称LFP在-40℃无加热保持率≥70%（物理极限20-45%）",
                "must_not_text": "LFP在-40℃无加热下声称容量保持率≥70%（实际20-45%，超物理极限=幻觉）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "opc",
                "prohibited_pattern": "虚构电芯型号（如LFP-40C-100Ah、NCM-XT50等带温度后缀的发明型号）",
                "must_not_text": "虚构电芯型号（LFP-40C-100Ah/NCM-XT50等），只用已知量产型号",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "opc",
                "prohibited_pattern": "800万预算做100MWh储能不指出预算严重不足",
                "must_not_text": "不指出预算严重不足（800万÷100MWh=0.08元/Wh，低于市场最低0.5元/Wh约6倍）",
                "severity": "HIGH",
            },
            {
                "swarm_id": "opc",
                "prohibited_pattern": "-40℃场景不强制要求主动加热系统",
                "must_not_text": "-40℃+LFP场景不提主动加热系统（否则净出力仅20-45%，无法商用）",
                "severity": "HIGH",
            },
            # ── sourcing ───────────────────────────────────────────────
            {
                "swarm_id": "sourcing",
                "prohibited_pattern": "推荐未验证-30℃性能的常温型21700给低温项目",
                "must_not_text": "推荐天鹏/倍特等常温型21700用于-30℃场景（未验证低温性能=误导选型）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "sourcing",
                "prohibited_pattern": "虚构不量产型号（如INR21700-RS50、EVE-LT35等）",
                "must_not_text": "虚构不存在的电芯型号（INR21700-RS50等），推荐时只写厂家方向待报样",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "sourcing",
                "prohibited_pattern": "对≤8元/支低温21700不分析预算可行性直接推荐",
                "must_not_text": "不分析≤8元/支对-30℃低温21700的可行性（市场实际9-15元/支）",
                "severity": "HIGH",
            },
            # ── storage_aftercare ─────────────────────────────────────
            {
                "swarm_id": "storage_aftercare",
                "prohibited_pattern": "无规格书时输出指向责任归属的倾向性结论（含概率性表述）",
                "must_not_text": "无规格书时给出责任倾向性结论（含'高概率为'/'可能不是缺陷'等表述）",
                "severity": "CRITICAL",
            },
            {
                "swarm_id": "storage_aftercare",
                "prohibited_pattern": "虚构电芯型号或BMS固件缺陷作为根因",
                "must_not_text": "虚构电芯型号/BMS固件版本作为假设性根因（无证据型号一律标[待取证]）",
                "severity": "HIGH",
            },
            # ── general ────────────────────────────────────────────────
            {
                "swarm_id": "general",
                "prohibited_pattern": "except Exception: pass 吞掉 decision_guard 熔断失败",
                "must_not_text": "except Exception: pass 静默吞掉 decision_guard/governance 安全关键失败",
                "severity": "CRITICAL",
            },
        ]
        print(f"种入 {len(KNOWN_RULES)} 条已验证规则（直接 approved + 写 ChromaDB）\n")
        count = seed_known_rules(KNOWN_RULES, auto_approve=True)
        print(f"\n✅ 完成：{count} 条已写入台账 + ChromaDB（domain=code_review_rules）")

    elif args.cmd == "reindex":
        # 把所有 approved 条目重新写入 ChromaDB（维度不匹配修复后用）
        ledger = _load()
        ok = sum(1 for e in ledger.values() if e["status"] == "approved" and index_to_chroma(e))
        print(f"重新索引: {ok} 条 approved 写入 ChromaDB")

    total = len(ledger)
    pending = sum(1 for e in ledger.values() if e["status"] == "pending")
    approved = sum(1 for e in ledger.values() if e["status"] == "approved")
    print(f"\n台账: 共 {total} 条 | pending {pending} | approved {approved}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
