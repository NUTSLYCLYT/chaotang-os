> 2026-06-23 · workflow chaotang-10-roadmap(5 agent)产出。
> 总纲:从建造→证明,别建第七个部门。张小龙铁律:这周只做3件,其余7件等信号触发。

# 朝堂:从建造到证明 — 完整项目方案 + 验收标准 + 信号驱动执行序列

> 总工程师视角(Bezos × 张小龙)。四梯队已各自现场验真,本文合一、去重、排出可照做的执行序列。
> 所有路径/命令均已核验真实存在;每条验收可证伪(能客观判真假)。

---

## 1. 总纲:从「建造」到「证明」

**一句话:** 朝堂的六部骨架已建完,下一步不是建第七个部门,而是把已有的**用透 + 让数字可信 + 让"绿"是真绿**。

**三条主轴:**
- **真被用(Used):** 已接通的真链(吏部/刑部/工部)必须有人真下真需求、出帝金 `LIVE_SWARM`,并留下可复盘的被用证据 —— 接第 8 个部门之前,先证明第 7 个真有人用。
- **数字可信(Trusted numbers):** 凡出总额/分数/成本的地方,要么"数能算平(Σ分项==总额)",要么"诚实标缺证(灰/—)",杜绝假值填平、编造总额。
- **绿是真绿(Provably green):** CI 必须真跑在真平台、真拦真合并;"以为有门"比"没有门"更危险。

**三条红线(贯穿全程,违反即回退):**
- 不建新版面/新部门来"显得在做架构"(铁律 5 · 版面预算)。
- DEMO/FALLBACK 禁伪装 LIVE;无真实来源一律灰/—(诚实范式)。
- 写共享主表 / 给"决策呈现"加视觉权重 = 高危,提交前过双门(独立会审 + 一条回归断言,铁律 4)。

---

## 2. 信号驱动执行序列(最重要 · 张小龙铁律)

**这周只做 3 件**(零阻塞、能立刻产出信号的):
**① 用透吏部一周** · **② pack_rd 数字勾稽(拆两段)** · **③ 刑部接 1 行**。

**其余 7 件(④–⑩)一律等信号触发,不提前空转。** 提前建 = 没有"第一条真实数据"的飞轮空转。

### 触发图(做完 A 产生信号 S → 触发 B)

```
本周(无需触发,直接做):
  ① 用透吏部一周 ───────────► S1 = 周报 SUMMARY.md「最高频不可信」+ 5 个去重 traceId
  ② pack_rd 拆两段 ─────────► S2 = smoke_readiness.json 中 pack_rd total_score≥3.8 且 C1 PASS
  ③ 刑部接 1 行 ────────────► S3 = 刑部页帝金 LIVE_SWARM 法律意见可见 + 新真用记录入 department_review_runs

触发链(谁等谁 / 等什么信号):

  S1 ──► ②内部排序：吏部周报「最高频不可信」= 户部/product 下一个该修的,而非按 C1/C6/C8 编号埋头修
                                     (大神建议:让①当②的"真实病灶探针")

  S2 ──► ⑨ 工部解冻:建 LiveFeasibilityPanel 接线   ◄── 硬门:pack_rd<3.8 则"冻结保持",只标位置不建
  S2 ──► ④ smoke 每日 cron 播报:pack_rd 转绿后需"盯它不回退"

  ④ ──S4(连续≥2天产出 smoke_readiness.<date>.json,可 diff)──► ⑥ 报警先验真铁律(需真值表 diff 做数据底座)

  S3 + 件⑧就绪 ──► ⑦ CI 真拦(修 exit-code C1 + 建 Gitee-Go 流水线 C2 + 开分支保护)
                       │  ⑦ 必须先于任何 PR 合入 master,否则合并裸奔
                       ├─S7(故意红 push 被挡住)──► ⑧ work→master 合并(走真门)
                       └─S7 ─────────────────────► ⑨ 的 PR 也走同一真门

  ③(xingbu-wt 窗口) + ⑧(mainline 窗口) 并发≥2 ──► ⑤ territory-guard:划地盘防跨窗口对撞

  S1 + S3(产出真用记录) ──► ⑩ 部门成熟度 dashboard(此时才有"第一条真实数据"可诚实展示)
```

### 三件落地顺序(本周内)
**③ 刑部接活(1 小时,最低成本最高可见)→ ① 吏部用透(零代码,验证"真被用"假设)→ ② 数字勾稽(后端重活,与 ①③ 并行推)。**
理由:③ 立刻多一个真被用部门;① 检验"真被用"这条主轴是否成立(比再接第 8 部门重要);② 是信任地基,后端独立推进不阻塞前端。

---

## 3. 十件逐件(目标 / 步骤 / 可证伪验收 / owner / 依赖)

> 已去重:pack_rd 结构性修复归 ②,工部解冻的"门禁 + 接线"归 ⑨(强依赖 ②);CI 平台/exit-code 归 ⑦,合并纪律归 ⑧。

---

### 件 ① · 用透吏部一周(真被用)— 本周

**目标:** 连续 5 个工作日,每天向吏部真链下 1 条真实招聘需求,各产出 1 份 `LIVE_SWARM` 帝金方案 + 1 页问题清单,攒成可复盘的"被用证据档"。

