# 评测资产归属收敛

| Field | Value |
| --- | --- |
| Change ID | refactor-evaluation-asset-ownership-20260714 |
| Status | DELIVERED |
| Owner | 后端 harness |
| Date | 2026-07-14 |

## 摘要

将研究技能蒸馏与户部投资研究蜂群安全闸门从前端工程线迁入后端运行/评测
harness，并注册到后端及根级唯一清单。运行报告改写入忽略的 `artifacts/`，
已审核结果保存在 `baselines/`，从而避免评测运行污染工作树。

## 范围

- `backend/harness/deep-research-skill-distillation/`
- `backend/harness/hubu-investment-swarm-gate/`
- `backend/harness/manifest.json`
- `.harness/manifest/project-harness.json`
- 直接相关的 harness 入口与清单文档
