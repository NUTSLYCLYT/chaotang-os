# 部门真实引擎 · 融合总账

> 生成 2026-07-07。范围:`feat/lipu-deterministic-vet` 分支上礼部/钦天监/吏部一轮引擎建设 +
> 融合决策 + 诚实天花板 + 剩余缺口。真相源是 `src/real_department_engines.py` 的三张注册表;
> 本文档是可回看的快照,过期以代码为准。

## 一、什么是"真实引擎"(先分清两条通路)

蜂群调用有两条独立通路,别混:

- **L4 执行路由**(`decree_swarm_router`):下旨自由文本 → 关键词命中 21 个蜂群之一 → 跑 FlowEngine。
- **会审真实引擎**(`REAL_ENGINE_ADAPTERS`):把"蜂群 + 确定性门"包成 court_doc 供会审。**只有 7 个司有。**
  - L3 丞相会审:`_MINISTER_CODE_DEPT[minister_code] → 部门` → 该大臣发言标 `ENGINE_BACKED`。
  - L4 上书房:`_SWARM_ID_DEPT[SWARM_DEFS 的 sid] → 部门`。
  - **engine-backed 部门应两路都登记**;key 必须是真实命名空间(死键会"看着接了实际不触发",见教训②)。

## 二、7 个真实引擎 · 可达性 + 诚实类型

| 司 | 引擎文件 | L3 code | L4 sid | 判定类型(诚实) |
|---|---|---|---|---|
| 兵部 | `bingbu_battlecard` | bing_bu ✓ | bingbu_strategy_swarm ✓ | 战情卡(跑 flow_haolong,LLM+) |
| 锦衣卫 | `jinyiwei_agent`+`jinyiwei_vet` | jin_yi_wei ✓ | jinyiwei_intel_swarm ✓ | **确定性**情报可信度分级(一手/二手/未证实) |
| 刑部 | `xingbu_verdict` | xing_bu ✓ | xingbu_legal_risk_swarm ✓ | 法务风险 findings→判决 |
| 户部 | `quotation_verdict`+`hubu_memorial_verdict` | hu_bu ✓ | hubu_finance_swarm ✓ | **确定性**数字勾稽/现金流(number_provenance) |
| 礼部 | `lipu_vet` | li_bu_rites ✓ | libu_communication_swarm ✓ | **确定性**反幻觉·硬声明素材回链 |
| 钦天监 | `tianjian_verdict` | qin_tian_jian ✓ | —(参谋蜂群,故意仅 L3) | 情景推演+Polymarket 真实市场,依据过 jinyiwei_vet |
| 吏部 | `libu_vet`+`libu_appointment_vet` | li_bu ✓ | libu_org_execution_swarm ✓ | 双身份(下详) |

> 可达性审计当前**全绿**(`test_swarm_id_dept_keys_are_real_sids` 结构守卫锁定,永久防死键)。

## 三、礼部 / 吏部 展开(本轮重点)

### 礼部(3 子蜂群,同一把反幻觉门)
- **出版**(flow_lipu)、**品牌战略**(flow_brand_strategy)→ 都过 `lipu_vet` 素材回链门(复用,不造新引擎)。
- **合规审核司**(`lipu_compliance_report`,三源聚合):`lipu_vet` 硬闸 + `lipu_review` LLM 软意见 +
  `xhs_monitor` 舆情软意见,同工部"质量司四闸合一"模式。
- 判定:硬声明(数字/百分比/《认证》)必须回链素材;绝对化用语(全球第一…)一律 red;凭空认证 red。

### 吏部(双身份 · 一套任免逻辑两个客户)
- **招聘**(`libu_vet`):决策锚定**复用** `recruit_check`(淘汰挂红线/录用锚 R-xx)+ 资质红线接
  `config/libu_safety_qualifications.yaml` 真清单 + `hire_outcome` 飞轮命中率背书。
- **任免**(`libu_appointment_vet`):责任图红线(无 owner→red、高权限缺人类 owner→red、自审/无替补→yellow)
  + agent 分席**复用** `persona_registry`(判官/观点席)+ `persona_eval.promotion_gate`(硬棘轮)。
- 分派器 `adapt_libu_personnel`:任免优先(纯确定性),否则招聘。

## 四、诚实天花板(别把"接了"当"到位")