**已验真前提:** `src/app/api/court/dept/li-bu/recruit/route.ts` 第 7/9 行明示「咨询类,不写主库 tasks·铁律4」→ 留痕**必须落文件 artifact**,不能指望 DB 自动攒。入口已活,右侧常驻 `LiveRecruitPanel`(`personnel-client.tsx:39` import / `:652` render)。

**步骤:**
1. 访问 `http://localhost:3002/chaotang/manor-dept/li-bu`(basePath 坑见 memory:用 `router.push` 勿 `location.assign`)。
2. 每个工作日陛下下 1 条**真 JD**(非"测试"占位)。
3. 等帝金:`recruit/result` 返回 `sourceLabel==='LIVE_SWARM'` 才算数(灰徽=FALLBACK 当天作废重下)。
4. 手动留痕:新建 `docs/libu-week-trial/day-N.md`,固定字段 `日期/traceId/sourceLabel/输入JD/产出摘要/问题清单(≥3条)`。
5. 周五汇总 `docs/libu-week-trial/SUMMARY.md`:5 天命中率 + 最高频 3 类不可信问题。

**可证伪验收:**
- `ls docs/libu-week-trial/day-*.md | wc -l` == 5,且每份 `sourceLabel` 字面值 == `LIVE_SWARM`(grep 可判,灰徽不计入)。
- 每份"问题清单"段 ≥ 3 条(可数)。
- `SUMMARY.md` 含 5 个 traceId,去重后 == 5(证明 5 次独立真跑,非复制)。
- **反证:** 任一天 `sourceLabel≠LIVE_SWARM` 或 traceId 重复 → 不通过。

**owner:** 陛下(每日下真需求 + 记问题);我(建 `docs/libu-week-trial/` 模板与骨架)。
**依赖:** jiqun:8081 `flow_recruit` 在线(已金标);无新代码依赖。**产出信号 S1。**

---

### 件 ② · 数字勾稽专项(数字可信)— 本周(pack_rd 拆两段)

**目标:** pack_rd / 户部 / product 三处做到"数能算平"或"诚实标缺证",杜绝编造总额。本周主攻 pack_rd 结构性修复;户部/product 按 **S1 周报最高频** 排序跟进。

**已验真前提:** FAIL 都在后端 jiqun(前端无勾稽逻辑);`smoke_readiness.json` 实测 `pack_rd` 当前 `status:error`(成本 agent 排 step_1、在 BOM 出来前算账)。

**步骤:**
- **2a · pack_rd(后端 jiqun):** 照 `docs/PACK_RD_COST_FLOW_FIX_2026-06-22.md` 拆两段——`step_1` 改 `presale_rough_cost`(只出 ¥/Wh 粗估、标"粗估·BOM未定"、**不进 C1**);新增 `final_cost_reconciliation`(排结构 BOM 之后):cell_engineer 定芯 × `cell_price_benchmark` 真单价 + BMS + 结构 BOM **正推自洽总额** → 进 final_output。改前先画 `config/flow_pack_rd.yaml` 全 `depends_on` DAG,确认不断 `supply_chain/cell_engineer/bms_hw_engineer` 引用早期成本的边。重跑 `python scripts/smoke_all.py`,读 `reports/smoke_readiness.json`。
- **2b · 户部 C1/C6/C8(后端):** 逐项单独复现(报警先验真),判"能算平→修通"或"缺证→标待核",禁假值填平。
- **2c · product:** 同范式,数算平或标缺证。

**可证伪验收:**
- pack_rd「12V/1100Wh 低温任务」重跑:final_output 成本字段含自洽 BOM(电芯 120 颗 × 真单价),**总额 == Σ分项**(逐项加和等于总额);`C1 == PASS`;`total_score ≥ 3.8`(读 `smoke_readiness.json` 字段,非口述)。
- 户部 C1/C6/C8 每项终态 ∈ {PASS, 显式"缺证·待核"};**禁出现"有总额但 Σ分项≠总额且未标缺证"**。
- product 随机抽 1 条:Σ分项对总额,或缺项处有"待核"字样。
- **反证:** 任一处总额无法由分项加和复现且未标缺证 → 不通过。

**owner:** 后端(jiqun `feat/courtos-loop-harness`:`flow_pack_rd.yaml` + 户部勾稽 agent + smoke 重跑)。
**依赖:** 改 jiqun 后须重启 `serve-dev.sh`(memory:蜂群产出链);worktree 隔离每窗口。**产出信号 S2;消费 S1 决定 2b/2c 顺序。**

---

### 件 ③ · 刑部接活(真被用 · 1 import + 1 render)— 本周

**目标:** `xingbu-client` 接上已金标(4.71)的 `LiveLegalPanel`,陛下能在刑部页直接下合同/法律问题 → 出帝金法律意见。

**已验真前提:** `src/features/legal/components/live-legal-panel.tsx` 自洽(自带 `/api/court/dept/xing-bu/legal` 调 jiqun:8081 `flow_legal`、诚实 sourceLabel)。接活 = 镜像 personnel-client 的 import(行 39)+ render(行 652)两处。

