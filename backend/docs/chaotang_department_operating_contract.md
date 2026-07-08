# 朝堂部门协同契约

目标：每个部门独当一面，但所有部门用同一套输出契约接入御史总判、史馆归档和下一站路由。

## 统一输出字段

必填：

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

建议：

- `owner`
- `confidence`
- `assumptions`
- `changed_paths`
- `security_status`
- `finding_summary`
- `human_signoff`
- `qintianjian_brief`

## 丞相 x 钦天监下一步协议

所有部门对话必须把“建议”升级为“可执行下一步”。格式如下：

- `next_action`: 本部门建议立刻做什么。
- `prime_minister_next_step`: 丞相统筹字段，必须包含 `owner`、`route`、`due`、`blocker`。
- `qintianjian_trigger`: 钦天监触发字段，必须包含 `signal`、`threshold`、`watch_window`、`decision_change`。

丞相的作用是把多部门意见压成一条主线：谁负责、交给谁、何时交、什么会阻断。钦天监的作用是让每个下一步都有预测触发器：什么信号出现时，当前判断必须改变。

示例：

```json
{
  "next_action": "交工部实现发布观测门禁。",
  "prime_minister_next_step": {
    "owner": "gongbu",
    "route": "yushi",
    "due": "before_release_candidate",
    "blocker": "没有红黄绿门禁不得上线"
  },
  "qintianjian_trigger": {
    "signal": "release_gate_light",
    "threshold": "green",
    "watch_window": "每次发布前",
    "decision_change": "非 green 则退回整改"
  }
}
```

## 部门分工

| 部门 | 独立职责 | 统一接入 |
|---|---|---|
| 钦天监 | 方向、预测、主线价值、重大事项 | 输出 `mainline_decision`，高风险进入御史 |
| 工部 | 实现、POC、工具、测试 | 输出 `implementation` / `dependency_security` |
| 户部 | ROI、预算、报价、收益真实性 | 输出 `roi_analysis` / `quotation` |
| 吏部 | 人员、角色、权限、绩效、任免、责任归属 | 输出 `personnel_assignment` / `permission_review` |
| 兵部 | 销售、售后、客户战情、竞争攻防、现场推进 | 输出 `sales_battlecard` / `aftercare_case` |
| 锦衣卫 | 外部信号、开源、竞品、风险情报 | 输出 `open_source_signal` / `risk_intel` |
| 御史 | 风险、收益、证据、自动化权限 | 输出 `global_gate` 判决卡 |
| 史馆 | 归档、复盘、学习样本 | 输出 `archive` / `learning_record` |
| 礼部 | 对外表达、客户话术、品牌一致性 | 输出 `customer_message` |
| 刑部 | 高危、红蓝对抗、事故、制度 | 输出 `red_team_case` / `policy_control` |

## 六部如何调用蜂群

| 六部 | 定义 | 主要调用蜂群 | 完成什么工作 | 默认交付 |
|---|---|---|---|---|
| 工部 | 工程建设、产品实现、研发交付和技术验收 | `sdlc`、`gongbu_review`、`product`、`sourcing`、`pack_rd`、`battery_stage_gate` | 需求拆解、架构、代码、测试、工程 POC、研发 stage gate | 可运行实现、测试证据、工程验收意见 |
| 户部 | 钱、预算、ROI、报价、成本和收益真实性 | `finance`、`quotation`、`product`、`ima` | ROI、现金流、预算、成本、报价、商业模式和数字证据 | 报价/预算/ROI 判定卡 |
| 吏部 | 人员、角色、权限、绩效、任免和责任归属 | `court`、`ai_ops`、`ima` | owner 分配、权限复核、功绩记录、职责冲突识别 | 负责人/权限/绩效责任图 |
| 礼部 | 对外表达、品牌、客户话术、内容发布和关系礼仪 | `xiaohongshu`、`opc`、`haolong`、`ima` | 客户话术、公开内容、品牌一致性、发布边界 | 对外消息、内容计划、禁用话术 |
| 兵部 | 销售、售后、客户战情、竞争攻防和现场问题推进 | `haolong`、`opc`、`quotation`、`storage_aftercare`、`shiguan_archive` | 获客跟进、客户澄清、方案攻防、售后诊断、真实结果回填 | 销售战卡、售后处置卡、客户结果 |
| 刑部 | 法务、合规、安全、红蓝对抗、事故和制度惩戒 | `legal`、`ai_ops`、`sdlc`、`gongbu_review`、`shiguan_archive` | 合同合规、安全扫描、事故复盘、红队测试、豁免条件 | 风险阻断/豁免/制度控制 |

