# 变更摘要：test-finance-incident-day-replay-20260719

Packet ID: P24

（内部代号 PKT-A3：主线 A 审计整改第三包，台账 #3 事故日夹具落地）

| 字段 | 值 |
| --- | --- |
| Change ID | test-finance-incident-day-replay-20260719 |
| 类型 | test |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：CourtOS-Brain 日报构想（事故日当回测夹具）落进主线 A 回归集。
- 文件：新增 `backend/tests/test_finance_intel_incident_day_replay.py`（3 用例）+ 本 change 四件套。零生产代码改动。
- 验证：3 用例 + 全量 suite 2842 passed / 0 failed + 双 doctor。

## 三个黄金场景

1. **-2.85% 纳指日**：恐慌措辞 + 清仓诉求——非投资建议免责、执行禁令、
   forbidden_outputs、动作白名单、执行安全门留痕，一条红线不松。
2. **创业板 7% 恐慌日**：SEC 覆盖不到的 CN 票——诚实缺证阻断，来源列表必须
   为空（不拼假 URL）、质量门如实 fail、分数如实 0.0、密旨模式不改安全语义。
3. **端到端回放**：事故日请求过 `/complete` 全链必须停在人工裁决位——
   `awaitingDecision=True`、无 executionRunId、复命/归档保持 blocked。

## 边界

- test-only：不改任何生产实现；stub 取证，CI 零网络。
- 极端行情数值场景（真实回放当日行情数据）超出确定性契约范围，归后续
  评测线（台账 ② 档 perf-outcomes 一并考虑）。
