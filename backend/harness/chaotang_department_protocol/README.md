# 朝堂部门协同协议 Harness

目标：让每个部门独当一面，同时用同一套输出契约融为一体。

核心原则：

- 每个部门有明确职责、输入、输出、下一站。
- 所有部门输出都必须能转成统一 payload。
- 每个部门输出必须带丞相下一步和钦天监触发器。
- 高风险输出自动进入御史总判。
- 可复用结论必须归档史馆。
- 六部可调用蜂群，但不替代蜂群执行；六部负责判断该调谁、成功标准和门禁。
- 部门不互相抢权：钦天监定方向，工部做实现，户部看收益，吏部定责任，礼部管表达，兵部管销售/售后，刑部管风险，御史定门禁，史馆沉淀学习。

## 运行

```bash
python harness/chaotang_department_protocol/scripts/run_protocol.py
```

输出：

- `harness/chaotang_department_protocol/artifacts/latest.json`
- `harness/chaotang_department_protocol/artifacts/latest.md`
- `harness/chaotang_department_protocol/artifacts/ledger.jsonl`

默认 `run_protocol.py` 会检查两类可执行 golden cases：

- `golden_cases/department_outputs.json`：部门输出 payload 是否符合统一契约，并能进入御史总判。
- `golden_cases/department_routes.json`：任务文本是否能正确派给六部、候选蜂群、丞相下一步和钦天监触发器。

`golden_cases/frontend_second_brain_distillation.json` 由 manifest 登记的
`tests/test_frontend_second_brain_distillation.py` 消费：P4c/P6 从退役前端引擎蒸馏的 case
会驱动后端 evidence audit、critic、conflict、synthesize 与 quality gate，验证缺证、角色混同
和证据不相关场景 fail-closed。它不由 `run_protocol.py` 静默加载，也不复制旧前端完整中文
句子或关键词实现；schema 位于 `contracts/frontend_second_brain_distillation.schema.json`。

## 统一输出契约

每个部门输出都必须包含：

- `run_id`
- `department`
- `output_type`
- `summary`
- `evidence`
- `benefit_score`
- `automation_level_requested`
- `next_action`
- `prime_minister_next_step`
- `qintianjian_trigger`

建议包含：

- `owner`
- `confidence`
- `assumptions`
- `changed_paths`
- `security_status`
- `finding_summary`
- `human_signoff`
- `qintianjian_brief`

## 六部和大神设计

六部定义在 `departments.yaml` 的 `six_ministries` 中：

- 工部：工程实现、POC、测试、研发交付。
- 户部：ROI、报价、预算、成本和收益真实性。
- 吏部：owner、权限、绩效、责任归属。
- 礼部：对外表达、客户话术、品牌一致性。
- 兵部：销售、售后、客户战情、真实结果回填。
- 刑部：法务、合规、安全、红蓝对抗和事故制度。

每个六部必须包含：

- `calls_swarms`
- `advisor_lenses`
- `genius_design`
- `function_upgrades`
- `harness_gate`

## 当前接入

当前 harness 把部门输出送入御史总判，得到风险等级、自动化权限和下一站；同时验证派单 route cases，确保丞相调度和钦天监触发器没有漂移。
