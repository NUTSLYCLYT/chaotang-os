# 翰林院设计 ·「借调即真相 · 用过才入库 · 自萎缩武库」（5 大神一致）

> 2026-06-25 由翰林院会审（Karpathy/张小龙/Bezos/Andrew Ng/Munger 完全收敛）沉淀。
> 翰林院 = skill 武库/炼 skill 工房:侦查→孵化→交付。最大死法不是 skill 太少,是装了一墙没人借的 skill + 一套自我感动的科举奖金榜。

## 0. 一句话
翰林院 = 朝堂唯一的 **skill 供应链 + 使用账本**：把"侦查到的新工具→孵化成能用的 skill→被六部按需借调"做成可追踪流水线，**武库只收录"真被借调用过且被采纳过"的 skill，其余一律留在门外**——库靠借调流水自己保持精瘦，不靠人去判断哪个 skill 有用。

## 1. 招牌：借调即真相（Checkout-as-SSOT），一张表两个门
整座翰林院只围一个原子事件转：`borrow(skillId, 部code, taskId)` —— 一个部从武库借走一个 skill 去干一件真活。这一条事件同时是：① 飞轮燃料（被借=有用）② 入库/退库判据（借调数=货架租金）③ Andrew Ng 评测的 ground truth（借调后那件部任务过没过质门）④ 侦查优先级信号（哪类缺口被反复借→去 github 找同类）。
- **SSOT 注册表 `skill_registry`**（id/name/version/origin[scout|forge|video]/status[candidate→incubating→armory→retired]/capability_tags/used_count/adopted_count/last_used_at）——**全朝唯一真相源**，github-hot-radar/penpot 已"入住"并进这张表，禁各部私有副本（铁律2）。
- **append-only `skill_usage_ledger`**（skill_id, caller=部门码[SSOT枚举], loop_id, ts, outcome[adopted|discarded|failed], sourceLabel）。
- **唯一借调入口 `useSkill(capabilityTag, loopId)`**：六部按 capability_tag 查 registry（**禁硬编 skill 路径**），每次调用写一条 ledger。整座翰林院页面从 ledger 渲染，不从 mock。

## 2. 侦查→孵化→交付（需求拉动，不是热度推送）
- **侦查（防噪音洪流）**：github-hot-radar 每天吸新工具，但只写进 `scout_candidates` 隔离区，**绝不直进 registry**。过滤器不是"热度/star"，是**"是否命中 ledger 里某部借调留下的未满足 capability_tag gap"**（demand-pulled，99% 自动丢弃）。主页一天最多浮 3 条候选。
- **孵化（skill-creator/learn-video）**：只有被认领痛点的候选才允许孵化；交付物硬性两件——SKILL.md + **一条可跑评测**（没评测的 skill 不算 skill，只算收藏夹链接）。视频走 learn-video-to-skill（采证→学习→炼→评测→入史）。
- **交付（评测门=入库门）**：incubating→armory 必须先通过"一条真实 Loop 任务"——真实输入跑一次、产出被采纳（adopted）才允许 status=armory。给六部自动借调是**准产线供给决策、不可逆→升库必过人工门**。

## 3. 防 skill 堆砌（三条硬规则，不靠自觉）
1. **入库门槛=认领痛点**：没有"哪个司缺它"就进不来，从源头堵住"看着酷就收"。
2. **用过才入库**：used_count=0 不允许 status=armory（库里永远没有"装了没人用"的死库存）。
3. **留存门槛=借调回执**：90 天零借调自动下架（归档不删，可复活）。
- **评测=借调后的事后兑现**（Andrew Ng + 只采纳态反写）：skill 真有用=**借它的那些决策里被用户采纳的比例**，而非自评分、非 star、非入库数。**绝不让 LLM 给 skill 打"有用分"（那是 agent 判 agent）**。
- **该砍的第一刀**：现 mock 里的科举/奖励层（谷雨榜/状元/榜眼/rewardPool）——"先建奖台后找数据"的典型 bloat，零真实使用营收前按铁律5 **冻结，只标位不建**。

## 4. 去 mock + 第一条真实数据
- **好消息**：scouting 已是真的（`scouting/_github.ts` 真调 GitHub API）。重灾区是 `hanlin-home-mock.ts` 喂的 contributions/awards/rankings（科举榜全假）。
- **第一条真实数据=六部借调**（已存在：咨询引擎 3/6 部已真 agent=户/刑/工）：把 `useSkill(capabilityTag, loopId)` 焊进这三部调用点，下次刑部 Legal Agent 借"三层摘要模板"就写下第一条 ledger 行。
- **诚实空态**：hanlin-home 改读 ledger/registry，空时显"尚无借调记录·等待六部第一次借调"，**绝不用谷雨榜假数据冒充 LIVE**。`hanlin-home-mock.ts` 不删、降级为 `?demo=1` 铺图骨架。
- **只采纳态反写**：ledger outcome=adopted 才回填 registry 的 adopted_count（杠杆在记不在做）。

## 5. 三方边界（造能力/用能力/卖组合）
- **翰林院** = 造与管**原子 skill**：registry SSOT、版本、侦查孵化交付淘汰。不执行业务、不碰真实产线、产出"可借调的带评测 skill"。
- **六部** = **用能力**：在真实工位 `useSkill` 借原子工具干真活（产线/不可逆转 jiqun:8081）；只借不藏不私有。
- **太子** = **卖组合/复制工作流**：把多个翰林院 skill+步骤串成可复制可裂变的 SOP；消费翰林院原子 skill 但不下沉造单个 skill。
> 一句话：翰林院出"零件"（原子 skill，SSOT 单源）、六部"用零件"干活、太子"把零件组成产品"去复制卖钱。三者间是 **import 关系不是 copy 关系**（铁律2）。

## 6. 本轮已落地（grounded，纯函数零副作用）
- `src/core/courtos/hanlin/skill-ledger.ts`：借调账本核心原语——registry/ledger 类型 + `adoptedRate` + `canPromoteToArmory`（用过才入库）+ `shouldRetire`（90 天零借调退役）+ `validateBorrow`（caller∈部门 SSOT、skillId∈registry，否则 fail-fast 不静默回退，铁律2）。
- `skill-ledger.nodetest.ts`：回归断言（used_count=0 不得入库 / 90 天零借调退役 / 借调方非 SSOT 部门码即拒）。
- **不碰**：hanlin-home 页面（去 mock 接 ledger 待六部 useSkill 焊点 + 真借调数据，阶段2）；DB 表 + useSkill 焊进六部待数据拉动。

## 7. 顶级风险
1. **ledger 的 adopted 信号被污染**（若 adopted 由启发式/LLM 自动判=agent 判 agent，武库被"自评好用、实际没人留"的 skill 灌满，比纯 mock 更危险）→ adopted 只能由 Loop 主库 tasks 真实采纳事件按 loop_id 反写；钉断言"未经真实采纳事件不得 adopted_count++"。
2. **先建奖台后找数据**（科举奖金榜在零真实使用时上线=拿 mock 繁荣骗自己，发了钱难撤=单向门）→ 先让一个司真借一次、产生一条回执，再谈榜单和钱；激励长在真实使用流水上。
3. **侦查变 star 洪流**（按 star>500 盲扫=推，灌满候选）→ 改 demand-gated：只回答某部已挂出的缺口 ticket，无 ticket 的热门 repo 进不了候选。
