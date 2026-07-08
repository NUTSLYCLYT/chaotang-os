# 朝堂整改诏令 · 开发系统 / 御史审查系统 / 内阁三省六部协同

> 日期：2026-06-07
> 目标：不另起外部管理体系，沿用既有朝堂 OS 规则完成 agent、蜂群、部门、skills、真实客户模拟测试整改。

## 0. 总判

当前不是缺资源，而是资源没有被同一套验收链收束。

- 蜂群：`validate_flows.py` 当前红灯，14 个 baseline 蜂群中 5 个通过、9 个失败。
- 商业闭环：`commercial-loop` harness 自测通过，dry-run 3/3 过；`--review-board` 会随账本样本变化，目前仍缺生产样本、golden candidate 与首屏仪表盘。
- Web：`chaotang-web-lyt` 已完成 build 修复并在 3050 主线验证；发布前仍需跑最终 QA / 安全 / ship 门禁。
- 部门 agent：储能售后等专业 SOP 较好，三省六部很多 `AGENTS.md` 仍过薄。

整改原则：**内阁定方向，三省控流程，六部办实事，诸司补证据，御史查风险，史馆收结果，harness 定输赢。**

## 1. 内阁决议

### 北极星

7 天内把兵部负责的销售线与售后线打成可复现铁链路：

```text
销售线：
  客户线索
    -> 兵部销售战情快判（haolong / voice_sales）
    -> OPC 方案边界
    -> 工部产品/交付风险
    -> 户部报价假设
    -> 刑部/御史红线审查
    -> 人工签字
    -> 史馆归档
    -> golden case 反哺

售后线：
  客户报修 / 告警
    -> 兵部售后战情分诊（storage_aftercare）
    -> 数据采集 / BMS 诊断 / 现场失效分析
    -> 工部形成修复方案与工单
    -> 户部核备件与工时成本
    -> 刑部审安全、召回、客户承诺
    -> 人工签字
    -> 史馆归档为现场案例
```

### 停做清单

1. 暂停新增蜂群、页面和部门概念。
2. 暂停把三省六部当展示隐喻扩写文案。
3. 暂停用 dry-run 证明真实 agent 能力。
4. 暂停无来源报价、交期、安全承诺。

### 成功标准

- `npm run build` 持续通过，3050 主线页面可登录验证。
- `python scripts/validate_flows.py` 从 5/14 过线提升到至少 10/14。
- `score_rectification.py --web-build-status pass` 达到 65/100。
- 商业 golden cases 从 3 个扩到 20 个。
- 每次 real-run 都落 wide event、failure sample 或 business ledger。

## 2. 三省流程

### 中书省：起草整改案

输入：
- 质量 baseline
- commercial-loop review board
- Web build 结果
- 失败蜂群列表

输出：
- 本诏令
- 任务台账
- 各部验收标准

硬规则：
- 每个任务必须有 owner、证据、验收命令、史馆归档位置。
- 不得绕过门下省直接派发六部。

### 门下省：封驳与复核

复核点：
- 是否违背“先主链、后扩张”。
- 是否用 dry-run 冒充 real-run。
- 是否缺人工签字点。
- 是否没有证据来源。
- 是否把模型输出当确定事实。

封驳条件：
- 没有 harness 分。
- 没有验收命令。
- 涉及报价/交期/安全但无人工签字。
- 任务无归档出口。

### 尚书省：派发与汇总

派发格式：

```text
任务ID：
来源：
责任部：
协同部：
输入：
产出：
验收命令：
通过标准：
阻塞上报：
归档位置：
```

汇总必须包含：
- 已完成
- 未完成
- 红灯风险
- 下一轮 PDSA
- 史馆归档链接

## 3. 六部职责

### 工部：建设与修复

第一批任务：

| 任务ID | 任务 | 文件/对象 | 验收 |
|---|---|---|---|
| GB-001 | 修 Web build | `chaotang-web-lyt/src/app/(dashboard)/departments/[code]/page.tsx` | `npm run build` 通过 |
| GB-002 | 修 `haolong` 快判 | `flow_haolong.yaml` / prompts | `eval_ci.py --swarm haolong` >= 7 |
| GB-003 | 修 `opc` 快判 | `flow_opc.yaml` / prompts | `run_harness.py --real --fast --blocks opc` 通过 |
| GB-004 | 修 `quotation` 红线 | `flow_quotation.yaml` / prompts | 无单点报价，无未接地数字 |
| GB-005 | 改三省六部 SOP 模板 | `agent_design/buildAgent/三省六部体系/*/AGENTS.md` | 每部都有输入/输出/schema/签字/归档 |

工部不得自己宣布完成，必须交刑部/御史审查和史馆归档。

### 户部：预算与 ROI

职责：
- 判定整改优先级 ROI。
- 约束模型调用成本。
- 所有真实报价只能输出“报价假设”，不得直接对外承诺。

户部验收：
- 每个任务有成本估计：低 / 中 / 高。
- 每个任务有价值归因：release / quality / sales / safety / observability。

### 兵部：销售与售后战情

职责：
- 负责销售战情：线索、客户身份、需求澄清、OPC 边界、销售下一步。
- 负责售后战情：客户报修、告警分诊、紧急度、现场处置推进、客户沟通节奏。
- 维护两条主链：
  - 销售线：`haolong / voice_sales -> opc -> product -> quotation`。
  - 售后线：`storage_aftercare -> workorder -> customer_update -> archive`。
- 推进但不越权：报价归户部，产品/修复方案归工部，安全/召回/客户承诺归刑部与人工签字。
- 失败样本必须进入 failure sample；真实客户反馈必须进入 business ledger 或 golden candidate。

