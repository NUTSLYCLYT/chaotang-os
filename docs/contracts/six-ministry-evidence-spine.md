# 六部可信证据脊柱输入输出标准 v1

状态：Accepted for internal integration。契约文件：`docs/contracts/six-ministry-evidence-spine.schema.json`。

本契约遵守 ADR 0018、ADR 0027、ADR 0028、ADR 0029、ADR 0036 与 ADR 0037。它统一六部如何提交意图、如何接收机器可读裁决，但不得成为第二事实源，也不建立新的 Agent、Evidence/authority/tool registry 或业务入口。

## 1. 输入标准：调用方只交意图和有界材料引用

```json
{
  "schema_version": "1.0.0",
  "message_type": "decision_request",
  "request_id": "request:01",
  "objective": "核验本季度现金安全性并生成只读决策预览",
  "material_refs": [
    {
      "kind": "accounting_evaluation",
      "opaque_id": "accounting-evaluation:01",
      "expected_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "version": 1
    }
  ],
  "constraints": {
    "as_of": "2026-08-14T00:00:00Z",
    "output_language": "zh-CN"
  }
}
```

### 可输入

- `objective`：一段有长度上限的业务目标；
- `material_refs`：只接受枚举 kind、不透明 ID、期望摘要/版本。每个引用必须至少提供摘要或版本；
- `constraints.as_of`：可为空的 ISO 8601 时间；
- `constraints.output_language`：仅 `zh-CN|en-US`。

### 禁止输入

- owner、tenant、run/case/decree 身份；
- capability、部门、skill、路由和军机处状态；
- `verified`、`approved`、可信度、证据状态或结果状态；
- 权限、工具、provider、凭据、URL、文件路径、任意查询；
- audit refs、ConfirmationReceipt 或外部执行授权。

Capability、部门和 skill 由服务端从获批 `DecreeJob` route 与 RuntimeSkill registry 解析；owner 来自 `CurrentUser`。调用者给出的材料摘要/版本只是强校验条件，服务端必须重新加载 owner-scoped 对象。JSON Schema 为 closed：所有未声明字段均拒绝，不存在 metadata/extensions 逃生口。

## 2. 服务端装配顺序

1. 用 `CurrentUser` 装配 owner；当前 `scope_mode=owner_only` 且 `tenant_id=null`。
2. 从 ADR 0028 既有下旨链加载 `DecreeJob`，解析批准 capability、单/多部 route 与 decree/run。
3. 多部 route 从 ADR 0029 军机处案卷重载真实完成状态、参与部门和 receipt；缺失即 `JOINT_REVIEW_REQUIRED`。
4. 从 ADR 0036 RuntimeSkill registry 重载 skill、版本与定义摘要。
5. 按引用 kind 从既有 owner-scoped storage 重载材料并匹配摘要/版本；跨 owner 对象按不存在处理。
6. 复用 ADR 0018 Evidence Protocol 的冻结 EvidencePack/采用语义或既有专业权威源，生成只读领域 facts。
7. 形成专业裁决与动作处置；记录系统生成、脱敏、内容寻址的 Evidence/audit refs。
8. 最终再次断言外部副作用 `authorized=false`、`mode=none`、`effect_count=0`。

任一步骤失败都必须失败关闭，后续步骤不得用模型推断或默认值补成成功。

## 3. 输出标准：一个统一 decision envelope

输出的顶层字段固定为：

- `scope`、`identity`：服务端装配的 owner/run/case/decree 绑定；
- `routing`：来自 `DecreeJob` 的批准 route 和真实军机处会审状态；
- `runtime_binding`：RuntimeSkill ID、版本、定义摘要和 registry 来源；
- `evidence`：证据状态、投影模式、快照引用、时效与事实计数；
- `authority`：分析是否获准及其服务端权威绑定；
- `decision`：统一专业裁决；
- `evidence_refs`、`audit_refs`：不可变引用，不携凭据或原始私密正文；
- `errors`：稳定机器错误；
- `external_effects`：本阶段始终为 false/none/0。