**步骤(照 personnel-client 验证过的范式):**
1. 加 import(`xingbu-client.tsx` import 区):`import { LiveLegalPanel } from '@/features/legal/components/live-legal-panel';`
2. 加 render("裁决详情"右栏常驻,镜像 `personnel-client.tsx:652` 摆位):`<LiveLegalPanel />`(自带 API + 诚实 sourceLabel,无需传 props)。
3. **铁律 4 双门**(给"裁决/法律意见"加版面 = 高危):(a) 开独立 `code-reviewer` 子 agent 读真实 `git diff`;(b) 加回归断言/e2e:刑部页输入合同问题 → 断言出现帝金 `LIVE_SWARM` 意见且"后果条款"标"需确认"。
4. 验证 `pnpm exec tsc --noEmit && pnpm build`(Next typecheck 严于 root,必跑),`pnpm dev` 访问 `/chaotang/manor-dept/xing-bu` 截图。

**可证伪验收:**
- `git diff xingbu-client.tsx` 恰含 1 处 `import { LiveLegalPanel }` + ≥1 处 `<LiveLegalPanel`(grep 可数)。
- `pnpm build` 退出码 0。
- 浏览器实测:输入"独家供货+预付款30%违约金条款风险"→ 返回 `sourceLabel==='LIVE_SWARM'` 帝金意见,"后果性/consequential"字段渲染为"需确认"(截图佐证,非 DEMO/灰徽)。
- **反证:** 出 DEMO/FALLBACK 灰徽当真意见、或 build 失败 → 不通过。

**owner:** 刑部窗口(`xingbu-client.tsx` 单文件,纯单文件不碰 `[shared]`)。
**依赖:** jiqun:8081 `flow_legal` 在线(已金标 4.71)。**产出信号 S3。**

---

### 件 ④ · smoke 每日 cron + 每早一条蜂群健康播报(自报警)— 等 S2 触发

**目标:** 每天 07:00 无人值守刷新 `smoke_readiness.json` 并推一条 Markdown 健康播报到 Telegram,`rate_limited`(provider 限流,非坏)与 `error/timeout`(真需修)**分区分行,绝不混算**。

**已验真前提:** cron 守护在跑;`/home/ubuntu/bin/cron-run` 是既有包装器(写 state JSON + 失败 telegram 告警);`telegram-notify.sh --markdown` 可用;`smoke_all.py` 走 subprocess 跑各蜂群(不依赖 live server);`smoke_readiness.json` 是 21 项 list、status 已含 `rate_limited`。**复用,不另起炉灶。**

**步骤:**
1. 新建 `jiqun_ai_fresh/scripts/smoke_daily.sh`(~40 行):`.venv/bin/python scripts/smoke_all.py` → 内联 python 渲染播报(第一行 `✅ 出输出 N/21`;`❌ 真需修(error+timeout)` 逐列;`⏳ rate_limited` 单独列不计入坏)→ 调 `telegram-notify.sh --markdown`;并 `cp reports/smoke_readiness.json reports/smoke_readiness.$(date +%F).json`,`find ... -mtime +7 -delete` 留 7 天滚动。
2. 开头加 env 断言:`ss -tlnp | grep -q :4444 || telegram "⚠️ smoke 跳过:LiteLLM:4444 未起,非蜂群坏"`(把"环境没起"与"蜂群真坏"分开)。
3. cron 追加(复用 cron-run 免重复造锁):
   `0 7 * * * /home/ubuntu/bin/cron-run smoke-daily 1440 -- /bin/bash /home/ubuntu/fe/fengQun/jiqun_ai_fresh/scripts/smoke_daily.sh >> /home/ubuntu/.openclaw/log/cron/smoke-daily.log 2>&1`
4. **(大神建议落地)** 播报加"昨天→今天 delta 行":diff `smoke_readiness.<昨日>.json` vs 今日,把"新坏的(昨 normal 今 error)"单独置顶高亮;无异常时极简一行 `✅ 21/21,无需修`(防狼来了)。

**可证伪验收:**
- **A.** 次日 07:0x,`reports/smoke_readiness.<date>.json` 存在且 `stat -c %y` 在 07:00–07:15。
- **B.** Telegram 当日收到含 `出输出` + `/21` 的播报;若当日有 `status==rate_limited`,该条**必含独立 `⏳ rate_limited` 行**且该蜂群名**不出现在 `❌ 真需修` 行**(两行互斥,机器可判)。
- **C.** 手动 `bash scripts/smoke_daily.sh` 退出码 0 且 Telegram 立即收到一条。
- **D.** `cat ~/.openclaw/cron-state/smoke-daily.json` 含 `last_run` 时间戳。
- **反证:** 播报把 rate_limited 算进"真需修"总数,或次日 07:30 仍无当日 json → 未达标。

**owner:** 后端窗口(`chore/smoke-daily-cron`)。
**依赖:** 既有 `cron-run` + `telegram-notify.sh`;LiteLLM:4444/backend:8081 由 `litellm-watchdog.timer` 保活。**触发:S2;产出信号 S4(真值表 diff 底座)。**

---

### 件 ⑤ · 两窗口 worktree 隔离纪律 + territory-guard(止盲区)— 等并发≥2 触发

**目标:** 每窗口绑独立 worktree;建完即提交;`territory-guard.sh` 在 commit 前客观判定"我是否在别人地盘改了文件"。背景:已发生"两窗口共享工作树 churn 毁活"。

