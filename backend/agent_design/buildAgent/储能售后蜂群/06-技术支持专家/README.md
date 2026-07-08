# 06-技术支持专家 (QA)

本目录是 **占位说明**，不重复维护 SOUL/AGENTS/USER。

实际 prompt 与角色定义请见：
- prompt 源码：`src/prompts_qa_v2.py` → `QA_TECH_SUPPORT_V3`
- 注册位置：`src/prompts.py:289` → `register_prompt("qa_tech_support", ...)`
- 原始 5 文件定义：`agent_design/buildAgent/市场OPC团队/05-技术支持专家/`

## 在本 Flow 的差异化配置

- `qa_version: v3`（在 flow_storage_aftercare.yaml 顶层）
- `repair.enabled: true`、`min_score: 3.5`（启用自动修复循环）
- 重点维度：**可执行性 / 行业专业性**（针对售后工单场景）
