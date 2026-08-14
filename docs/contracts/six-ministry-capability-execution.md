# 六部能力执行兼容契约草案

状态：阶段 1、离线草案、非生产接线。此 envelope **不得成为第二事实源**，也不授予执行权限。

## 权威映射

| 本草案字段 | 唯一权威 | 映射规则 |
| --- | --- | --- |
| `runtime_skill_binding` | `backend/app/agents/runtime_skills/models.py` 与 `backend/app/agents/runtime_skills/registry.py` | 只记录 `skill_id`、版本及定义摘要；layer、responsibility、allowed services 和 tool policy 必须实时由下游 RuntimeSkill registry 解析。 |
| `evidence` | `backend/app/agents/evidence_protocol.py` 的 `AgentEvidenceSnapshot` | 只记录 snapshot 引用及消费视图；adapter 必须加载 snapshot 并逐项比对 status、采用 ID 和缺口，证据正文、绑定、来源不得复制进本契约。 |
| `execution.human_confirmation` | `backend/app/work_products/models.py` 的 `WorkProductEnvelope` 与 `ConfirmationReceipt` | 现有 receipt 只证明 work-product version/sequence/actor decision；未来接线必须由受信适配器把 receipt 与 owner-scoped WorkProductEnvelope、run 和 preview digest 组合后签发绑定投影。envelope 自报字段不构成证明。 |
| `responsibility.authority_projection_ref` | 根级机器 authority projection | 责任归属不能扩大权限；权限由 capability/tenant/tool policy 交集决定。 |
| `tool_policy` | 现有 tool registry/policy evaluator | envelope 只携请求和 decision receipt 引用，不能声明新的工具或自批。 |

## 强制不变量

- `tenant_id`、`owner_user_id`、`run_id` 必须由受信入口注入，并在 evidence、preview、confirmation、tool receipt 与持久化边界逐一相等；用户或模型不能改写。
- 共享证据必须以不可变 snapshot 引用和摘要传递。`PARTIAL/BLOCKED/UNAVAILABLE` 必须列出缺口，不能输出 `READY`。
- `single` 只能包含一个部；`multi` 至少两个部，必须由军机处完成联审并携带 receipt。任一部、模型或 prompt 都不能把 `required` 降为 false。
- `PREVIEW` 永远不得获得 `ALLOW_EXECUTE`。`EXTERNAL_WRITE` 与 `IRREVERSIBLE` 在执行前必须有真实 `ConfirmationReceipt`，且 receipt 绑定当前 preview digest。
- `BLOCKED/FAILED` 必须拒绝工具；`DEGRADED/BLOCKED/FAILED` 必须携带稳定 reason code。不得把 fallback、异常吞噬或缺失证据改写成成功。
- 最终工具决策是 RuntimeSkill allowed services、根 authority projection、tenant policy、tool registry、kill switch、side-effect class 与人工确认的交集；任一缺失或拒绝即 `DENY`。

## 接口边界

所有 `*_ref` 都只是索引。未来 Runtime adapter 必须重新加载权威对象，并验证：共享 tenant/owner/run；联审参与部门和报告输入；证据 status/adopted/missing；authority capability；工具 policy、精确 tool IDs、decision 和由 registry 推导的 side-effect class；WorkProduct ID/version/content digest 与 ConfirmationReceipt。任一对象缺失或语义不相等即 `DENY/BLOCKED`。

本阶段不修改 Runtime、不注册新 capability、不创建新的 evidence/authority/tool registry，也不声明真实 Shadow、Canary 或生产验证。