**步骤:**
1. 新建 `scripts/territory-guard.sh`(~50 行,纯 bash+git):读 `$(git rev-parse --git-dir)/territory` 拿 TERRITORY,比对 `config/territory-map.json`(每 territory 允许的路径 glob,如 `xingbu→src/features/legal/**`、`mainline→其余`);命中越界 → 非零退出 + 打印清单;**共享文件**(`AGENTS.md`/`CLAUDE.md`/`package.json`/`src/lib/contracts/**`/`next.config.ts`)要求 `git log -1 --format=%s` 首行含 `[shared]` 否则拒。
2. 挂 `pre-commit` hook(沿用既有 husky/手动 hook)。
3. 把规则写进 `AGENTS.md §-1` 新增小节"并发 worktree 协议":① 每窗口一棵树 `git worktree add ../<topic>-wt <branch>` 后 `echo <topic> > .git/territory`;② 建完即提交;③ commit 前 guard 必过。
4. 照抄结构参考 `scripts/courtos-freeze-guard.sh`(已存在 guard 范式)。

**可证伪验收:**
- **A.** 在 `xingbu-wt` 改 `src/lib/contracts/task.ts` 且 commit msg 不含 `[shared]` → guard 退出码 ≠ 0 且 stdout 含该路径。
- **B.** 只改 `src/features/legal/**` → guard 退出码 0。
- **C.** `cat <wt>/.git/territory` == 对应 territory 名。
- **D.** `git worktree list` 各树分属不同 branch,无两棵指同一 branch。
- **反证:** 两窗口 `git rev-parse --show-toplevel` 返回同一路径,或越界改动能静默 commit → 未达标。

**owner:** 前端窗口(本仓 master,guard 是前端基建);后端对称复制一份到 `jiqun_ai_fresh/scripts/`。
**依赖:** 无新依赖(git+bash);需先写 `config/territory-map.json`(单张 SSOT 表)。**触发:③+⑧ 并发≥2。**

---

### 件 ⑥ · "报警先验真"钉成铁律(止盲区)— 等 S4 触发

**目标:** "报警先验真(单独复现再动手)"从口头约定变成两仓 CLAUDE.md 明文**铁律 6**,且 smoke 链路里有一处机器执行点强制它。

**步骤:**
1. 前端 `CLAUDE.md`"工程铁律"节末(铁律 5 后)新增**铁律 6 · 报警先验真**:任何"蜂群坏/分掉/链断"报警禁直接改代码,先三问(① 能否单蜂群重跑复现?② 是否 provider 限流/环境没起 `:4444`/`:8081`?③ 与昨日 `smoke_readiness.<date>.json` diff,真退化还是单次抖动?);三问未过 = 假阴性,标 `rate_limited`/`env_down` 退避重试,不计入"需修"。判据:`git diff` 因一条报警改了业务逻辑但无"单独复现记录" → 违规。
2. 后端 `jiqun_ai_fresh` CLAUDE.md/AGENTS.md 量具节对称落地、互引。
3. 机器执行点:`smoke_all.py` 的 `_looks_rate_limited` + 退避重试已是雏形;件 ④ 的 `:4444/:8081` 存活断言把"环境抖动"标 `env_down` 而非 `error`。

**可证伪验收:**
- **A.** `grep -c "报警先验真" CLAUDE.md` ≥ 1 且 `grep "铁律 6" CLAUDE.md` 命中。
- **B.** 后端 CLAUDE.md/AGENTS.md 同样 `grep "报警先验真"` ≥ 1(两仓对称)。
- **C.** 构造一次 429(mock `:4444`),跑 `smoke_all.py`,断言对应蜂群 `status==rate_limited` 而非 `error` 且不进"真需修"区。
- **反证:** 两仓任一 CLAUDE.md 无此铁律明文,或一次 429 报成 `error` 计入"需修" → 未达标。

**owner:** 前后端各改各自 CLAUDE.md(`[shared] CLAUDE.md`,遵件 ⑤ 纪律)。
**依赖:** 件 ④ 的真值表 + 件 ⑤ 的 `[shared]` 纪律。**触发:S4。**

---

### 件 ⑦ · honesty:all CI 真拦验证(落地发布)— 等 S3+件⑧就绪触发,且必须先于任何合并

**现场已复现两个 CRITICAL(必须先修,否则验收注定假绿):**
- **C1 · exit-code 被吞(`package.json:45`):** `"honesty:all": "pnpm guard:freeze; pnpm guard:honesty; pnpm test:core"` —— `;` 只返回最后一条退出码,前两道门红时整体仍返回 0。修复:`;` → `&&`。
- **C2 · CI 平台与 remote 不匹配:** 唯一 remote 是 `git@gitee.com:msxn/chaotang-web-lyt.git`,而 CI 写在 `.github/workflows/ci.yml`(第 36 行 `pnpm honesty:all`)。**已核验无 `.workflow/` 目录** → Gitee 不执行 GitHub Actions,`honesty:all` 在真实 Gitee 合并上根本不跑。"CI 真拦合并"目前是空的。

**目标:** 让 `pnpm honesty:all` 在合并进 master **之前**真跑,任一子门红时整体 fail 并拦住合并。

**步骤:**
1. 改 `package.json:45` 的 `;`→`&&`(C1)。
2. 新建 `.workflow/pr-ci.yml`(Gitee Go,PR 触发):`pnpm install --frozen-lockfile` → `pnpm honesty:all`(C2)。
3. Gitee 仓库 → 管理 → 分支设置:master 设保护分支,开「合并 PR 前置流水线检查通过」绑定该流水线。
4. 保留 `.github/workflows/ci.yml`(未来若加 GitHub 镜像仍可用),但不再假设它在拦 Gitee 合并。

