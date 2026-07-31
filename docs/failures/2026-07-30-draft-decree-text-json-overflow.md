# 拟旨执行正文被结构化 JSON 撑爆

## Summary

拟旨接口曾把完整结构化 `draft` pretty JSON 序列化为 `decree_text`；页面展示的是简洁的
`expert_example`，实际下旨却提交另一字段，财务长草案因此可能超过正式下旨接口的 2000 字上限。

## Root Cause

系统没有把“供用户审阅的完整结构化草案”和“用户确认后直接执行的自然语言旨意正文”建模为
两个有明确等值关系的契约。后端生成层将完整 `draft` 经缩进 JSON 序列化后写入
`decree_text`，同时 UI 只展示 `expert_example`，导致用户所见文本与授权、提交所用文本分叉；
前端资格判断又未以实际提交的 `decree_text` 长度为准，因此直到正式下旨边界才暴露溢出。

## Prevention

`DRAFT_READY` 响应必须满足
`decree_text == expert_example.strip()`，且规范化正文长度为 1–2000；非 ready 响应不得携带
`decree_text`。完整 `draft` 继续用于审阅与审计，并与服务器生成的规范化 `decree_text`
共同绑定到指纹，防止授权后替换正文。前端按钮资格必须检查实际提交字段，BFF 在调用后端前
再次拒绝空白或超过 2000 字的正文，同时不改写合规正文，以维持 authority 精确匹配。
模型连续返回空白或越界 `expert_example` 时必须纠正重试后失败关闭，不得静默截断。

## Detection

后端回归测试使用真实财务长草案形态，断言 pretty JSON 超过 2000 字时，实际
`decree_text` 仍是可见的自然语言 `expert_example`；另覆盖空白、2000/2001 字边界、一次纠正
与连续无效失败关闭，以及授权登记按 owner、version、fingerprint、`decree_text` 精确匹配。
前端测试覆盖实际提交正文的空白、2000/2001 字门禁、长结构化草案配短执行正文，以及 BFF
在无后端副作用前拒绝非法载荷。全量 `pytest`、`ruff`、前端 test/typecheck/lint/build 和
`node scripts/check_harness.mjs` 系列检查共同防止契约、治理基线或失败记录结构退化。

## Evidence

- [设计说明](../superpowers/specs/2026-07-30-bounded-draft-decree-text-design.md)
- [实施计划](../superpowers/plans/2026-07-30-bounded-draft-decree-text.md)
- [后端响应契约](../../backend/app/agents/chancellor_draft/models.py)
- [后端生成与指纹](../../backend/app/agents/chancellor_draft/graph.py)
- [后端财务长草案及边界测试](../../backend/tests/test_chancellor_draft_graph.py)
- [后端授权精确正文测试](../../backend/tests/test_chancellor_drafts_api.py)
- [前端正文门禁](../../frontend/src/app/study/chancellorDraft.ts)
- [前端 BFF 边界](../../frontend/src/app/api/decrees/chancellor/route.ts)
- [ADR 0028：下旨、证据与归档治理基线](../decisions/0028-decree-evidence-flow-governance-baseline.md)
