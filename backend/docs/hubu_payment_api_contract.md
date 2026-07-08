# Hubu Payment API Contract

本文件目的: 让前端按稳定字段接入户部付款 P0 链路, 不猜按钮、不猜状态、不误触发真实付款。

范围: P0。仅覆盖付款事实包预览、老板裁决预览、史馆草稿展示。

非目标:
- 不执行真实付款。
- 不写数据库。
- 不真正归档史馆。
- 不触发真实蜂群运行。
- 不替代后续正式决策提交接口。

## 1. P0 链路

```text
付款事实包
-> POST /api/chaotang/hubu/payment/preview
-> 户部会计/审计、出纳、预算、奏折结论
-> decisionActions 渲染老板按钮
-> archiveDraft 展示史馆草稿
-> POST /api/chaotang/hubu/payment/decision/preview
-> 校验老板选择动作
-> decisionReceipt 裁决收据草稿
```

所有接口都必须返回:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

失败时仍使用统一信封:

```json
{
  "success": false,
  "data": null,
  "error": "错误原因"
}
```

## 2. Payment Preview

Endpoint:

```text
POST /api/chaotang/hubu/payment/preview
```

用途: 输入付款事实包, 返回户部预览结论。此接口无副作用。

请求最小结构:

```json
{
  "caseId": "hubu-payment-demo-001",
  "title": "自动化设备尾款付款裁决",
  "decisionType": "payment",
  "knownFacts": ["账务已平", "预算内", "凭证齐全"],
  "accounting": {
    "period": "2026-06",
    "balance_sheet": {
      "资产总计": 1000000,
      "负债合计": 400000,
      "所有者权益": 600000
    },
    "income_statement": {
      "营业收入": 800000,
      "营业成本": 520000,
      "净利润": 120000
    },
    "sources": {
      "balance_sheet.资产总计": {
        "sourceLabel": "internal_uploaded_file",
        "ref": "monthly-close-2026-06.xlsx"
      }
    }
  },
  "treasury": {
    "as_of": "2026-06-21T20:00:00+08:00",
    "cash_balance": 20000,
    "bank_balance": 500000,
    "reserved_cash": 50000,
    "sources": {
      "bank_balance": {
        "sourceLabel": "internal_uploaded_file",
        "ref": "bank-export-20260621.xlsx"
      }
    }
  },
  "budget": {
    "budget_id": "budget-equipment-2026",
    "budget_amount": 500000,
    "actual_used": 260000,
    "committed_amount": 60000,
    "sources": {
      "budget_amount": {
        "sourceLabel": "internal_uploaded_file",
        "ref": "budget-2026.xlsx"
      }
    }
  },
  "paymentRequest": {
    "payee": "深圳设备供应商A",
    "amount": 90000,
    "purpose": "自动化设备尾款",
    "evidence": {
      "contract": "contract-equipment-001.pdf",
      "invoice": "invoice-equipment-001.pdf",
      "budget": "budget-line-equipment-2026",
      "approval": "purchase-approval-001"
    }
  }
}
```

前端必须使用的响应字段:

```json
{
  "previewOnly": true,
  "executionAllowed": false,
  "sideEffects": "none",
  "caseId": "hubu-payment-demo-001",
  "decision": {
    "recommendation": "approve",
    "riskLevel": "low",
    "missingEvidence": [],
    "riskGates": [],
    "nextActions": ["可进入老板批准。"]
  },
  "decisionActions": {
    "primaryAction": "approve",
    "allowedActions": ["approve", "archive_preview", "save_draft"],
    "blockedActions": [],
    "requiresSecondConfirmation": false,
    "archiveEligible": true,
    "ownerHint": "boss",
    "buttonLabels": {
      "approve": "批准",
      "archive_preview": "存入史馆草稿",
      "save_draft": "保存草稿"
    }
  },
  "archiveDraft": {
    "archiveMode": "draft_only",
    "archiveEligible": true,
    "decisionStatus": "pending_boss_decision",
    "decisionResult": "approve",
    "sourceDepartment": "hubu",
    "agentCode": "hu_bu",
    "evidenceChain": [],
    "auditTrail": []
  }
}
```

## 3. Recommendation 状态表