**可证伪验收:**
- **A(exit-code 真传播):** `guard:freeze` 临时注入 `exit 1`,跑 `pnpm honesty:all`,断言 `echo $?` ≠ 0(当前 == 0,已复现)。
- **B(freeze 门真拦):** 在 `src/lib/department-learning/` 任意 `.ts` 写入 `isE2eEvidenceId`(触发冻结锁)开 PR → 断言 Gitee 流水线 fail 且合并按钮被分支保护禁用;删行后转绿可合。
- **C(honesty 门真拦):** 在某无徽 `*-client.tsx` 写入 `source: 'seed'`(触发 `FAKE_RE`)不挂 `ConfidenceSourceBadge` 开 PR → 流水线红、合并被拦;挂徽转绿。
- **D(core test 门真拦):** 改错 `gongbu-feasibility-envelope.nodetest.ts` 某断言 → `pnpm test:core` 红 → 合并被拦。
- **E(平台真跑·前置):** Gitee PR 页能看到 pr-ci 执行记录(run id + 日志),而非"无任何检查"。E 不成立则 A–D 全是本地自欺。

**owner:** 发布工程(我)。**Gitee 分支保护开关需仓库 admin(msxn)配合点一次** —— 这是整条发布链能否"真拦"的**唯一外部卡点**,动手前先确认权限。
**依赖:** 无代码依赖;依赖 Gitee admin 权限。**触发:S3 + 件⑧就绪;产出信号 S7。**

---

### 件 ⑧ · work 分支 → master 合并发布(落地发布)— 等 S7 触发

**现场核验纠偏(快照已过期,执行时须重测):** 任务起始快照说当前在 `work/shangshufang-live-edit-20260618`,但实测**工作区现已在 `master`**,`HEAD == origin/master == 428a394`。T3 报告的"work 领先 5 / 落后 19"基于旧快照——**这 5 个 libu 精修 commit 可能已并入 master,或在 `feat/libu-chro-cao-contract`(实测 `[ahead 4]`)上待收尾**。广义"第三梯队蜂群修复"主体(xingbu 真链 `35e0c2d`、unified loop `0bf89a0`、安全加固、刑部)**已在 master**,别误判范围为"发出蜂群修复"。

**目标:** 把仍未并入的 libu 精修 commit 安全并进 master,不携带任何被否决/绕过的状态;合并后 master 仍过 `honesty:all` + `pnpm build`。

**步骤(铁律 3 合并即清理 + 铁律 4 高危双门):**
1. **执行第一步先重测:** `git rev-list --left-right --count master...feat/libu-chro-cao-contract`(及候选 work 分支)确认真实 ahead/behind;若 == 0/0 说明已并入,本件直接 close。
2. 若有待并:`git checkout <work> && git merge origin/master`,解冲突(预期零重叠,执行时复核 `comm -12`)。
3. **铁律 3 收尾:** `git grep -n "suggestionToEdict\|recruit-verdict\|裁断"` 查同一意图是否两份实现,留其一删其余。
4. work 上跑 `pnpm honesty:all && pnpm build` 双门绿。
5. **铁律 4 双门**(含 `confidence-source-badge.tsx` 改动 = 给"把握度"加视觉权重,命中高危):(a) 独立 `code-reviewer` 子 agent 读 `git diff master...<work>` 找盲点禁自审;(b) 确认 `recruit-verdict.nodetest.ts` 断言"缺质量分时显『未测』不冒充把握度",没有则补。
6. 经 Gitee PR 合入 master(走件 ⑦ 流水线门),**禁直接 push master**。

**可证伪验收:**
- **A.** 合并后 `git branch --merged master | grep <work>` 命中;`git log --oneline master | head -1` 为合并/收尾提交。
- **B.** master HEAD `pnpm honesty:all` 退出码 0(修了件 ⑦ C1 后才有意义)。
- **C.** master HEAD `pnpm build` 退出码 0。
- **D(真链可见):** `pnpm dev` 访问吏部页,断言招聘真链卡来源徽为帝金 `LIVE_SWARM`,无质量分时显"未测"而非伪造数字(Playwright 截图判)。
- **E(无回退污染):** `git diff master~1 master -- src/lib/department-learning/` 不得引入 `isE2eEvidenceId`(确认没把冻结后门带回)。
- **反证:** 任一门红、或 D 出灰徽 → 不通过。

**owner:** 发布工程。
**依赖:** **件 ⑦ 必须先落地**(否则裸合);独立 review 子 agent。**触发:S7。**

---

### 件 ⑨ · 工部解冻 → 接 LiveFeasibilityPanel(落地发布)— 等 S2 达标硬门触发

**现场核验:** 工部后端链已在 master(`src/app/api/court/dept/gong-bu/feasibility/route.ts` entry=`pack_rd` + `/result` + `src/core/courtos/runtime/gongbu-feasibility-envelope.ts` 的 `stripProductionFields` 锁产线资产 + nodetest 3 pass)。**前端 `LiveFeasibilityPanel` 不存在**(`src/features/gongbu/` 仅 `gongbu-bottom-dock.tsx`)——真缺口。硬阻塞:pack_rd 当前 `status:error`、`total_score:null`(根因见件 ②)。

**目标:** 当且仅当 pack_rd 修到 `total_score≥3.8 + C1 自洽`,前端才解冻接 `LiveFeasibilityPanel`,渲染真可行性裁断(`LIVE_SWARM`);未达标前工部页**不得**出现可采纳的可行性裁断(铁律 5 防空转)。

