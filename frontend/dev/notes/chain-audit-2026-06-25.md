# 朝堂全链条规则/逻辑/触发审计（5 大神读码体检 · 2026-06-25）

> 由 6 段链条审计(A入口/B丞相/C军机处/D闸层/E裁决记忆/F横切)收敛。审计 agent 真读了代码,非纸面。
> **一句话结论:规则设计世界级,但全链体检=「展厅级护栏 + 一道真锁(验签门)」——最硬的规则原语大多写在没人 import 的纯函数文件里,与真实运行路径并联且失活,纸面闭环在运行时大面积开环。**

## 0. 贯穿性系统病
- A 段宣称的 **7 路 AND 自治闸真实只有 (graduated,risk) 两输入**；
- B 段丞相**三必填/笔手闸/缺证探测在 /api/court/decision 零调用**（唯一引用是自己的 nodetest）；
- C 段「不让 agent 判 agent」守在聚合层却被**丞相 refinedIntent 单源喂进六张嘴**（correlation 奔 1）；
- D 段**门下/钦天/御史三道硬闸 production 调用方全为 0**，实际跑的 yushitai 是 **warn-only 不阻断**；
- E 段强归档门旁置、**史馆无 user_id 跨租户召回**、真实 outcome 永不回灌；
- F 段 SSOT 桥非结合合并会把 **DEMO 洗成 FALLBACK**、missing 静默坍缩成 FALLBACK。

> primitive 写得越精，失活时越致命——因为它制造了「已设防」的错觉，比没有护栏更危险。

## 1. 全链条规则触发总表（每段 规则/触发/漏洞）
| 段 | 现有规则 | 触发条件 | ⚠️ 最大漏洞 |
|---|---|---|---|
| **A 太子自治闸** | 总闸默认关；execModeFor(grant,risk)；shadow-label 盲审才 high/连续秒准≥5 告警/零误放才毕业 | execModeFor 只吃 (graduated,risk) 两输入 | 7 路 AND 门代码里无一处真 AND；canGraduateCluster 无代码写回 grant.graduated（**两套毕业真相**）；OOD 新实例无 runtime 指纹拦截即放行；ask 弃权无消费者；误放探测器未定义→「零误放」强度=0；路由器不存在 |
| **B 丞相拟旨+缺证** | classifyChancellorAction 笔手闸/validateMandate 三必填/applyRecusal 涉徒回避 | 设计声明「聚合器递交军机处前调用」；活路径 refineIntent 硬编码 LIVE | **三必填/笔手闸 production 零调用方（僵尸门）**；缺证靠调用方自报传[]即必绿；三套拟旨契约并存（违 SSOT）；forecast.byDate 无 cron 兑现 |
| **C 军机处会审** | selectMinistries 子串选部；Promise.all 并行；aggregateMinistryCards 机械聚合 | text.includes(keyword)；COURT_REAL_MINISTRY_AGENTS=0 回退 | **丞相 refinedIntent 注入六部 prompt→审「丞相 spin 版」非原始证据，correlation 奔1**；decision/route 不传 evidenceSummary→系统性假缺证；红蓝是单次 LLM 自演；runReal* 零 nodetest（违铁律4）；真实 UI 调 0/6 真路径 |
| **D 闸层** | menxiaGate/assessRuin/御史 assertGatePassed/人工门 L0-L4/验签 fail-closed | 门下/钦天/御史 production 调用方=0；实际跑 yushitai **warn-only 未阻断** | **三道硬闸未安装→违祖训不可绕过/触ruin一票否决全不生效**；archive warn-only 照写；验签只核身份不核授权（**confused deputy**）；CHAOTANG_ALLOW_INSECURE_AUTH=1 单 env 关唯一真闸无哨兵；blast-radius 三套口径；无顶层仲裁器 |
| **E 裁决+史馆+记忆** | 5裁决态；仅 adopt 入史馆；兑现双证据；boss-ledger 原子幂等 | action==='adopt' 归档；本地路由用弱门 | **court_archives 无 user_id→跨租户召回（A 案召回给 B，违铁律1，泄露+投毒，CRITICAL）**；FALLBACK/DEMO 非高危一键 adopt 入史馆；findSimilar 不按 synthetic/source 过滤→合成案漂白成「可引用旧案」；recordOutcome 零 caller→真实 outcome 永久 NULL；只 adopt 入库=丢负样本 |
| **F 横切** | reality-state worst-wins；产品面 worst-wins+三 assert；bridge 单点互转；censor+watchdog | normalize 未知→missing；watchdog 看心跳(90000s) | **mergeSourceLabels 非结合→DEMO 洗成 FALLBACK 穿墙**；bridge 把 missing/degraded 坍缩成 FALLBACK（违铁律2 静默回退在 SSOT 桥本身）；worstRealityState([])→'real' fail-open；gov_chk grep 在场≠在岗；censor 无完整性自校；watchdog 25h 盲窗 |

