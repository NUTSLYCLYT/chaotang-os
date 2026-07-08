"""每企业专项进化 · bootstrap 采集器(2026-07-07 · 三层架构第5步)。

"每个企业注入真实数据 → 朝堂第一时间建立针对该企业的专项进化"的落地第一环:
把企业的部门数据目录**结构**(不读文件内容)映射成一套**该企业专属的、待人确认的**六部能力卡。

顶尖大神纪律(会审):
1. **人在环 provisional**:所有产出标 provisional=True。部门→六部的映射是**业务判断**(市场部算兵部还是礼部?
   采购部算工部还是兵部?),朝堂只**提议**,由用户确认/纠正,绝不当既成事实(会审 CRITICAL:别拿建档当真理)。
2. **只加法不减法**(会审 CRITICAL):没匹配上的部门/六部**不移出候选**,标 unmatched 让用户补,而不是静默剪掉
   → 防"三个月后需要刑部却不在这家枚举里、静默错投"。
3. **只读结构不读内容**:本采集器只看顶层子目录名,不读 xlsx/客户/财务文件。内容进 RAG/尺子是单独的、
   需显式授权 + 脱敏的一步(见 shiguan_seed),防把机密静默灌进检索。
4. **每租户隔离**:写进 get_tenant_data_dir("bootstrap")(第0步a 已修真隔离),这家的卡不落别家。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# 六部真实码(harness/chaotang_department_protocol/departments.yaml):
#   hubu 户部 / gongbu 工部 / bingbu 兵部 / libu_personnel 吏部 / libu 礼部 / xingbu 刑部
# 部门名关键词 → 提议的六部码。这是**提议**,不是真理——业务判断由用户确认(provisional)。
DEPT_FOLDER_HINTS: list[tuple[str, str, str]] = [
    # (关键词, 提议六部码, 六部名)
    ("财务", "hubu", "户部"),
    ("会计", "hubu", "户部"),
    ("技术", "gongbu", "工部"),
    ("研发", "gongbu", "工部"),
    ("产品", "gongbu", "工部"),
    ("项目", "gongbu", "工部"),
    ("市场", "bingbu", "兵部"),
    ("销售", "bingbu", "兵部"),
    ("采购", "bingbu", "兵部"),
    ("人事", "libu_personnel", "吏部"),
    ("行政", "libu_personnel", "吏部"),
    ("法务", "xingbu", "刑部"),
    ("合规", "xingbu", "刑部"),
    ("品牌", "libu", "礼部"),
]

ALL_SIX = [
    ("hubu", "户部"),
    ("gongbu", "工部"),
    ("bingbu", "兵部"),
    ("libu_personnel", "吏部"),
    ("libu", "礼部"),
    ("xingbu", "刑部"),
]


def _match_ministry(folder_name: str) -> tuple[str, str] | None:
    """部门文件夹名 → 提议六部码(命中第一个关键词);无命中返回 None(标 unmatched,不硬塞)。"""
    for kw, code, name in DEPT_FOLDER_HINTS:
        if kw in folder_name:
            return code, name
    return None


def propose_capability_cards(folder_names: list[str]) -> dict[str, Any]:
    """纯函数:企业部门文件夹名列表 → 提议的六部能力卡(全 provisional,只加法)。

    返回 {cards:[{ministry_code, ministry_name, source_folder, provisional, confirmed}],
          unmatched_folders:[...], missing_ministries:[{code,name}]}。
    - cards:命中六部的部门,provisional=True/confirmed=False 待人确认。
    - unmatched_folders:没匹配上任何六部的部门 → 让用户手动归属,不静默丢。
    - missing_ministries:六部里这家还没有对应部门的 → 保留在候选(只加法),标缺,不移出。
    """
    cards: list[dict[str, Any]] = []
    unmatched: list[str] = []
    seen_codes: set[str] = set()
    for fn in folder_names:
        m = _match_ministry(fn)
        if m is None:
            unmatched.append(fn)
            continue
        code, name = m
        cards.append(
            {
                "ministry_code": code,
                "ministry_name": name,
                "source_folder": fn,
                "provisional": True,  # 待用户确认,别当真理
                "confirmed": False,
            }
        )
        seen_codes.add(code)
    # 只加法:六部里没被这家数据点亮的,保留标缺(冷部门不移出候选,防日后静默错投)
    missing = [{"code": c, "name": n} for c, n in ALL_SIX if c not in seen_codes]
    return {
        "cards": cards,
        "unmatched_folders": unmatched,
        "missing_ministries": missing,
    }


def bootstrap_tenant(tenant_slug: str, data_folder: str | Path) -> dict[str, Any]:
    """给某租户从其数据目录**结构**建提议能力卡,写进该租户隔离目录,返回待确认结果。

    只扫顶层子目录名,不读文件内容。写 get_tenant_data_dir("bootstrap")/capability_cards.json。
    """
    from src.tenant import get_tenant_data_dir, tenant_context

    folder = Path(data_folder)
    if not folder.exists():
        return {"error": f"数据目录不存在: {folder}", "cards": []}
    subdirs = [p.name for p in folder.iterdir() if p.is_dir()]
    proposal = propose_capability_cards(subdirs)
    proposal["tenant"] = tenant_slug
    proposal["source_folder"] = str(folder)
    proposal["note"] = (
        "provisional 提议,需用户确认/纠正部门→六部映射后方可 active(人在环,第5步)"
    )

    with tenant_context(tenant_slug):
        out = get_tenant_data_dir("bootstrap") / "capability_cards.json"
        out.write_text(
            json.dumps(proposal, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        proposal["written_to"] = str(out)
    return proposal


def confirm_capability_cards(
    tenant_slug: str,
    overrides: dict[str, str] | None = None,
    reject: list[str] | None = None,
) -> dict[str, Any]:
    """人在环确认:把 provisional 能力卡转 active(第5步纪律,建档不自动生效)。

    overrides: {source_folder: 新六部码} 纠正提议的映射(如把"采购部"从 bingbu 改 gongbu)。
    reject:    [source_folder] 拒绝某张卡(如把 AI数据库 排除)。
    默认(无参)= 全盘接受提议映射。只有本函数跑过、confirmed=True 的卡才算 active。
    """
    from src.tenant import get_tenant_data_dir, tenant_context

    overrides = overrides or {}
    reject_set = set(reject or [])
    with tenant_context(tenant_slug):
        path = get_tenant_data_dir("bootstrap") / "capability_cards.json"
        if not path.exists():
            return {"error": "尚未 bootstrap,先跑 bootstrap_tenant", "cards": []}
        data = json.loads(path.read_text(encoding="utf-8"))
        active: list[dict[str, Any]] = []
        for c in data.get("cards", []):
            folder = c.get("source_folder", "")
            if folder in reject_set:
                c["confirmed"] = False
                c["rejected"] = True
                continue
            if folder in overrides:
                c["ministry_code"] = overrides[folder]  # 纠正映射
            c["provisional"] = False
            c["confirmed"] = True
            active.append(c)
        data["active_cards"] = active
        data["confirmed"] = True
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return {"active_cards": active, "count": len(active), "tenant": tenant_slug}
