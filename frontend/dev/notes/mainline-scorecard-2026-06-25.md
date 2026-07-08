# 朝堂主线（主闭环）逐站记分卡（8 大神读码 · 2026-06-25）

> 只评主线：`上书房收口→丞相拟旨→缺证检查→军机处会审→闸层→用户裁决→史馆归档→召回旧案`。基于真实运行态。
> **主线 42 分 · 端到端真转约 3.5 成**：机械接线跑通（一个问题能从上书房一路走到史馆召回，这条骨架是真接线非纯 mock），但作为「**会复利的 AI 决策操作系统**」只真转约 3 成。

## 8 站记分
| 站 | 分 | 真转 | 判词 |
|---|---|---|---|
| S6 用户裁决 | **60** | 6成 | 相对最实：5裁决态全接线+真持久化(任务不丢)，但强门不在活路径、仅 adopt 入史丢负样本 |
| S8 召回旧案 | 54 | 6成 | 召回检索本体真转(纯函数+租户隔离断言)，但复利飞轮开环(召回未验证预测=自投毒)、源标不降级 MIXED |
| S4 军机处会审 | 52 | 3.5成 | **全链最实**：确定性聚合护栏+3/6真agent；但六部单源平喂**独立性=0**(蜂群涌现是纸面)、真agent路只挂 demo、部清单2套SSOT |
| S2 丞相拟旨 | 50 | 4成 | 真LLM改写真转，但拟旨纪律三必填(steelman/recusal/回测账)**production零调用方=孤儿**、源标硬编码LIVE、契约3套SSOT |
| S7 史馆归档 | 44 | 4成 | 持久化/租户隔离(C3已修)/合成过滤真转，但 **outcome 回灌彻底开环**(无列无caller,真实结果永久NULL) |
| S1 入口/上书房收口 | 40 | 3成 | 采集/写库/源标诚实真转，但**分诊路由器=0**(核心智能缺席)、前门身份可伪造(C1)、单源毒种从此起跳 |
| S5 闸层 | 35 | 2成 | **可绕过+孤儿**：主线出口门 yushitai **warn-only 不阻断**，三道硬闸(门下/钦天/御史)零调用方，真阻断只在 court-pipeline 次路 |
| **S3 缺证检查** | **24** | 1.5成 | **单站最低·橡皮图章**：透传自报、传[]必绿、丞相零探测，缺证侦测倒置到下游，evidenceSummary 不下传→系统性假缺证 |

## 四道命门（按死活排序，三个是跨站结构性）
1. **🔴 C1 身份可伪造·整盒地基·硬天花板**：alg:none 可伪造+decode-only 不验签未修，是 S1/S5/S6/S7/S8 全部 owner/租户/人工门的**共同地基**。身份一伪造，租户隔离、史馆桶、人工确认门整堵墙被击穿。**盒子 NOT deliverable 直到 C1 闭**——再多功能都站在沙地上。
2. **🔴 主线两道闸都没装在门上（S3+S5）**：「验」(S3 缺证橡皮图章,传[]必绿) 和「挡」(S5 出口门 warn-only) 是安全网两根承重梁，**恰恰都失活**：红灯/缺证/源标冒充 LIVE 的脏决策畅通无阻穿过整条链入史。最严的三道硬闸写得最好却零调用方=孤儿死码。
3. **🔴 复利核心命题断裂（S7+S8）**：outcome 回灌彻底开环(recordOutcome 零 caller、打在另一张表、court_archives 无 outcome 列)。「会复利的决策 OS」**这一立身命题不成立**——召回的是自己过去未验证的 judgment，飞轮复的是预测不是兑现=**自我确认/RAG 自投毒**。没有这条，朝堂只是「会自我确认的检索器」。
4. **最实的工程不在主干（S4+S2）**：真agent六部会审(含金量最高)只挂 demo 页；拟旨纪律三必填有 nodetest 全过却 production 零调用方——**CI 在认真守护永不执行的死码**，造好的东西不在主干，写好的纪律不在门上。

