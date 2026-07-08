@AGENTS.md

# CLAUDE.md — Chaotang Harness Session Entry

> Keep this as a tiny session bootstrap. The durable operating system lives in `.harness/`.

## Required Startup

1. Read `AGENTS.md`.
2. Read `.harness/agents/frontend-owner.md`.
3. Read relevant rules in `.harness/rules/`.
4. Check `.harness/changes/` for active work.
5. Run `pnpm harness:doctor` when changing Harness docs/scripts.

## Harness Entrypoints

- Owner: `.harness/agents/frontend-owner.md`
- Rules: `.harness/rules/`
- Skills: `.harness/skills/`
- Wiki: `.harness/wiki/`
- Changes: `.harness/changes/`
- Usage guide: `docs/HARNESS-USAGE-GUIDE.md`
- Authoring guide: `docs/AUTHORING-GUIDE.md`

## Boundary

`chaotang-web-lyt` owns frontend pages, BFF adapters, browser validation, and release gates. Real swarm execution, prompts, providers, and backend DB truth belong to `jiqun_ai`.

## 工程铁律(2026-06-05 大神圆桌会审沉淀)

> **铁律 1 · 特权写入的守门人必须在写入那道门。**
> 任何直写数据库的特权 Route Handler(如 `/api/court/orchestrate/sign-off`、写台账/偏好/链的端点),
> 其鉴权与写入必须在同一道门完成。本仓硬约束 #1/#3 规定边缘与 Next 层 **decode-only、不验签、由后端
> JwtAuthGuard 兜底** —— 因此特权写入**不得**仅凭 decode-only 的 `isAdminAccount()` 放行后直写本地
> ledger(那等于守门人不在执行门口)。要么把该写入**转发经后端验签**,要么在约束内叠加 CSRF 同源校验 +
> 幂等(每决策恰好一次)+ 租户隔离。严禁把"鉴权由后端守"当作 Route Handler 直写 Turso 时的免责承诺。
> (注:严禁在 Next/边缘层引入 `jose.jwtVerify`/JWKS —— 违反硬约束 #1,见 `local-login/route.ts`。)

> **铁律 2 · 跨进程的领域枚举必须单一真相源(SSOT),禁静默回退。**
> 部门码/角色码等跨 swarm 码(`finance`)、prime-minister 码(`hu_bu`)、中文名(`户部`)三侧传递的枚举,
> 只能有一张映射表,各侧一律 `import` 它,禁止各自维护平行 map(否则任一表改名 → `boss_preferences`
> 写进永不匹配的孤儿边,飞轮计数器静默空转)。映射失败一律 fail-fast 或 `logger.warn`,严禁 `?? code` /
> `?? null` 静默回退 —— 静默回退会把数据漂移与投毒伪装成"成功",令审计无法区分"没写"与"写错"。
> 写偏好前须断言 `chosenDept ∈ edge`,不匹配即拒。

> **铁律 3 · 合并即清理(merge = resolve + simplify,不是 resolve only)。**(2026-06-06 沉淀)
> 解决合并冲突后,**禁止留下"编译通过但逻辑冗余"的中间态**——两套状态机/两条数据通路并存看似无害,
> 但下次有人改其中一套,另一套即成僵尸代码静默腐烂(Bezos:这是合并里最危险的中间态)。合并的收尾动作
> 必须是 resolve **再** simplify:把功能重复的旁路收敛到唯一通路,删除随之失活的死函数/死 state,
> 跑通类型双门(root `tsc` + `next build`)后才算合并完成。
> 判据:合并后 grep 同一意图是否存在两个实现(如 `suggestionToEdict` vs `suggestionToMemorial`、
> `edictOverride` vs `activeSuggestionMemorial`)——若有,留其一、删其余,严禁"暂时都留着"。
> 案例:`ShangshufangPage` 合并曾并存 `edictOverride` 与旧 `activeSuggestionMemorial/teachingId`
> 状态机,丞相要务走合成 Memorial 旁路;统一为「一台三路」单一 `edictOverride` 通路后净 -19 行(4d9a534)。

> **铁律 4 · 高危改动提交前过双门:独立会审 + 一条回归断言。**(2026-06-20 沉淀)
> 两类改动属"高危",提交前**强制**两道,缺一不得提交:
> (1) **写共享主表**——主库 `tasks` 及任何被 `briefing`/史馆/今日完成 KPI **不按 id 过滤**读取的表;
> (2) **给"决策/裁决"呈现加视觉权重**——放大/浮起/帝金环/徽章等让某结论更"像定论"的处理。
> 双门:
> (a) **独立会审**:开一个**不在你上下文里**的子 agent(`code-reviewer`/`expert-panel`)读真实 `git diff` 找盲点,
>     禁自审自夸——作者的自评在本仓已被证明会漏 CRITICAL;
> (b) **一条回归断言**:把"不该发生的事"钉成测试(如「学习记录写完 `tasks` 表零污染」「真高风险徽章为红」),
>     让 CI 每次替你复核,而非靠"按构造正确"的口头承诺(Deming:拿数据,不靠信)。
> 判据:`git diff` 命中 `upsertPrimaryTask`/`INTO tasks`/决策卡视觉属性(`boxShadow`/`blastRadius`/徽章)→
> 无"会审记录 + 新增/更新断言"即视为未完成。
> 案例:2026-06-20 上书房深修,自评通过的代码被会审抓出 CRITICAL(学习记录 `upsertPrimaryTask` 写主库,
> 被 briefing 当奏折读出污染朝报),且 commit 写了"无 UI 改动"——自信≠正确。护栏见 `store.nodetest.ts`。

> **铁律 5 · 版面预算:新能力先溶解回主 Loop 工位,溶不进才给版面,且先答"第一条真实数据从哪来"。**(2026-06-20 沉淀)
> 朝堂只允许存在**主闭环真正用到的版面**(上书房/军机处/史馆/六部/庄园)。任何新能力落地前按序自问:
> (1) 能不能**溶解进已有工位**?(风险判断→上书房裁决属性;复盘学习→史馆归档"事后兑现"回填弧)——能则**不新增版面**;
> (2) 溶不进、要给版面前,先回答:**它产出的第一条真实数据从哪来?** 答不出 = 空转飞轮,**冻结,别建**。
> "放到其他版面"常是"舍不得删"伪装成"做架构":多一个版面 = 多一处让用户迷路、稀释信号、日后维护的地方。
> 最好的 IA 决策往往是**没有新增任何版面**的那个。
> 案例:2026-06-20 会审判定"部门学习"不缺版面、缺结果——其家在史馆归档回填弧(结果源=旧案事后兑现),
> 而非上书房后台空转。决定:**冻结**骨架(C1 隔离成果留,见 `src/lib/department-learning/`),不建版面/不接 cron/停投入;
> 风险徽留在上书房作裁决属性、停扩 §8.7;主闭环真转起来、有第一条"归档→兑现"真实数据前,连这溶解都先只标位置不建。

> **铁律 6 · 部/司是地址簿,蜂群是工厂:一个领域一个 owner,产线一个出口。**(2026-06-29 大神会审沉淀)
> 部(领域·谁负责)、司(部内角色·谁干)是**组织静态维度**;蜂群(执行引擎·怎么干)是**运行动态维度**——
> 两个维度本不该重叠,重叠=有人把维度搞混了。SSOT:部=`contracts/agent.ts` 11码,司=各部 roster,蜂群=后端
> `swarm_orchestrator`。**(1) 一个领域一个 owner**:领域真算只在一处。pack_rd 成本真算=后端;户部读"财务视角"、
> 工部读"交付视角"——**读同一份后端结果,不各算一遍**(会审取证:成本曾同时在 `hubu/bom-cost`+`gongbu/battery-products`
> +后端 `pack_rd` 三处)。前端 `bom-cost`/`battery-products`=咨询底座(选型/查规格/展示),**禁重算 split**。
> **(2) 产线一个出口**:全前端只有 `live-swarm-adapter` 一个桥调后端蜂群,各部经 `decision-loop` 走它,**禁各部各自
> fetch 后端 swarm**(否则 N 套契约腐烂)。**(3) 司只做三件事**:咨询(纯函数·本地)+编排(调蜂群)+展示(view model),
> 产线全转后端(铁律9),不重造蜂群逻辑。**(4) 领域单 owner**:合规=刑部 `xingbu-lens`(他部调用不自建)、情报=锦衣卫
> (兵部调用不自采)。判据(铁律3延伸):grep 同一意图两处实现(`pack_rd`/`成本拆分`)→留后端一处,前端各视角"读"。
> 详见 `docs/部司蜂群-去重架构-SoT.md`。

> **铁律 7 · 分层启发式≠重复:收敛前先问"它在 live 路径可见吗"。**(2026-07-03 munger 会审沉淀)
> 铁律3/6"同一意图留一实现"只对 **live 路径真承重** 的代码成立。多个"看起来同意图"的启发式引擎
> (如同一奏折的部门意见:浅桩 → 深 office → 后端真 office 三层),若产出**只在 FALLBACK/降级路径可见**、
> live 成功即被覆盖,判"重复"前必须先测这三问:
> (1) 它们是否都在 live 成功路径产出可见结果? (2) 收敛需要新增多少适配/映射层?
> (3) 收益是否只落在用户看不见的降级态外观? 三问任一指向"否 / 一大坨 / 是",默认**不收敛**,
> 只在代码里补一句边界注释(防下个人误判"分层=重复 bug"),不强行合一。
> 判据:发现"看似 N 份重复实现"时,先花 5 分钟测这三问,再决定要不要花一次高危重构的成本
> ——省下的那次不必要重构,比任何一次重构都值钱(Munger:invert,先问"换了会怎样"而非"该不该换")。
> 案例:2026-07-03 阶段3 深挖"奠折产出者收敛",查出 3 个部门意见启发式引擎(A栈浅桩/A栈深office/C栈真office)
> 看似重复,实为分层 fallback——产出仅 FALLBACK 可见、C栈还盖不全部门,收敛需重且有损的整-memorial 适配器。
> 判高风险×低价值,不动产线码,只在 `registry.ts`/`offices.ts` 补边界注释。见
> `dev/notes/融合吸收-放弃-执行清单-2026-07-02.md` 阶段3 深挖记录。