**步骤:**
1. **门禁(前置):** 读最新 `reports/smoke_readiness.json`,断言 pack_rd `total_score≥3.8 且 status==normal`。未达标 → 冻结保持,只标位置不建 panel(后端修复属件 ②/jiqun 仓,不在前端做)。
2. 达标后照吏部范式(`live-recruit-panel.tsx`)+ 刑部范式(`live-legal-panel.tsx`)建 `src/features/gongbu/components/live-feasibility-panel.tsx`:调 `/api/court/dept/gong-bu/feasibility`(点火)→ `/result`(取剥离后产出),只渲染定性可行性 + 缺证;产线字段(报价/供应商/交期)显"转后端军机处"锁名、**永不**渲染成可采纳裁断。
3. 接进 `gongbu-client.tsx`(已 import `BuildCasePanel`,同位置加 panel/替换 seed 总览 C 位)。
4. **铁律 4 双门:** (a) 独立 `code-reviewer` 审 diff;(b) 加回归断言:"产线字段(报价数字)不得出现在可采纳 consult 文本里"(确认覆盖 UI 渲染路径)。
5. 走件 ⑦ 流水线门 PR 合入。

**可证伪验收:**
- **A(门禁真生效):** pack_rd `total_score<3.8` 时,工部页 DOM 中无 `data-source="LIVE_SWARM"` 的可行性裁断节点(无"采纳"按钮)。
- **B(达标后出真裁断):** ≥3.8 且 C1 自洽后,`pnpm dev` 工部页断言出现帝金 `LIVE_SWARM` 节点(Playwright 截图 + DOM `source==='LIVE_SWARM'`)。
- **C(产线资产不泄漏):** 断言渲染文本不含具体报价数字/供应商名/交期作为可采纳裁断(nodetest 钉死 `stripProductionFields` 后 consult 不含 `¥`+数字模式)。
- **D(C1 自洽可验):** pack_rd「12V 1100Wh 低温任务」final_output 成本含自洽 BOM(电芯 120 颗×真单价,Σ==总额),C1 PASS;前端只在该案例后端转绿后接线。
- **E(冻结锁不误伤):** 接线后 `pnpm guard:freeze` 仍绿。
- **反证:** 门禁失效(未达标却出可采纳裁断)或产线数字泄漏 → 不通过。

**owner:** 前端发布工程(panel + 接线 + 门禁);**后端 pack_rd 修复 owner = jiqun 仓(件 ②)**。
**依赖:** **强依赖件 ②**(pack_rd≥3.8),在此之前只标位置不建。**触发:S2 达标。**

---

### 件 ⑩ · 部门成熟度真值表 → 常态 dashboard(长线)— 等 S1+S3 真用记录触发

**致命前提(已复现,方案核心):** 同一部门跨进程有 4 套互不相等命名,无中央映射表 → 直接 join 静默空转(违铁律 2)。**第 0 步(阻塞全任务):** 在 `config/departments.registry.yaml` 每部门补 `aliases: { deptCode, swarmBundle, smokeSwarm, runDeptId }`,建唯一映射器 `src/lib/maturity/dept-alias.ts`(import registry,fail-fast,缺别名 `logger.warn` 不 `?? code`)。所有 join 只走它。

| 维度 | 户部 | 吏部 | 刑部 | 工部 | 来源 |
|---|---|---|---|---|---|
| registry `swarm_bundle` | `finance` | `hr` | `legal_risk` | `delivery` | `config/departments.registry.yaml`(实测 7 部门,1 个 null) |
| smoke `swarm` | `finance` | `libu` | `legal` | `gongbu_review`/`pack_rd` | `jiqun reports/smoke_readiness.json` |
| 真链 `department_id` | `finance` | `personnel` | `justice` | `war`… | `.chaotang-main-dev.db: department_review_runs` |
| 路由 `deptCode` | `finance` | `libu` | `legal` | `works`/`gongbu` | `manor-dept/[deptCode]/page.tsx` |

**目标:** `/command-center/maturity` 子路由(溶进军机处工位,不新建顶层版面)挂常态真值表,每行一已注册部门,4 列全实测聚合:`蜂群质量 | 有无真链 | 是否被真用 | 数据新鲜度`,任何格无真实来源显 `—/灰`,禁假绿。

**步骤:**
1. 第 0 步 registry 补别名 + `dept-alias.ts`(含 fail-fast 断言)。
2. 新建 `src/app/api/court/maturity/route.ts`(服务端只读):读 `jiqun reports/smoke_readiness.json`(仿 `src/app/api/court/backend/reports/[id]/route.ts` readFile;缺文件→该列 `missing`)+ 查本地 `department_review_runs`(仿 `primary-store.ts`)聚合 `last_used_at/used_count_7d/worst_
source_label`;经 `dept-alias.ts` join,`sourceLabel` 过 `normalizeRealityState`(reality-state SSOT)。
3. 新建 `src/app/(dashboard)/command-center/maturity/page.tsx`:`useSWR('/api/court/maturity', swrFetcher, { refreshInterval: 60_000 })`,复用 `GlassPanel`/`DataState`/`StatusPillButton`,按 `REALITY_TONE` 着色(real=帝金/绿,fallback=黄,missing=灰),不重写 globals.css。
4. 数据底座由件 ④ 的 cron 周期重跑 `smoke_all.py` 刷新;新鲜度列直接暴露 `smoke_readiness.json` 的 mtime。
5. 新建 `e2e/maturity-dashboard.spec.ts`(照 `e2e/swarm-members.spec.ts`:cookie+localStorage 双门 + `page.route` mock 三态)。