## 2. 整链优点（真落地的硬功夫）
1. **Fail-safe 方向全链一致且多层**：默认关/未知归 execute/空→最坏档/high-critical 绕过毕业/fail-closed 503/一次误放永禁毕业——错关>错放守住。
2. **确定性护栏真落地几处**：aggregateMinistryCards 机械聚合（可复算不漂移）、御史类型层物理隔离 agent 自评、menxia「印不是笔不是秤」type-lock、太子连续秒准当 corrigibility 告警。
3. **验签门是真闸**且有会咬人的回归断言，fail-closed 响亮失败不静默裸奔。
4. **御史进程外+独立 watchdog dead-man switch** 是教科书级 Schneier 设计。
5. **诚实降级在卡级到位**；兑现双证据+boss-ledger 条件原子幂等抗假签核提权。

## 3. 整链系统级缺点（说真话：最危险的不是"规则不够"，是"最好的规则系统性失活"）
1. **接线性失活·贯穿 A/B/D**：三段最关键硬闸写成纯函数却 production 零调用方——制造"已设防"错觉，比没护栏更危险。
2. **独立性是剧场化的·C/F**：六部被丞相 refinedIntent 同时喂（correlation 奔1）；红蓝是单 LLM 自演；源标 worst-wins 被非结合合并破坏。表面多重独立，实质同一上游的多个回声。
3. **出口门不阻断·D/E**：yushitai warn-only，archive 无条件照写——红灯/缺证/源标冒充照样进史馆被召回，污染复利。
4. **租户越界·E·CRITICAL**：court_archives 无 user_id，召回全表 LIKE 无隔离。信息泄露+决策投毒双险。
5. **Study 端永久开环·B/E**：outcome 永久 NULL，只 adopt 入库丢负样本=只会自我确认、越转越偏的飞轮（Deming：没有数据的闭环是信仰）。
6. **SSOT 名义存在实则分叉·全链**：毕业2套/拟旨3套/blast-radius 3口径/源标2真值表/记忆2台账，多处 ?? 静默兜底（违铁律2）。
7. **监察者无防篡改·F**：gov_chk grep 在场即过、watchdog 只证 liveness 不证 integrity——看门狗本身能被无声阉割。

## 4. 最该补的洞（排序）
1. **E·CRITICAL 跨租户召回**：court_archives 无 user_id，A 案召回给 B——先于一切修。
2. **A/B/D·CRITICAL 三大硬闸接线性失活**：7路AND/三必填/门下veto-钦天ruin-御史assert 全 production 零调用方。
3. **D·CRITICAL 出口门不阻断**：yushitai warn-only，archive 无条件照写。
4. **C·HIGH 会审独立性被丞相单源击穿** + 不传 evidenceSummary 假缺证 + runReal* 零 nodetest。
5. **F·HIGH 源标诚实被合并破坏**（DEMO 洗成 FALLBACK；missing 坍缩 FALLBACK）。
6. **E/B·HIGH Study 端永久开环**（outcome 永久 NULL，自我确认飞轮）。
7. **D·HIGH 验签门只核身份不核授权**（confused deputy）。
8. F·MED 监察者无防篡改；9. 全链·MED SSOT 分叉；10. A/C·MED 粗粒度放行+统计不足。