## 让主线真跑通的关键路径（按死活+依赖）
- **P0 闭 C1**（无依赖·最高优先·封顶项）：后端验签或转后端，禁 alg:none/decode-only 放行特权写入。不闭则一切修复无地基、box NOT deliverable。
- **P1 堵出口门**（单点最高杠杆）：decision/route 的 saveCourtArchive 改读 yushitai.passed，非 passed/红灯/源标冒充→拒归档；court_archives 写入第一行焊 assertGatePassed(让孤儿御史闸真承重)。断言「红灯 verdict 调 archive 必抛」「脏决策零入史」。**一刀堵住整条链最危险的 garbage-in**。
- **P2 接 outcome 回灌真闭环**（复利根）：court_archives 加 outcome/fulfilled_at 列，recordOutcome 真接本表 + 真 UI 触发(裁决卡『事后应验/证伪』)。先答『第一条真实兑现数据从哪来』(铁律5)，召回侧加『优先已证实/排除已证伪』。无此则复利是假命题。
- **P3 S3 缺证升真 gate**：写 detectEvidenceGaps 主动探测(复用六部 required-evidence 表抽 SSOT)，传[]不再必绿；evidenceSummary 真下传六部断假缺证。
- **P4 S6 收口单门+负样本入史**：删活路 inline 弱门统一调 assertDecisionArchiveAllowed；reject/recheck/followup 也归档(带 negative 极性)喂回 S8。
- **P5 S4 破单源+部清单 SSOT 合一**：真agent部清单收敛单表(删 justice vs legal 分叉)；六部按各维度切差异化 evidence 子集，输出 disagreementCount，断言『含相反 signal 时 disagreement>0』。
- **P6 S2 拟旨纪律接活门**：refineIntent 后插 validateMandate 三必填硬校验(缺 steelman 必拒)，refineSourceLabel 经 reality-state.merge 上浮(删 `?? 'LIVE'`)，契约 3 套留 1。
- **P7 S1 建 incoming-problem 分诊台**：可逆/产线/类目三轴确定性预分流，touchesProductionAsset=true 入口转后端 jiqun(铁律9)；真agent会审接主上书房真实 UI。

## 到满分路线（Phase）
- **Phase 0 地基**：闭 C1→身份不可伪造，安全 15 分全链回血，box 可交付。所有 owner/租户/人工门修复的前置。
- **Phase 1 堵漏**（脏数据进不来出不去）：S5 warn→block + assertGatePassed 焊 archive() 第一行 + S3 升真探测 + S6 收口单强门。判据：红灯/缺证/源标冒充零入史，每步一条 CI 断言。
- **Phase 2 接真复利**（兑现立身命题）：S7 outcome 列+真 UI 触发；负样本入史；S8 召回优先已证实、排除已证伪、源标降 MIXED。先跑通一条『决策→兑现』真数据再谈规模。
- **Phase 3 真独立会审+搬上主干**：S4 部清单 SSOT 合一+差异化输入(disagreement 可量化)+真agent会审接主 UI；S2 三必填+recusal 接活路径。
- **Phase 4 入口智能**：S1 分诊台按铁律9 入口分流。
- **横向贯穿**：消灭 SSOT 分叉(拟旨3→1/部清单2→1/blast-radius 3→1)；高危改动过铁律4 双门；删孤儿死码(validateMandate/menxiaGate/assessRuin/assertGatePassed 要么接活门要么删)。

## 一句话
朝堂主线机械接线已跑通，但作为「会复利的 AI 决策操作系统」**端到端真转只约 3.5 成**——四道命门按死活：① 身份可伪造(C1·封顶硬伤)② 出口闸 warn-only+缺证橡皮图章(脏决策穿链入史)③ outcome 回灌彻底开环(飞轮复的是未验证预测=自投毒)④ 最实的真agent会审还只挂 demo、拟旨纪律守死码。**修复顺序铁定：先闭 C1→堵出口门→接 outcome 回灌，主线才从「能演示」升级为「能复利」。**