**可证伪验收:**
- **A(SSOT 唯一):** `grep -rn "swarmBundle\|smokeSwarm\|deptCode" src --include=*.ts` 除 `dept-alias.ts` 外无第二处硬编码别名 map → 命中第二处即 FAIL。
- **B(不假绿):** `smoke_readiness.json` 改名后访问页,"蜂群质量"列全渲染 `missing/灰`,无任一格显 grade/绿。
- **C(join 不空转·回归断言):** 单测 `dept-alias.test.ts` 断言 registry 7 部门全能 join 到 smoke 与 runs(或显式标 `no_real_chain`)、零孤儿;故意改错一个 `smokeSwarm` → 测试必须 RED。
- **D(被真用判据):** `department_review_runs` 中 `finished_at` 近 7 天且 `status='completed'` 标"真用=是";手动 `INSERT` 一条新 run 后 60s 内该格翻"是" → 不翻即 FAIL。
- **E(真链列对账):** 标"有真链"行当且仅当 `src/features/*/components/live-*.tsx` + `/api/court/dept/<deptCode>/*/route.ts` 两者都存在(当前=吏部/刑部/工部);误标 → `ls` 比对脚本 FAIL。
- **F(新鲜度真实):** 页面时间戳 == `smoke_readiness.json` mtime;`touch` 后刷新跟变 → 不变即 FAIL。
- **G(门禁绿):** `pnpm honesty:all` + `pnpm build` 通过,新 spec 入 `e2e/`。
- **(大神建议落地)** 把 C 的"零孤儿断言"挂进 `pnpm honesty:all` 当 CI 门 → 让任何人日后给 registry/swarm 改名立刻红(命名漂移的金丝雀)。

**owner:** 前端(API + 页面 + alias + E2E);后端 jiqun(smoke cron 保证 json 周期刷新,禁前端跑 smoke)。跨仓握手点 = `reports/smoke_readiness.json` 字段契约(改名须双仓同步)。
**依赖:** 硬依赖第 0 步别名表;真实现状:`department_review_runs` 仅 11 行、`source_label` 全 `MIXED`(无一条真 LIVE)——dashboard 第一价值正是诚实暴露"真链接通但尚无 LIVE 真用"。**触发:S1+S3 产出真用记录后。**

---

## 4. 主验收清单(整个项目"算完成"的客观标准)

> 全部可勾选、可机器判定。分三轴对齐总纲。

**轴一 · 真被用(Used)**
- [ ] `ls docs/libu-week-trial/day-*.md | wc -l` == 5,每份 `sourceLabel`==`LIVE_SWARM`,5 个去重 traceId(件 ①)。
- [ ] 刑部页 `git diff` 恰 1 import + ≥1 render `LiveLegalPanel`,浏览器实测出帝金 `LIVE_SWARM` + 后果条款"需确认"(件 ③)。
- [ ] `department_review_runs` 出现 ≥1 条近 7 天 `status='completed'` 真用记录(件 ①/③ 的副产物,供件 ⑩)。

**轴二 · 数字可信(Trusted numbers)**
- [ ] pack_rd「12V/1100Wh」重跑:`total_score≥3.8` 且 `C1==PASS` 且 final_output **总额==Σ分项**(读 `smoke_readiness.json`,件 ②)。
- [ ] 户部 C1/C6/C8 每项 ∈ {PASS, "缺证·待核"};无"有总额但 Σ≠总额且未标缺证"(件 ②)。
- [ ] product 抽检 1 条:Σ对总额或缺项标"待核"(件 ②)。
- [ ] 工部 panel 渲染文本不含报价数字/供应商/交期作为可采纳裁断(件 ⑨ C)。

**轴三 · 绿是真绿(Provably green)**
- [ ] `package.json:45` 为 `&&` 串联;`guard:freeze` 注入 `exit 1` 时 `pnpm honesty:all` 退出码 ≠ 0(件 ⑦ A)。
- [ ] `.workflow/pr-ci.yml` 存在,Gitee PR 页能看到 pr-ci run id + 日志(件 ⑦ E)。
- [ ] master 设分支保护,故意红 push(`isE2eEvidenceId`)合并按钮被挡;删后转绿可合(件 ⑦ B)。
- [ ] master HEAD `pnpm honesty:all` + `pnpm build` 双绿;`git diff master~1 master -- src/lib/department-learning/` 无 `isE2eEvidenceId`(件 ⑧ B/C/E)。

**轴四 · 自报警 + 止盲区(Watched)**
- [ ] 次日 07:0x 自动产出 `smoke_readiness.<date>.json` 且 Telegram 收到含 `出输出 N/21` 播报;`rate_limited` 与 `真需修` 两行互斥(件 ④ A/B)。
- [ ] `territory-guard.sh`:越界改共享文件无 `[shared]` → 退出码 ≠ 0;`git worktree list` 无两树同 branch(件 ⑤ A/D)。
- [ ] 两仓 CLAUDE.md 均 `grep "报警先验真"` ≥ 1;一次 429 报为 `rate_limited` 不计"需修"(件 ⑥ A/B/C)。