| 引擎 | 天花板 | 升级路径 |
|---|---|---|
| 礼部 `lipu_vet` | 子串匹配的**脆确定性**:同义改写数字("九成以上"vs"≥90%")会漏判成待核 | 数值抽取+语义比对 |
| 吏部招聘飞轮 | **油箱是空的**:`eval/hire_outcome.jsonl` 无真实录用结局,命中率现示"未加真数据" | 回写真实入职/留存/绩效 |
| 吏部任免·自审 | "reviewer 是否真=owner 同一人"确定性判不了,靠关键词 | 需人工/结构化角色表 |
| 吏部任免·升席 | `persona_eval` 真打分需 LLM 网关,**离线永驳**(没料可验不给权威) | 配网关跑 persona golden |
| 钦天监 | 依据可信度靠 jinyiwei_vet 分级,非形式化验证 | — |

## 五、剩余缺口(T2:引擎已建但**不硬融**)

| 司 | 引擎 | 为何不接 |
|---|---|---|
| 工部 | `gongbu_review_verdict` | 需 `presale_output`+`task_input` 两输入;自由文本硬接=逼造 presale |
| 御史 | `yushi_verdict` | 需 System B 结构化 payload |
| 户部第二条 | `hubu_cashflow` | 需 FinanceEvidencePack 结构化包 |

> 硬接 = 逼系统编数据凑接口,违 `dept_constitution.md` C6(禁假 PASS)。要接须先设计结构化入口,单独立项。

## 六、本轮提交(⚠️ 标注作者)

| commit | 作者 | 内容 |
|---|---|---|
| cc85dbc | 本会话 | 礼部 lipu_vet 引擎 + 接入 |
| 06ac772 | 本会话 | **修礼部死键** + 补 L3 + 钦天监接入 |
| 55e3916 / d8308bb / 0d0b9b5 | 本会话 | 吏部招聘→融合 recruit_check/飞轮→双身份任免+资质清单 |
| 9a9a89b / d0efe52 | **并行 worker** | 品牌战略蜂群 / 合规审核司 |
| 701dcb1 | 本会话(⚠️污染) | 品牌战略复用 lipu_vet;**误卷入 worker 的 compliance 改动**(见教训③) |

## 七、教训(沉淀,防复发)

1. **仓内已有别重造**:吏部初版 `libu_vet` 自造 presence 门,而 `recruit_check` 更强且已在 truth_ledger。会审后改为复用。
2. **死键伪装成已完成**:`_SWARM_ID_DEPT["lipu"]` 曾是死键(真实 sid 是 `libu_communication_swarm`),单测测的正是死键→假绿。已加结构守卫。
3. **共享索引会污染提交**:并行 worker `git add` 的文件被无 pathspec 的 `git commit` 卷走。**纪律:一律 `git commit -- <明确文件>`。**

## 八、下一步候选

- 给飞轮/persona_eval 补真实数据(让"接了"变"转起来")——需真实业务数据,非编造。
- T2 结构化入口立项(工部/御史)——需求驱动,不为齐平硬做。
- 礼部 `lipu_vet` 脆确定性升级(数值抽取+语义比对)——高杠杆,全院反幻觉受益。
- 给刑部/兵部补第二个"司"(真值门)——目前是单司,确定性最弱一环。

## 九、六部评分(2026-07-07 评估,确定性挡门强度为主)

> 口径:`quality_baseline` 的 7–9 分是 LLM 评委给蜂群输出质量打的分,**不等于确定性强度**。
> 本表按"确定性挡门"为主评(系统立身之本),baseline 仅辅助。为主观评估,附口径,非官方指标。

| 部 | 分 | 确定性类型 | 主要扣分 |
|---|---|---|---|
| 户部 | 9.0 | 真值·数字勾稽(number_provenance) | C7毛利率仍LLM自评非重算 |
| 工部 | 8.5 | 真值·电气重算(全院唯一确定性重算) | review需双输入,未接自由文本会审 |
| 礼部 | 7.5 | 反幻觉·素材回链 | 脆确定性(子串匹配,同义改写漏判) |
| 吏部 | 7.0 | 决策锚定+责任图+分席 | 飞轮油箱空,升席离线永驳 |
| 刑部 | 6.5 | 中·findings→判决 | 依赖LLM抽findings,单司,无真值重算 |
| 兵部 | 6.0 | 弱·LLM战情卡 | 7引擎中确定性最弱,无真值门 |

三梯队:①真值门 户/工 ②反幻觉/锚定 礼/吏(新接待喂真数据) ③弱确定性 刑/兵(下一步补真值门)。
**兵部确定性与其业务重要性最不匹配**(销售一线却最弱门)。

