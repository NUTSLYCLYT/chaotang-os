# 后端 Harness 架构

日期：2026-07-09

后端 harness 是朝堂 OS 后端的可靠性层，覆盖蜂群流程、业务闭环、安全红队、资源治理、质量闸门和可审计归档。它不替代业务代码，而是在高风险输出进入客户、运营、预算、安全决策或归档前，回答一个问题：

> 这次流程是否产生了可追溯、可复验、可回滚判断的结果；如果没有，阻塞点在哪里、归谁处理、下一步是什么。

## 当前结构

```text
harness/
  README.md
  manifest.json
  _shared/
    README.md
    contracts/base.schema.json
    gates/README.md
    observability/README.md
  changes/
    <change-id>/
  chaotang-commercial-loop/
  chaotang-true-loop/
  deep-research-skill-distillation/
  hubu-investment-swarm-gate/
  chaotang_business_model/
  chaotang_department_protocol/
  chaotang_merit_system/
  chaotang_uiux_system/
  jinyiwei-scrapling-poc/
  legal-redteam/
  open_source_watch/
  resource_consolidation/
  swarm-tool-matrix/
  yushi_global_gate/
```

`manifest.json` 是后端 harness 的唯一清单。`scripts/harness_doctor.py` 会读取这份清单，检查主 harness、实现包、命名映射、共享约定和变更记录是否完整。

## 主 Harness

| Harness | 职责 |
| --- | --- |
| `chaotang-commercial-loop` | 商机闭环确定性评测，检查部门块、数字归因、追溯和人工签字闸。 |
| `chaotang-true-loop` | 真实闭环契约，验证目标、证据、状态和复盘记录是否闭合。 |
| `deep-research-skill-distillation` | 检查来源包、学习包、技能蒸馏、黄金样例和 outcome ledger 是否闭合。 |
| `hubu-investment-swarm-gate` | 阻断缺证据、个性化或确定性投资建议，并保留人工复核闸。 |
| `chaotang_business_model` | 商业模式假设、客户价值、收入路径和风险证据检查。 |
| `chaotang_department_protocol` | 部门协议与路由检查，保证输入、输出、owner、证据和下一步一致。 |
| `chaotang_merit_system` | 功劳系统和贡献记录检查，避免奖励与证据脱钩。 |
| `chaotang_uiux_system` | 体验契约评测，为后端输出提供可复验的呈现标准。 |
| `jinyiwei-scrapling-poc` | 锦衣卫采集观察 POC 的主文档入口。 |
| `legal-redteam` | 法务红队用例和 promptfoo 配置入口。 |
| `open_source_watch` | 开源项目观察、安全工具安装和候选仓库评分。 |
| `resource_consolidation` | 资源归并分类，识别哪些路径应沉淀、忽略或拆分。 |
| `swarm-tool-matrix` | 蜂群工具矩阵，评估工具候选和部门适配关系。 |
| `yushi_global_gate` | 御史全局闸门，统一处理漂移、证据、风险和发布判断。 |

## 实现包与命名映射

部分目录是实现包，不单独作为主 harness 发布：

- `chaotang_department_personas`：部门人格与职责样本运行器。
- `chaotang_ui_user_skills`：体验技能覆盖检查运行器。
- `gongbu_review`：工部评审 golden case 数据。
- `jinyiwei_scrapling_poc`：`jinyiwei-scrapling-poc` 的 Python 实现包。
- `legal_redteam`：`legal-redteam` 的 Python 实现包。

横线命名目录保留给人读文档和 CLI 入口，蛇形命名目录保留给 Python import。两者的关系必须写入 `manifest.json`，不能靠口头约定。

## 标准契约

每个主 harness 至少需要：

- `README.md`：说明职责、输入、输出、闸门和验证命令。
- 可执行入口或配置：例如 `scripts/`、`golden_cases/`、`contracts/`、`cases.json`、`promptfooconfig.yaml`。
- 测试或验证命令：写入 `manifest.json` 的 `tests` 字段。
- 失败可追溯：输出中保留 case id、owner、证据、阻塞原因和下一步。

`_shared/contracts/base.schema.json` 定义公共记录形状。具体 harness 可以继续使用自己的 schema，但字段语义不能与共享契约冲突。

## 闸门规则

高风险流程默认按以下规则收口：

- 必需块必须输出有效记录。
- 关键数字必须有来源或明确标成假设。
- 不可逆动作必须保留人工签字闸。
- 运行时错误、模型错误、空输出不能伪装成业务结论。
- 低样本或高影响判断必须标记为 advisory、blocked 或 abstain。
- 每次失败都应能沉淀为 golden candidate 或修复任务。

## 验证命令

本地架构检查：

```bash
cd backend
python scripts/harness_doctor.py
```

代表性行为检查：

```bash
cd backend
python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py
```

根级工程检查会委托后端 doctor：

```bash
node scripts/harness-doctor.mjs
```

真实模型、高成本或会写入运行账本的命令，需要先确认 provider、预算、超时和输出路径。

研究类 JavaScript evaluator 只把本次运行报告写入各自的 `artifacts/`
（目录内容被忽略）；已审核的参考结果固定在 `baselines/`，运行验证不会污染工作树。