**轴五 · 长线诚实底座(Honest baseline)**
- [ ] `grep -rn "swarmBundle\|smokeSwarm\|deptCode" src` 除 `dept-alias.ts` 外无第二处别名 map(件 ⑩ A)。
- [ ] `dept-alias.test.ts` 零孤儿断言通过且改错 `smokeSwarm` 时 RED;该断言已挂进 `pnpm honesty:all`(件 ⑩ C)。
- [ ] `smoke_readiness.json` 改名后 dashboard"蜂群质量"列全 `missing/灰`,无假绿(件 ⑩ B)。

**项目级总判定(全绿才算"从建造到证明"完成):**
- [ ] 三个真链部门(吏部/刑部/工部)均**浏览器实测**出帝金 `LIVE_SWARM`,无一靠 DEMO/灰徽冒充。
- [ ] 凡出总额处,要么 Σ==总额,要么标缺证;**全仓零"假值填平"**。
- [ ] CI 在真实 Gitee 上**至少成功拦过一次红 push**(有 run id 为证,非口头)。

---

## 5. 本周三件 Day-by-day

> 三件并行:① 吏部(陛下每日 5 分钟)+ ② pack_rd(后端整日)+ ③ 刑部(周一 1 小时一次性)。

### Day 1(周一)
- **③ 刑部接活(一次性打通,最高可见):**
  1. `git worktree` 在 `xingbu-wt` 窗口改 `xingbu-client.tsx`:加 import `LiveLegalPanel`(行 39 范式)+ render(行 652 范式)。
  2. `pnpm exec tsc --noEmit && pnpm build`,`pnpm dev` 访问 `/chaotang/manor-dept/xing-bu` 截图。
  3. 开独立 `code-reviewer` 子 agent 读 `git diff`(铁律 4)。
- **① 吏部 day-1:** 建 `docs/libu-week-trial/` 模板;陛下下第 1 条真 JD,等帝金 `LIVE_SWARM`,记 `day-1.md`(traceId + 问题清单≥3)。
- **② pack_rd:** 后端先画 `config/flow_pack_rd.yaml` 全 `depends_on` DAG,确认成本边;`docs/PACK_RD_COST_FLOW_FIX_2026-06-22.md` 对照,**先验真**复现 `status:error`(单跑 `python scripts/smoke_all.py --swarm pack_rd`)。

### Day 2(周二)
- **② pack_rd:** 改 `step_1` → `presale_rough_cost`(只粗估、不进 C1);新增 `final_cost_reconciliation`(排结构 BOM 后)。
- **① 吏部 day-2:** 第 2 条真 JD;`day-2.md`。若 day-1 出灰徽,当天作废重下直到 `LIVE_SWARM`。

### Day 3(周三)
- **② pack_rd:** 接 cell_engineer 定芯 × `cell_price_benchmark` 真单价 + BMS + 结构 BOM **正推自洽总额** → final_output;重跑 `smoke_all.py`,看 `total_score` 是否爬过 3.8、`C1` 是否 PASS。
- **① 吏部 day-3:** 第 3 条真 JD;`day-3.md`。
- **③ 收尾:** 刑部 PR 走门(若件 ⑦ 未就绪则先本地双门绿,挂起待 ⑦)。

### Day 4(周四)
- **② pack_rd 验收:** 跑「12V/1100Wh 低温」案例,断言 **总额==Σ分项**(电芯 120 颗×真单价)、`C1==PASS`、`total_score≥3.8`。未过则按"报警先验真"三问定位(限流?DAG 边没断干净?)。
- **① 吏部 day-4:** 第 4 条真 JD;`day-4.md`。

### Day 5(周五)
- **① 吏部周报:** 第 5 条真 JD → `day-5.md`;汇总 `SUMMARY.md`(5 天命中率 + 5 去重 traceId + **最高频 3 类不可信** = 信号 S1)。
- **② pack_rd:** 若已 ≥3.8 → 标记**信号 S2 达标**,通知件 ⑨ 解冻门可开、件 ④ 可建 cron。若户部/product 还差,按 S1 周报最高频排下周序(不按 C1/C6/C8 编号埋头)。
- **周末复盘触发判定:** 检查信号面板——S1(吏部周报)/ S2(pack_rd≥3.8)/ S3(刑部真链可见)哪些已亮,据触发图决定下周先点 ④/⑦/⑨/⑩ 中的哪几件。

---

🎲 大神视角(jeff-bezos + 张小龙)
⚠️ 警示:本方案最大的失败模式不是某件做不完,而是**把"等信号"偷偷变成"反正都先做一点"**——10 件平行启动,context 稀释、窗口对撞、飞轮空转,最后哪件都没真闭环。触发图的价值全在"没触发就不动"这条纪律上;一旦破例,整张图退化成普通待办清单。
💡 天才建议:给"信号面板"一个物理落点——在 `docs/libu-week-trial/SUMMARY.md` 顶部加一张 `信号:S1[ ] S2[ ] S3[ ] S4[ ] S7[ ]` 勾选表,**只有对应信号打勾,才允许动被它触发的那件**。把"等信号"从口头约束变成 commit 前可 grep 的硬门(谁动了 ⑨ 但 `grep "S2\[x\]"` 没命中 → 视为违纪),用一行文本把张小龙的克制焊成 Bezos 的单向门检查点。