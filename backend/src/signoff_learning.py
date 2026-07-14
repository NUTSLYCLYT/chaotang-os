"""签字学习环：④皇帝签字=学习信号 + ⑩失败记忆自愈环。

朝堂里，蜂群把回奏卡递到御史门 → 过闸后呈皇帝/二审签字。签字是稀缺的人类判决：
- approve（准奏）→ 正向信号，证明该部这条路线靠谱。
- reject（驳回）→ 一条「该部踩过的坑」，下次同部上奏前必须先规避。

本模块把这条人类判决落成可检索的部门级教训库，形成自愈环：

    record_signoff(dept, reject, reason)        # 签字时沉淀教训
        ↓  data/signoff_learning.jsonl (append-only, gitignored)
    recall_lessons(dept)                        # 下次该部蜂群上奏前取回，规避重复

与既有 failure_memory.py 的分工（不重复造轮子）：
- failure_memory.py → ChromaDB 语义检索，按 flow_name 分区，信号来自「自动质量分+修复循环」。
  它回答的是「这个 flow 自动跑砸过吗」。
- signoff_learning.py → 轻量 JSONL，按 dept 分区，信号来自「人类签字驳回」。
  它回答的是「这个部被皇帝/二审打回过吗，为什么」。
两者信号源、键、存储都不同，故另起一个薄模块而非塞进 ChromaDB（那会引入 embedding
依赖且键不匹配）。data/ 已在 .gitignore，教训库只留本地、不进功能提交。

设计取舍：
- append-only JSONL，单行一条，账面可独立 grep / 解析（对齐 truth_ledger.py 的做法）。
- 全程无 LLM、无网络；冷启动期 recall 返回 [] → 零副作用，蜂群照常上奏。
- 所有写入在系统边界 fail-fast：非法 decision / 空 dept / reject 无理由都拒绝。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from src.runtime_paths import resolve_runtime_paths

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_PATH = resolve_runtime_paths().data / "signoff_learning.jsonl"

# 合法签字判决。approve=准奏(正向)，reject=驳回(教训)。
_VALID_DECISIONS = ("approve", "reject")


class SignoffLearning:
    """部门级签字学习库（append-only JSONL）。

    每条记录形如::

        {"ts": "...", "case_id": "...", "decision": "reject",
         "dept": "刑部", "reason": "红线证据链断裂"}

    approve 记录只作正向信号统计，不进 recall_lessons 的规避教训池。
    """

    def __init__(self, path: str | Path = _DEFAULT_PATH) -> None:
        self._path = Path(path)

    # -- 写入 ----------------------------------------------------------------

    def record_signoff(
        self,
        *,
        case_id: str,
        decision: str,
        dept: str,
        reason: str,
        signer: str = "",
    ) -> dict:
        """登记一条皇帝/二审签字。返回写入的条目 dict。

        Args:
            case_id:  被签字的案子/回奏 id（用于回溯到具体上奏）。
            decision: "approve" 或 "reject"。
            dept:     部门名（如 "刑部" / "户部" / "兵部"），教训按此隔离。
            reason:   签字理由。reject 时必填——没有理由就无法成为可规避的教训。

        Raises:
            ValueError: decision 非法 / dept 为空 / reject 无理由（系统边界 fail-fast）。
        """
        decision = (decision or "").strip().lower()
        if decision not in _VALID_DECISIONS:
            raise ValueError(
                f"非法签字 decision={decision!r}，只接受 {_VALID_DECISIONS}"
            )
        dept = (dept or "").strip()
        if not dept:
            raise ValueError("dept 不能为空：教训必须挂在具体部门下")
        reason = (reason or "").strip()
        if decision == "reject" and not reason:
            raise ValueError("reject 必须给出理由，否则无法沉淀为可规避的教训")

        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "case_id": (case_id or "").strip(),
            "decision": decision,
            "dept": dept,
            "reason": reason,
            "signer": (
                signer or ""
            ).strip(),  # 谁拍的板——决策权在客户,落到具体人(可追责)
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.info(
            "signoff_learning: 记一条签字 dept=%s decision=%s case=%s",
            dept,
            decision,
            entry["case_id"],
        )
        return entry

    # -- 读取 ----------------------------------------------------------------

    def _load(self) -> list[dict]:
        if not self._path.exists():
            return []
        out: list[dict] = []
        for line in self._path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                logger.warning("signoff_learning: 跳过损坏行 %s", line[:80])
        return out

    def recall_lessons(self, dept: str, limit: int = 5) -> list[str]:
        """取回某部历史被驳回的教训，供下次该部蜂群上奏前规避。

        只取 reject 的 reason，按时间倒序（最新教训最先规避），最多 limit 条。
        冷启动期（无记录）返回 []，调用方零副作用。

        Args:
            dept:  部门名。
            limit: 最多返回条数（<=0 视为不限制）。
        """
        dept = (dept or "").strip()
        if not dept:
            return []
        lessons = [
            e["reason"]
            for e in self._load()
            if e.get("dept") == dept
            and e.get("decision") == "reject"
            and (e.get("reason") or "").strip()
        ]
        lessons.reverse()  # 最新在前（_load 按写入顺序）
        if limit and limit > 0:
            lessons = lessons[:limit]
        return lessons

    def health(self) -> dict:
        """账面健康度：签字总量、approve/reject 计数、各部教训数（在转/空转一目了然）。"""
        rows = self._load()
        approve = sum(1 for r in rows if r.get("decision") == "approve")
        reject = sum(1 for r in rows if r.get("decision") == "reject")
        lessons_by_dept: dict[str, int] = {}
        for r in rows:
            if r.get("decision") == "reject":
                d = r.get("dept", "")
                lessons_by_dept[d] = lessons_by_dept.get(d, 0) + 1
        return {
            "total": len(rows),
            "approve": approve,
            "reject": reject,
            "lessons_by_dept": lessons_by_dept,
        }


# ---------------------------------------------------------------------------
# 模块级默认单例 + 便捷函数（写真实 data/signoff_learning.jsonl，gitignored）
# ---------------------------------------------------------------------------

_DEFAULT = SignoffLearning()


def record_signoff(
    *, case_id: str, decision: str, dept: str, reason: str, signer: str = ""
) -> dict:
    """便捷入口：用默认单例登记一条签字。详见 SignoffLearning.record_signoff。"""
    return _DEFAULT.record_signoff(
        case_id=case_id, decision=decision, dept=dept, reason=reason, signer=signer
    )


def recall_lessons(dept: str, limit: int = 5) -> list[str]:
    """便捷入口：用默认单例取回某部历史教训。详见 SignoffLearning.recall_lessons。"""
    return _DEFAULT.recall_lessons(dept, limit=limit)


def health() -> dict:
    """便捷入口：默认单例的账面健康度。"""
    return _DEFAULT.health()