| recommendation | 前端主按钮 | 是否可直接批准 | 是否二次确认 | 说明 |
|---|---|---:|---:|---|
| `approve` | `approve` / 批准 | 是 | 否 | 证据、资金、预算均通过 |
| `needs_confirmation` | `confirm_with_risk_gate` / 确认风险后批准 | 否 | 是 | 大额、接近预算上限、关联方等风险门 |
| `needs_evidence` | `return_for_evidence` / 退回补证 | 否 | 否 | 缺发票、合同、预算、来源等证据 |
| `blocked` | `block` / 阻断 | 否 | 否 | 金额非法、资金不足、账不平等阻断项 |
| `legal_review` | `return_for_legal_review` / 交刑部复核 | 否 | 否 | 合规或法务红线 |
| `council_review` | `return_for_council_review` / 交军机处再议 | 否 | 否 | 重大或跨部门事项 |
| `pause` | `save_draft` / 保存草稿 | 否 | 否 | 暂缓 |

前端规则:
- 只渲染 `decisionActions.allowedActions` 内的按钮。
- `blockedActions` 内的按钮不能展示成可点击主按钮。
- `requiresSecondConfirmation=true` 时必须展示风险确认 UI。
- 永远不要根据中文文案判断状态, 只根据枚举字段判断。

## 4. Boss Decision Preview

Endpoint:

```text
POST /api/chaotang/hubu/payment/decision/preview
```

用途: 校验老板选择的动作是否合法, 返回裁决收据草稿。此接口无副作用。

请求结构:

```json
{
  "factPack": {},
  "decisionInput": {
    "action": "approve",
    "decidedBy": "boss",
    "reason": "证据完整且预算内",
    "confirmedRiskGates": []
  }
}
```

字段说明:

| 字段 | 必填 | 说明 |
|---|---:|---|
| `factPack` | 是 | 与 payment preview 请求体相同 |
| `decisionInput.action` | 是 | 必须属于 preview 返回的 `allowedActions` |
| `decisionInput.decidedBy` | 是 | 裁决人标识, MVP 可用 `boss` |
| `decisionInput.reason` | 否 | 老板裁决理由 |
| `decisionInput.confirmedRiskGates` | 条件必填 | 当 `requiresSecondConfirmation=true` 时必须覆盖所有 `riskGates` |

成功响应关键字段:

```json
{
  "previewOnly": true,
  "executionAllowed": false,
  "sideEffects": "none",
  "decisionReceipt": {
    "receiptId": "hubu_decision_preview_xxx",
    "action": "approve",
    "actionLabel": "批准",
    "accepted": true,
    "decidedBy": "boss",
    "reason": "证据完整且预算内",
    "requiresSecondConfirmation": false,
    "confirmedRiskGates": [],
    "nextState": "approved_pending_archive"
  },
  "decision": {},
  "archiveDraft": {}
}
```

常见失败:

```json
{
  "success": false,
  "error": "当前户部结论不允许执行动作: approve"
}
```

```json
{
  "success": false,
  "error": "高风险确认门未确认: large_payment"
}
```

## 5. Frontend 接入顺序

1. 用户进入户部付款裁决页面。
2. 前端组装或读取付款事实包。
3. 调用 `/payment/preview`。
4. 根据 `decision.recommendation` 展示结论色:
   - `approve`: 低风险绿色/金色
   - `needs_confirmation`: 高风险朱红确认门
   - `needs_evidence`: 黄色待补证
   - `blocked`: 红色阻断
5. 根据 `decisionActions.allowedActions` 渲染按钮。
6. 展示 `archiveDraft.evidenceChain` 和 `archiveDraft.auditTrail`。
7. 用户点击按钮后调用 `/payment/decision/preview`。
8. 只展示 `decisionReceipt`, 不提示“已付款”或“已归档”。

## 6. 验收标准

- 前端不能出现“真实付款已执行”的文案。
- 前端不能在 `executionAllowed=false` 时调用任何付款执行接口。
- 前端只使用 `allowedActions` 渲染可点击按钮。
- 大额付款必须展示二次确认, 并传 `confirmedRiskGates`。
- 缺证状态下点击批准必须被后端拒绝。
- 史馆区域展示为“草稿”, 不展示为“已归档”。

## 7. 当前测试锚点

后端测试文件:

```text
tests/test_hubu_payment_preview_api.py
tests/test_hubu_e2e_fact_pack.py
tests/test_hubu_memorial.py
```

推荐验证:

```bash
.venv/bin/python -m pytest tests/test_hubu_payment_preview_api.py tests/test_hubu_e2e_fact_pack.py tests/test_hubu_memorial.py -q
.venv/bin/python scripts/validate_flows.py
.venv/bin/python scripts/validate_registry_sync.py
.venv/bin/python scripts/commit_closeout_check.py
```
