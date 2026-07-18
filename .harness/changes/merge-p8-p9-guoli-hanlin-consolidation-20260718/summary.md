# 变更摘要：merge-p8-p9-guoli-hanlin-consolidation-20260718

Packet ID: P12

> P12 = P8 国力卡薄纵切 + P9 翰林最小读模型（世界级 Agent Harness 执行方案，
> 本地已顺序合并为一体，不可再拆），合并推送以满足 D6 闸"一次 push 一个
> root change"的要求。

| 字段 | 值 |
| --- | --- |
| Change ID | merge-p8-p9-guoli-hanlin-consolidation-20260718 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Claude Code（复审）+ Project Agent（实现） |
| 创建日期 | 20260718 |

## 范围

- **P8 国力卡薄纵切**：`backend/web/routers/guoli.py`（御史封驳率等指标）、
  `frontend/src/features/guoli/`（overview/client/YushiRejectionRateCard）。
- **P9 翰林最小读模型**：`backend/web/routers/hanlin.py`、
  `frontend/src/features/hanlin/`（read-model/api/多个页面组件）。
- **顺带小修复**（与 P8/P9 同批提交，各自独立、无共享根因）：
  - `lawyer_rag.py`：`_PERSONA_DIR` 路径解析从 `backend/src` 反推两级改为三级，
    修复在 linked worktree / 独立 checkout 下法条语料目录解析失败的问题。
  - `forecast_intel_taiyi.py`：补充 legacy 端点调用遥测埋点
    （`record_legacy_endpoint_call`），用于退役前的调用面观测。
  - `chancellor_llm_recommendation.py::merge_decision_level`：修复空字符串
    decision level 被静默当作"未提供"而不是"非法值"的问题——原逻辑
    `llm_level or "D0"` 会让空字符串和 `None` 表现一致，掩盖硬门配置错误；
    现在改为显式区分 `None`（走默认值）与其他非法字符串（直接 `raise
    ValueError`），确保"硬门永远拥有最终裁决权"这条承诺在硬门本身传参错误
    时也不会静默失效。

## 验证

见 `packet_review/review-v1.md`。