## 5. 升级路线图（按杠杆，一击解多洞优先）
1. **杠杆1·反孤儿 CI 硬门（一击解 A/B/D 接线性失活）**：build 断言——`core/courtos` 下任何 `validate*/classify*/Gate/assert*` 纯函数若 `src/app/**` 零 import → build 红。把"接线"变成不可跳过的硬门 + 防再次失活。配御史进程外脚本独立复算同一不变量。
2. **杠杆2·一条真复合咽喉 + 显式仲裁器**：`composeDGate(inputs)→{decision,bindingGateId}`，固定优先级 祖训veto>ruin veto>高危无签veto>御史block>needs_signoff>reback>pass，decision-loop 与所有特权写只调它一个；**史馆写入第一行 assertGatePassed，blockingIssues 非空→抛错不归档（改掉 warn-only）**。回归断言："刑部RED+源标冒充LIVE+触产线→史馆零写入+返回403"。
3. **杠杆3·堵租户越界（E·CRITICAL，独立可立即做）**：court_archives 加 user_id 列、saveCourtArchive 写归属、findSimilarCourtArchives 强制 `WHERE user_id=?` + `synthetic=0 AND source_label NOT IN(DEMO,FALLBACK)` + 召回统一降级 MIXED。回归断言：跨用户召回=0、合成案不进召回。
4. **杠杆4·切断丞相单源软操纵（C·P0）**：会审席双轨——给六部同时递 {原始问题raw, refinedIntent仅参考, evidenceSummary}，至少户/刑/工真部审原始证据；decision/route 立即传 evidenceSummary。配「安慰剂部」eval（refinedIntent 反写成乐观spin看六部是否变绿）钉成 CI+御史日跑。补 runReal* nodetest。
5. **杠杆5·让自治闸真 AND+真毕业（A）**：`canAutoReplicate(instance)→{auto,blockedBy[]}` 7 输入显式 AND，execModeFor 下游改调它；canGraduateCluster 成唯一毕业真相写回 grant.graduated，agreement 用 Wilson 95%下界+只认盲审；每毕业 cluster 存训练分布指纹/包络超包络强制 propose+打 ask；ask 接人工门升级队列。
6. **杠杆6·补 Study 端真闭环（B/E·治自我确认飞轮）**：forecast.byDate 写史馆待回测账，到期由钦天监/御史进程外脚本拉 reality-state 对账，打脸记录贴回旧案；recordOutcome 接真实回访 cron/UI；reject/recheck 入史馆标 negative 收负样本。**第一条真实「归档→兑现」数据前 outcome 一律显「未对账」禁 KPI 读它当真值。**
7. **杠杆7·SSOT 归一+静默回退清零（全链·铁律2/3）**：blast-radius 单一枚举（EvidenceLevel 保 L0-L4、BlastRadius 改 internal/external/irreversible 禁 L 前缀）；mergeSourceLabels 改基于组分集合（hasLive/hasFallback/hasDemo 三布尔位）保证任意排列恒等且含 DEMO 绝不产纯 FALLBACK；missing 不得坍缩 FALLBACK，新增 NO_DATA 标签；删冗余平行实现，?? 'MIXED'/?? code 改 fail-fast。
8. **杠杆8·监察者防篡改+授权核验（D/F 收尾）**：censor.sh 自身算 hash 存基线，watchdog 同校 hash+心跳；gov_chk 从 grep 升为真跑 nodetest 子集；验签门探针从打读端点 briefing 改为后端 authz `can?action=sign-off`；corrigibility 上可执行原语+御史哨兵盯其存在。

## 6. 一句话
朝堂规则设计世界级，但全链体检=「展厅级护栏 + 一道真锁」：三大硬闸写成没人 import 的纯函数、出口门 warn-only 照写、史馆无 user_id 跨租户召回、真实 outcome 永不回灌——纸面闭环运行时大面积开环。**下一步别加新功能，先做「反孤儿 CI 硬门 + 一条会咬人的归档拒绝断言」，让"接线"和"真阻断"变成不可跳过的硬门，再堵租户越界这条 CRITICAL。**