兵部验收：
- 每天至少一次销售线 dry-run。
- 每天至少一次售后线 dry-run 或 storage_aftercare baseline 检查。
- 至少一个销售 real fast 单步 run：`haolong` 或 `opc`。
- 至少一个售后样本检查：`storage_aftercare` baseline 或真实报修 dry-run。
- 输出必须包含：客户状态、下一步、禁止动作、需签字项、归档入口。

### 刑部：御史审查与风控

职责：
- 审报价、交期、安全、隐私、成本、权限。
- 对所有 fail-open 设计封驳。

一票否决：
- 未接地数字。
- 工具失败仍输出“已完成”。
- 模型错误被包装成业务建议。
- 人工签字触发缺失。

### 礼部：对外表达

职责：
- 把结果转成老板、销售、客户能懂的话。
- 保证“暂不承诺”的表达清楚，不伤客户信任。

礼部禁令：
- 不得为了好听弱化风险。
- 不得隐藏需要人工签字。

### 吏部：责任人与能力建设

职责：
- 每个整改任务绑定 owner。
- 记录哪个部门/agent 缺 SOP、缺测试、缺证据。

吏部验收：
- 无 owner 的任务不得进入执行。

## 4. 诸司职责

### 史馆

归档：
- 每次 harness 结果。
- 每次 real-run event。
- 每次 failure sample。
- 每次 golden candidate promote/reject。
- 每次人工签字结论。

史馆输出：
- 本轮 lesson。
- 下次 prompt / data / gate 修正建议。

### 锦衣卫

监控：
- provider/key 缺失。
- real-run timeout。
- 低分蜂群反复失败。
- 生产事件没有落 ledger。

### 钦天监

预测：
- 哪些低分蜂群最可能拖垮发布。
- 哪些任务修复后分数提升最大。

### 太医院

体检：
- 环境、依赖、端口、build artifact。
- `prod-doctor` 与 true-chain health。

### 翰林院

知识：
- 维护 20 个 golden cases。
- 每个 case 写 reference、must_not、human_signoff_triggers。

## 5. 御史审查系统

每轮整改后按此顺序审：

```text
工部自验
  -> 刑部/御史红线
  -> 门下省封驳
  -> 尚书省汇总
  -> 史馆归档
  -> 内阁复盘
```

御史审查清单：

| 项 | 通过标准 |
|---|---|
| 证据 | 每个判断有 source / timestamp / confidence |
| 数字 | 所有有意义数字可接地 |
| 人工签字 | 报价、交期、安全、外发必须触发 |
| 状态 | blocked / failed / passed 区分清楚 |
| 可观测 | 有 event / failure / run_id |
| 归档 | 有史馆记录或 golden candidate |

## 6. Harness 快分

新增脚本：

```bash
python harness/chaotang-commercial-loop/scripts/score_rectification.py --json
python harness/chaotang-commercial-loop/scripts/score_rectification.py --web-build-status fail
python harness/chaotang-commercial-loop/scripts/score_rectification.py --web-build-status pass --real-fast
```

100 分构成：

| 维度 | 分值 |
|---|---:|
| Release gate | 20 |
| Flow quality baseline | 25 |
| Commercial harness | 25 |
| Observability / learning | 15 |
| Governance maturity | 15 |

裁决：

| 分数 | 裁决 |
|---:|---|
| >= 85 | PROD |
| >= 70 | BETA |
| >= 55 | FIX_AND_RETEST |
| < 55 | STOP_EXPANSION |

## 7. 第一轮任务台账

| ID | 部门 | 任务 | 验收命令 | 通过标准 |
|---|---|---|---|---|
| CT-R1-001 | 工部 | 修 Web build 字段错误 | `npm run build` | pass |
| CT-R1-002 | 工部 + 兵部 | 修销售线 `opc` fast real-run | `run_harness.py --real --fast --blocks opc` | gate passed |
| CT-R1-003 | 工部 + 户部 | 修 `quotation` 禁止无依据报价 | `eval_ci.py --swarm quotation` | >= 7 |
| CT-R1-004 | 兵部 + 郝龙获客 | 修 `haolong` 客户澄清快判 | `eval_ci.py --swarm haolong` | >= 7 |
| CT-R1-005 | 翰林院 + 史馆 | 扩 golden cases 到 20 | `pytest -q tests/test_commercial_loop_harness.py` | pass |
| CT-R1-006 | 刑部/御史 | 加红线审查抽样 | `score_rectification.py --json` | no fail-open |
| CT-R1-007 | 锦衣卫 | 生产事件落账 | `run_harness.py --real --fast ... --events ... --failures ...` | nonempty events |
| CT-R1-008 | 兵部 + 工部 + 户部 + 刑部 | 售后线 `storage_aftercare` 复核：分诊、工单、备件成本、安全承诺 | `eval_ci.py --swarm storage_aftercare` | >= 7 且客户承诺需签字 |

## 8. 今日最低可交付

今天只交付三件事：

1. `score_rectification.py` 能跑出 100 分。
2. Web build 修到通过。
3. `opc` fast real-run 失败原因被记录成 failure sample 或通过 gate。

不做第四件，避免重新发散。

## 9. 归档规则

每轮结束由史馆追加：

```text
日期：
总分：
三省裁决：
完成任务：
失败任务：
新增 golden candidate：
新增 lesson：
下一轮 PDSA：
```

## 10. 大神视角

真正的朝堂不是角色越多越强，而是每个角色都减少一种失控：中书减少乱想，门下减少乱批，尚书减少乱派，工部减少乱改，户部减少乱花，刑部减少乱承诺，史馆减少乱忘。harness 是御史台的尺，不是装饰。