## 十、部—司—蜂群全景 + 回奏能力

> 回奏=经会审出 court_doc 真判决。★=有代码司,○=概念司。**工部能力最强却不能自由文本回奏**
> (引擎需 presale+task 双输入),只能结构化回奏——是本盘最反直觉的一处。

| 部 | 回奏 | 旗下司(★有码) | 融合蜂群(实际接线) | 优 / 缺 |
|---|---|---|---|---|
| 户部 | ✓ | ★报价/现金流/付款/奏报/真数据入库 | finance,quotation,ima | 优:真值勾稽+真数据管道 / 缺:C7自评,cashflow需结构化 |
| 工部 | △仅结构化 | ★质量司四闸/选型重算/成本校验/代码审查 | sdlc,sourcing,pack_rd,battery_stage_gate | 优:确定性最硬+四闸模板 / 缺:会审入口缺席 |
| 礼部 | ✓ | ★出版/品牌战略/合规审核/内容运营 | xiaohongshu,opc,haolong,ima(三司共用lipu_vet门) | 优:反幻觉+三司同门不重造 / 缺:脆确定性,兜底离线不可用 |
| 吏部 | ✓ | ★招聘司/任免司 | 复用recruit_check/hire_outcome/persona_registry/eval | 优:双身份(管人+管agent) / 缺:飞轮空,升席离线永驳 |
| 刑部 | ✓ | ★判决司(单司) | legal,ai_ops,sdlc,gongbu_review,shiguan_archive | 优:findings→判决链全 / 缺:靠LLM抽findings,单司薄 |
| 兵部 | ✓ | ★战情卡(单司) | haolong(已融),opc,quotation(共享),storage_aftercare | 优:获客→报价→售后全链 / 缺:确定性最弱,无真值门 |

跨部共享蜂群(非冗余):ima=户/吏/礼共用;quotation=户拥有+兵复用;gongbu_review/sdlc/shiguan_archive=工↔刑/兵↔刑治理协同;haolong/opc=礼↔兵。

司颗粒度:礼(4司)/工(4闸)/吏(2司)已成"司"体系;刑/兵仍单司——**补司重点在刑/兵**。

## 十一、里程碑更新(2026-07-07 补刑/兵第二司,六部确定性门全上膛)

补齐上一节点名的刑/兵单司短板,两部各补第二个"司"(真值门):

- **兵部·战情真值门**(`bingbu_battlecard._determinism_items`,复用 `scripts/haolong_check.py`):
  C1 线索评分算术自洽(ΣN×M%≈综合评分,算错→red,同户部数字勾稽)、C3 客户真实性(回链真实
  成交记录,抓"称新客户实为复购"的臆造)。兵部从"包了court_doc的LLM"升到有真值门。评分 6.0→约7.5。
- **刑部·合同红线门**(`src/xingbu_contract_vet.py` + `config/xingbu_contract_redlines.yaml`):
  合同抽违约金%/账期天数/一票条款,回链红线清单。**三档 status**:placeholder(只yellow)/
  **expert_default(当前,已上膛能red,带"专家默认·法务可调"标注)**/confirmed(法务作准)。
  默认值由 richard-posner(合同法经济)+bruce-schneier(边界)出,锚定民法典§585+行业惯例,
  非法律意见、可覆盖。评分 6.5→约7.5。

**结果:六部确定性门全部"上膛"**(工部仍仅结构化回奏)。挡门覆盖:户(数字)/工(电气重算)/
礼(反幻觉)/吏(资质+责任+分席)/兵(算术+客户真实性)/刑(合同红线)。

**现场演示**:`python scripts/demo_dept_gates.py` —— 离线跑各门抓真实坏例子(编造认证/评分算错/
臆造客户/漏资质/越权授权/合同红线),一屏看清"这套系统有什么用"。当前 9 红 2 黄。

**"专家默认→用户覆盖"闭环**:刑部红线改 `config/xingbu_contract_redlines.yaml`(改数字+翻
status: confirmed)即成贵司作准值,不用碰代码。这套模式(专家出v1、config可覆盖、标注免责边界)
可推广到其他需要业务/法律参数的门。

诚实天花板(新增):兵部C3需真实成交记录库撑(库空走UNKNOWN不误判);刑部抽取是"锚词±窗口"启发式,
确认后仍建议人工复核;expert_default的red带"法务可调"标注,别当已确认法律结论。