### decision 标准

| 字段 | 标准 |
| --- | --- |
| `status` | `completed`：权威、必需证据和约束均满足；`degraded`：只能给有限结论；`failed`：不能给有效结论 |
| `action_disposition` | `preview`：只读预览；`hold`：等待补证/复核；`block`：禁止推进 |
| `summary` | 简洁结论，不得超越 adopted Evidence |
| `facts` | 结构化事实，每项绑定 Evidence refs；未解析值不得伪造 |
| `findings` | 专业发现、严重性、Evidence refs |
| `risks` | 风险、严重性、Evidence refs |
| `conflicts` | 未消解冲突及相关 Evidence refs |
| `missing_evidence` | requirement、稳定缺口原因和是否必需 |
| `next_actions` | 责任角色与仅补证/复核/只读重试等动作；不能夹带外部执行 |
| `artifact_refs` | report、WorkProduct preview 或 citation draft 的 ID、摘要和版本 |

专业结论与执行许可严格分离：`completed` 不等于可执行，本阶段只允许 `completed/preview`。`degraded` 必须 `hold|block`；`failed` 必须 `block`。外部副作用 `authorized=false` 是契约常量。

## 4. 错误标准

每个错误只含稳定 `code`、处理 `phase` 和 `retryable`，不返回内部异常、路径、SQL、凭据或第三方响应正文。

| Phase | 代表错误码 |
| --- | --- |
| request | `INVALID_REQUEST`、`MATERIAL_NOT_FOUND`、`MATERIAL_BINDING_MISMATCH` |
| identity | `IDENTITY_UNAVAILABLE`、`OWNER_SCOPE_MISMATCH` |
| routing | `ROUTE_UNAPPROVED`、`JOINT_REVIEW_REQUIRED` |
| runtime | `RUNTIME_SKILL_UNAVAILABLE` |
| evidence | `EVIDENCE_UNAVAILABLE`、`EVIDENCE_INCOMPLETE`、`EVIDENCE_CONFLICT`、`EVIDENCE_STALE` |
| authority | `AUTHORITY_UNAVAILABLE`、`AUTHORITY_DENIED` |
| audit | `AUDIT_WRITE_FAILED` |
| any terminal boundary | `INTERNAL_ERROR`，只作脱敏兜底且必须失败关闭 |

错误码含义在 schema v1 冻结。新增含义必须发布新版本；调用者不得从自由文本推断权限或重试策略。

## 5. 六部当前结果标准

- 户部真实 grounding：owner-scoped 会计评估成功重载、绑定和校验后可输出 `completed/preview`；付款仍只产生 WorkProduct preview。
- 礼部 citation draft：只可引用 adopted Evidence 生成 draft，绝不表示已经发布或事实已由礼部认证。
- 吏部缺少权威人员/岗位源：降级为 `degraded/hold`，列出 `EVIDENCE_UNAVAILABLE|AUTHORITY_UNAVAILABLE`。
- 刑部缺少权威合同/合规源：降级为 `degraded/hold`，不得把通用模型知识当法律事实。
- 工部缺少权威产品/交付/质量源：降级为 `degraded/hold`，不得把合成 fixture 当生产结果。
- 兵部缺少权威 CRM/销售源：降级为 `degraded/hold`，不得推断客户或商机状态。

## 6. 既有系统映射

- ADR 0018：Evidence Protocol、冻结 EvidencePack、明确采用与只读网络边界；
- ADR 0027：`CurrentUser` 与 owner isolation；
- ADR 0028：下旨唯一入口、司级补证、六部/军机处/丞相既有拓扑；
- ADR 0029：军机处 owner-scoped 案卷和真实跨部检查点；
- ADR 0036：46 个下游 RuntimeSkill 及共享 executor；
- ADR 0037：受控只读 Tool Use，模型 Tool Call 永远不是 authority；
- `WorkProduct` / `ConfirmationReceipt`：只承载预览与真实人工决定，不在本契约中升级为外部执行权。