调用规则：

1. 六部不直接替代蜂群执行；六部负责判断“该调哪个蜂群、为什么调、成功标准是什么”。
2. 蜂群完成后必须回填统一 payload，再进御史总判和史馆归档。
3. 兵部负责销售和售后，但报价数字归户部复核，对外话术归礼部复核，高危承诺归刑部/御史阻断。
4. 钦天监给每次跨部门调用补触发器：什么客户反馈、成本变化、质量失败或生产事件会改变当前决策。

## 顶级大神天才设计规则

大神视角不是替代部门执行，而是给部门增加高质量审查镜片。每个六部至少绑定两个 advisor lenses：

| 六部 | Advisor lenses | 天才设计 | 功能升级 |
|---|---|---|---|
| 工部 | Karpathy + Deming | 最小可运行系统先行 | 测试、观测事件、回滚、regression |
| 户部 | Bezos + Deming | 从客户长期需求和真实成本反推报价 | 证据化 ROI、敏感性、成交/流失回填 |
| 吏部 | Deming + Bezos | 用责任图和权限边界稳定分派 | owner、reviewer、approval path、功绩归档 |
| 礼部 | 张小龙 + Bezos | 克制、真实、用完即走的对外表达 | 证据、边界、禁用动作、客户下一步 |
| 兵部 | Bezos + 张小龙 | 从客户真实摩擦反向工作 | 销售战卡、售后回填、golden case 审批 |
| 刑部 | Deming + Karpathy | 最小复现失败样本暴露系统风险 | red/black 复现、修复、豁免、regression |

统一规则：

1. 大神建议必须能转成 `next_action`、蜂群调用、harness gate 或史馆归档项。
2. 大神建议不绕过御史；涉及客户、资金、生产、权限、合规时仍需证据和签字。
3. 每条 genius design 必须包含用户价值、系统收益、禁止动作和可验证信号。
4. 真实客户结果、售后结果、生产事件会回钦天监，改变下一轮部门建议。

## 实用闭环铁律

这套铁律适用于所有部门。目标不是让每个部门说得更华丽，而是让每次输出都能被老板裁决、被御史审查、被史馆复用。

统一规则：

1. 先判断真实目标和 P0 缺口，再给方案。
2. 每条建议必须落成 `next_action`、`owner`、`evidence`、`risk_gate` 或 `archive_record`。
3. 能用确定性规则、表格、计算器或 harness 校验的内容，不交给 LLM 自由发挥。
4. 没有 `sourceLabel` / `evidence` 的结论只能标为 `needs_evidence`，不得包装成已验证事实。
5. 涉及资金、客户承诺、生产、权限、合规、删除或对外发布，必须进入御史或人工确认门。
6. 部门只给可审预览和裁决建议，不直接自动付款、交易、签约、发生产或删数据。
7. 所有真实结果、失败样本和客户反馈必须回史馆，变成下一轮可复用经验。
8. 每轮只推进一个最小可验证闭环，不用概念堆叠代替交付。

老板可读输出必须收口成：

- 一句话结论
- 证据与来源
- 缺口与风险
- 老板可选动作
- 禁止自动执行项
- 下一步 owner
- 归档/复盘入口

部门落地方式：

| 部门 | 实用化重点 | 禁止漂移 |
|---|---|---|
| 工部 | 可运行最小版本、测试、观测、回滚 | 不用大重构掩盖 P0 没跑通 |
| 户部 | 真实数据、sourceLabel、预算/现金/投资证据 | 不用口述数据生成确定性财务结论 |
| 吏部 | owner、reviewer、权限、审批路径 | 不让高权限动作无人负责 |
| 礼部 | 可信表达、边界、客户下一步 | 不夸大 ROI、交期、能力或安全承诺 |
| 兵部 | 客户真实摩擦、售后结果、成交/流失回填 | 不无签字承诺价格、交期或效果 |
| 刑部 | 最小复现、影响面、阻断线、豁免条件 | 不绕过御史处理 red/black 风险 |

