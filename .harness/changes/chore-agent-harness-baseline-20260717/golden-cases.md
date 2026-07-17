# M0 黄金任务基线目录

本包不复制各 Harness 的事实样例；以下是冻结时的组合目录。M0 的最低目标是 50 个可审计样本，执行 M1 前必须由这些事实源展开并编号。

| 维度 | 最低数量 | 事实源 |
|---|---:|---|
| D0 简单事实/单 Agent | 8 | `backend/tests/fixtures/chancellor_golden_cases.py` |
| D1 单部门专业任务 | 10 | `backend/harness/chaotang_department_protocol/golden_cases/department_routes.json` |
| D2 合同/付款/不可逆 | 10 | `backend/harness/yushi_global_gate/golden_cases/global_gate_cases.json` |
| 六部真实引擎 | 8 | `backend/tests/test_real_department_engines.py` |
| 专署锦衣卫/钦天监 | 4 | `backend/src/jinyiwei_agent.py`、`backend/src/tianjian_verdict.py` |
| 职责外拒答/缺证 | 6 | `backend/tests/test_menxia_veto.py`、`backend/tests/test_chancellor_llm_recommendation.py` |
| 人工签字/冲突 | 4 | `backend/tests/test_yushi_verdict.py`、`backend/tests/test_qintianjian_lens.py` |
| **合计** | **50** | 以上事实源组合 |

每个样本必须有：输入、期望路由、期望风险、是否应拒答、最低证据、允许降级路径、验证命令和结果回执字段。
