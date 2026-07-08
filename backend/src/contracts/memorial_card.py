"""MemorialCard 回奏卡契约 (SoT 后端侧).

与前端 chaotang-web-lyt/src/lib/contracts/memorial-card.ts 同源,
规范见 chaotang-web-lyt/docs/MEMORIAL_CARD_SPEC.md (2026-06-10 五席会审).

铁律:
- 原始 markdown/JSON 零字节进上书房 —— 卡片只含人话字段。
- 未过御史闸禁入 done 态 —— seal 由确定性闸产生, 非蜂群自评。
- 校验失败 fail-fast, 禁静默补默认值冒充合格 (铁律2)。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# 下一步动作枚举 (张小龙: 唯一主按钮; 槽位表的"建议动作"必须落进这个枚举)
NextAction = Literal["approve_archive", "return_rework", "escalate_junjichu"]

NEXT_ACTION_LABELS: dict[str, str] = {
    "approve_archive": "准奏归档",
    "return_rework": "打回重办",
    "escalate_junjichu": "移交军机处",
}

# 御史印两态 + 受阻 (禁 0-100 连续分外露)
QualitySeal = Literal["verified", "reserved", "blocked"]

QUALITY_SEAL_LABELS: dict[str, str] = {
    "verified": "御史已验",
    "reserved": "御史有保留",
    "blocked": "办差受阻",
}

# 受阻 reason code (机器可读, 留史馆给工部; 陛下只看人话)
ReasonCode = Literal[
    "schema_incomplete",  # 拟奏抽取失败 / 卡片字段残缺
    "qa_fail",  # QA 判 fail
    "hard_check_fail",  # 硬核查 C1数字勾稽/C2需求硬约束/C3事实有据 FAIL
    "qa_missing",  # QA 信号缺失
    "low_score",  # 质量总分低于阈值
    "evidence_missing",  # 凭据不可溯
    "timeout",  # 蜂群超时
    "key_dead",  # 上游 key/服务故障
]


class KeyFinding(BaseModel):
    """凭据要点: 每条必须挂证据指针 (Deming: 一个数字都不能没有出处)。"""

    label: str = Field(..., min_length=1, max_length=24, description="要点名, 人话")
    excerpt: str = Field(..., min_length=1, max_length=120, description="摘录, 人话, 非原始 JSON")
    evidence: str = Field(
        ...,
        min_length=1,
        description="证据指针: snapshot:{sha256前12}#{条目} 或 final_output.{字段名}",
    )


class Provenance(BaseModel):
    """履历行: 办差部门 · 用时 · 案卷号。"""

    department: str = Field(..., min_length=1, description="衙门名, 禁 swarm id 外露")
    duration_ms: int | None = Field(None, ge=0)
    archive_path: str | None = Field(None, description="史馆案卷号; ⑥归档未通时可为 None")
    swarm_id: str = Field("", description="内部追溯用, 不渲染给陛下")
    run_id: str = Field("", description="内部追溯用")


class MemorialCard(BaseModel):
    """回奏卡 (done/blocked 共用一形, 印不同)。"""

    task_id: str = Field(..., min_length=1)
    status: Literal["pending", "running", "done", "blocked"]

    # 第一字段: 原旨回声 (Norman: 评估只能相对意图发生)
    origin_echo: str = Field(..., min_length=1, max_length=60)

    # done 卡核心
    verdict_summary: str = Field("", max_length=48, description="一句话判词 ≤40字+标点余量, 槽位拼装")
    key_findings: list[KeyFinding] = Field(default_factory=list, max_length=3)
    quality_seal: QualitySeal | None = Field(None, description="御史印, 只能由 yushi_gate 产生")
    next_action: NextAction | None = None

    # blocked 卡专属
    blocked_reason_human: str = Field("", max_length=80, description="人话原因, 永不暗示陛下旨意下错")
    reason_codes: list[ReasonCode] = Field(default_factory=list)
    remedy_taken: str = Field("", max_length=60, description="朝廷已做的补救")

    provenance: Provenance

    @field_validator("verdict_summary")
    @classmethod
    def _no_raw_json(cls, v: str) -> str:
        if "{" in v or "```" in v:
            raise ValueError("verdict_summary 不得包含原始 JSON/markdown 痕迹 (内脏不给客人看)")
        return v

    def require_done_complete(self) -> None:
        """done 态完整性断言: 缺件即 fail-fast (禁 skeleton 冒 done)。"""
        missing: list[str] = []
        if not self.verdict_summary:
            missing.append("verdict_summary")
        if not self.key_findings:
            missing.append("key_findings")
        if self.quality_seal is None:
            missing.append("quality_seal")
        if self.next_action is None:
            missing.append("next_action")
        if missing:
            raise ValueError(f"done 卡缺件: {','.join(missing)} (未过闸禁入 done 态)")