API 落点：

`/api/chaotang/department-system` 返回：

- `practicalOperatingDoctrine`: 全局实用闭环铁律。
- `dashboardSummary.operatingDoctrine`: 六部调度总览可直接展示的规则。
- `routingPlaybook[].operatingDoctrine`: 每个六部调用卡继承同一套规则。

## 统一工作流

```text
部门输出
-> 部门协同协议校验
-> 御史总判
-> 下一站路由
-> 史馆 ledger
-> 规则/golden case 更新
```

## 全院回奏流水线

所有“我要看当前状况 / 给我综合判断 / 汇总各司报告”类任务，统一走全院回奏流水线：

```text
用户下旨
-> 丞相拟旨
-> 军机处派单
-> 各司提交报告和附件
-> 部门整理标准回奏
-> 军机处审核证据、冲突和红线
-> 丞相综合分析并给建议
-> 递交用户：综合回奏 + 附件下载
```

职责边界：

- 各司只产事实、证据、附件、专业判断和下一步，不写最终圣裁。
- 部门负责把各司材料压成七段回奏：圣裁、分奏、证据、风险、后令、质门、来源。
- 军机处负责审核证据、冲突、红线、缺口和人工签字要求。
- 丞相负责综合排序和给用户建议，不得改写部门原始红灯。
- 用户首屏只看当前结论、丞相建议、今日要办、风险红线和附件下载。

详细契约见 `docs/chaotang_memorial_pipeline_contract.md`，机器可读规则见
`harness/chaotang_department_protocol/departments.yaml` 的 `memorial_pipeline`。

## 日常提交入口

系统规则读取：

```bash
curl /api/chaotang/department-system
```

该接口返回六部定义、可调用蜂群、大神 advisor lenses、genius design、function upgrades、harness gate 和统一 payload 必填字段，供朝堂前端、部门对话和发布前审查读取。

其中新增的前端/对话可直接消费字段：

- `dashboardSummary`: 六部调度总览，包含派单接口、protocol harness、ready 数量和下一步操作。
- `routingPlaybook`: 每个六部一张调用卡，包含 `firstSwarm`、`callsSwarms`、`primaryOutputType`、`advisorLenses`、`geniusDesign`、`harnessGate` 和 `nextActionTemplate`。

派单建议：

```bash
curl -X POST /api/chaotang/department-system/route \
  -H "Content-Type: application/json" \
  -d '{"task":"客户售后故障升级，需要销售跟进并沉淀真实反馈"}'
```

该接口只返回建议六部、候选蜂群、下一步、丞相字段、钦天监触发器和御史门禁提示，不会直接执行蜂群。

派单规则由 `src/chaotang_department_router.py` 统一维护，golden cases 位于 `harness/chaotang_department_protocol/golden_cases/department_routes.json`。

文本输出：

```bash
python scripts/chaotang_department_submit.py \
  --department 工部 \
  --summary "归档内部任务结果，证据完整。" \
  --evidence "unit-test=ok"
```

安全 POC 输出：

```bash
python scripts/chaotang_department_submit.py \
  --security-poc-report harness/open_source_watch/artifacts/security_poc_latest.json
```

提交脚本会先把部门输出转成统一 payload，再调用部门协同协议和御史总判。

## 自动提交开关

真实 flow / orchestrator 完成后可以自动进入部门协同协议：

```bash
CHAOTANG_DEPARTMENT_AUTOSUBMIT=1 python scripts/run_flow.py config/flow_sdlc.yaml "任务文本"
```

当前接入点：

- `scripts/run_flow.py`
- `src/chaotang_orchestrator.py`

自动提交默认关闭。开启后若协议提交失败，只记录告警，不阻断原业务流程。

## 关键设计

部门可以有自己的专业模型、工具和流程，但最后必须交出统一 payload。

这样系统有两个好处：

1. 部门独立：每个部门拥有自己的判断权和输出类型。
2. 系统一体：御史、史馆、钦天监能读懂所有部门输出，形成统一闭环。
3. 下一步可控：丞相负责统筹，钦天监负责触发器，所有部门对话都能进入同一个路由和门禁。
