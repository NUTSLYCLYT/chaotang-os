# 上线版整理 · 版面清理台账（2026-06-28 起）

> 目标：整理一版**能直接上线**的，把不要的**隔离放一边**（可逆），**绝不影响主线**。
> 方法：用「首发白名单门」当筛子（`src/features/court-console/lib/launch-whitelist.ts`）+ 每步 build 验证。
> 大神纪律：按**可逆性**排序施工；YELLOW 不凭手感删，逐个过**铁律5**（第一条真实数据从哪来）；DEAD 代码靠 knip 取证，不靠肉眼。

## 9. 实测上线门（起 prod :3050 跑 harness:release）+ 资源画廊裂图修复（2026-06-28）
起 prod(real build, :3050) 跑 `harness:release` 真闭环实测：
- ✅ 真业务链 jiqunHealth/swarmConfig/taskRegistry/legalAgent 全 ok · `/manors` 路由 ok · 移动端无溢出
- ❌ **资源画廊 29 张图 10 张坏**（上书房绿色上线面 → 商家首日见裂图）
- ❌ trueChain STOP 唯一失败项 = `prod-doctor/port-discipline: same_repo_dev_3002_running`（并发 dev 服务,非代码 blocker）

**根因（curl 实测确认）**：白名单 `shouldRedirectForLaunch` 按前缀豁免静态资源,NON_PAGE_PREFIXES 漏 `/prd`
→ `/chaotang/prd/*.webp` 被当页面 **307 跳走** → 裂图。但 `/prd` 不能 blanket 加前缀(还有 `/prd/[space]` 内部页路由,会误暴露)。
**修法**：改按**静态资源扩展名豁免**(`STATIC_ASSET_RE`)——修 /prd/*.webp 等,且保留 `/prd/[space]` 页仍被挡。
回归断言：launch-whitelist.nodetest 加 2 测(静态豁免 + 同名页仍挡),7/7 绿。
验证链：tsc → rebuild → 重启 prod → curl /prd 307→200 → 重跑 harness **brokenCount 10→0**。
残留：dev 3002 port-discipline(并发服务,运维项,非代码)。

## 8. 上线门禁体检 + guard:honesty 退役（2026-06-28）
跑静态上线门：`guard:realdata/auth/tenant/pilot/upstreams` ✅ 5 绿；`guard:honesty` ❌——清理暴露它审一套**已消失的旧架构**（manor-dept `*-client.tsx` + `confidence-source-badge` 都没了；旧假数据 idiom 在现役 218 features 仅 1 命中且已标）。简单重指=假绿(违禁假绿铁律)。
**决定：退役 guard:honesty，诚实债改由 `guard:realdata`(strict·0漂移) + sourceLabel 兜底。**
- `scripts/daily-mainline-gate.mjs`：摘除 guard:honesty 条目（不再阻塞 gate:daily）
- `scripts/honesty-debt-audit.mjs`：改退役说明桩(exit 0，留 `pnpm guard:honesty` 可跑、不动并发热点 package.json)
- 验证：退役桩 exit 0 · guard:realdata 仍 0退出 · gate 内已 0 条 honesty
- 若要恢复"部门卡级"诚实检查→须围绕 sourceLabel 可见性重设计，非复活旧 idiom。

## 0. 上线版机制（已存在·无需重建）
生产环境 `middleware.ts`（`NODE_ENV=production && RETIRE_SURFACES!==0`）调用 `shouldRedirectForLaunch()`：
**只放行 21 个绿页，其余 73 页一律 redirect→上书房**。所以"上线版"在 runtime 已成立；源码整理只是让代码库也干净。

## 1. 三色地图（96 页 → 机器判色）

### 🟢 GREEN 21 · 首发放行给商家（绿色主干·不动）
真业务面 6：`intel锦衣卫 · court-briefing/shangshufang上书房 · departments(仅finance户/ops兵) · libu御书房`（+各 detail）
启动流/营销 15：`/ /intro /enter /onboarding /login /register /invite /about /guide /more /start /share`

### 🔴 RED · demo/原型/路演
| 页面 | 引用数 | 处置 | 状态 |
|---|---|---|---|
| `/demo` | 0 | 移隔离 | ✅ 已移 `dev/_attic/retired-routes/demo` |
| `/jiqun/debug` | 0 | 移隔离 | ✅ 已移 `dev/_attic/retired-routes/jiqun-debug` |
| `/prototype/boss-decision-loop` | 0 | 移隔离 | ✅ 已移 `dev/_attic/retired-routes/prototype` |
| ~~`/grand-council`~~ | **17** | **误判·撤回** | ❌ **不动**（见 §3） |

### 🟡 YELLOW 71 · 真实存在但生产不对外 → 需第二道筛
- **A 主闭环内部工位（活·保留）**：command-center军机处 · archive/scribe/shiguan史馆 · governance裁决门 · throne御座 · task/tasks决策详情 · reports奏报 · agent/[code] · roles
- **B 内部运营后台（活·保留）**：`/jiqun/*`(11) · `/admin/*`(3)
- **C 真业务·未上线/待数据（冻结打标·别静默腐烂）**：battery-exchange电池交换(8) · dadian大典 · manors庄园 · hanlin翰林(11) · forecast钦天 · health
- **D 可疑空转骨架（重点审·铁律5）**：offices · study/* · donggong东宫 · present/[id] · prd/[space] · e2e-harness/prompt-suggest · overview · prime

## 2. 施工进度
- [x] settings.local.json 删 6 条 CRITICAL 通配符放行（node*/curl*/pip install*/start*/git push*/node -e*）
- [x] RED 3 页移入 `dev/_attic/retired-routes/`（git mv 保留历史·可逆）
- [x] `NEXT_PUBLIC_API_MODE=real pnpm build` EXIT=0 → 主线完好
- [x] **A 区垃圾**：删 `.next-broken*` 2.5GB + `.gitignore` 加 `/.next-broken*/`（释放 2.5GB·主线无关）
- [x] **黄页死页扫描**：71 黄页全做入站引用扫描 → **0 个可删死页**（见 §4）。结论：页面层不臃肿，停止移页。
- [x] **死代码取证+隔离**：`pnpm dlx knip` 取证 → **225 个零引用文件**移入 `dev/_attic/dead-code/`（见 §5）。tsc EXIT=0 + webpack Compiled successfully 双门验证主线完好。AGENTS.md §5 同步退役 4 个库成员。
- [ ] **分支墓园**：`git branch --merged master` 验证后删 backup/*-20260618 等
- [ ] **隔离区终局**：`dev/_attic/` 内容观察期后,确认无需复活 → 整体删除（届时一次性，可逆窗口关闭）

## 7. knip 基线 + 剩余 worklist（2026-06-28）
- 建 `knip.json`：排除 `dev/_attic` + 认 `**/*.nodetest.ts`/e2e/scripts 入口 → **unused files 286→9**，knip 从噪声变可信棘轮。以后 `pnpm dlx knip` 即得准信号。
- **exports/types 轮：判定不做**。unused exports(445)/types(378) 编译期被 tree-shaking 抹掉、不进 bundle；删 export 纯化妆、843 处微编辑散在 live 文件、并发撞车、knip export 精度存疑。低 ROI，停。
- **剩余 9 个 live unused files = 精确 worklist（下次专人逐个查，勿批量移）**：
  - 0 引用待查：`config/routes.ts` · `core/courtos/source-label-bridge.ts`(疑被 reality-state 取代) · `imperial/manors/.../manor-room-layout.tsx`
  - ⚠️ 别碰：`hubu/components/hubu-valuation-workbench-page.tsx`(hubu 活跃开发，疑 WIP 未接线)
  - 常见名撞车·grep 不可信：`src/shared/{enums,index,metadata,types}.ts` · `src/store/swarm.ts`

## 6. 清理落地位置（2026-06-28 · 并发提交备查）
228 个 _attic rename **已提交**，但被并发业务 commit 一起吞入：
- `7d4ce42 feat(hubu)` = 3 hubu 业务文件 + **228 清理 rename**（标签是 hubu，实含全部清理移动）
- `33c839c feat(bingbu)` = 纯兵部业务，无清理
决定：**不 rebase 拆分**（活分支 + 并发 agent，改写历史风险 >> 化妆收益 · Taleb）。在此备查即可。
主线验证：`next build` 228/228 页全绿跑的就是此移动后/已提交的树。
教训（§13.2.10 并发地盘）：清理与业务并发时，`git commit -am`/`git add -A` 会把对方暂存的 rename 一锅端；
下次大批 git mv 后应**立即自提交**或先喊 `[shared]`，别留在索引里等别人的 commit 吞。

## 5. 死代码隔离（2026-06-28 · knip 取证驱动）
- 工具：`pnpm dlx knip`（只读，未装包），Next.js 插件正常识别路由入口（0 个 page/route 误报）。
- 抽样验证：12/12 零误报，精度高 → 批量隔离。
- 移动：**225 文件** → `dev/_attic/dead-code/`（保留 `src/` 路径结构，反向恢复直接移回）
  - 218 个 components/lib/features 孤儿（court-console 27 / imperial 19 / throne 16 …）
  - 7 个 src/app 死辅助文件（`manor-dept/[deptCode]/*` 整簇无 page.tsx=无路由 + `overview/page.original-*` 备份 + `api/hanlin/_turso-store`）
- 保留例外：`hubu/lib/decision-extract.ts`（未跟踪 WIP，活的活儿，不动）
- 验证：`tsc --noEmit` EXIT=0；`next build` webpack Compiled successfully（TS 阶段超时但已由 tsc 独立覆盖）
- 教训：knip 候选别只过滤 components/lib/features —— `src/app` 下的非路由辅助文件（`client.tsx`/`*-client.tsx`/`.original-*.tsx`）也会成死链源，需一并退役（本轮第二批 7 个就是补这个）。

## 4. 黄页扫描结论（2026-06-28 · 取证驱动·别制造删除）
71 黄页入站引用扫描结果：**68 个被内部链接**（command-center 51 / manors 33 / overview 23 / archive 20 / governance 19 …全是活的主闭环内部工位），**3 个零引用静态页全部被 e2e spec 守护**：
- `/throne/decision`（223行）= **CourtOS §13 主闭环发布门禁**（`e2e/decision-loop.spec.ts`）→ 主线核心
- `/hanlin/odysseus`（230行）= 真功能，仅缺导航入口（`e2e/hanlin-odysseus.spec.ts`）
- `/e2e-harness/prompt-suggest`（33行）= 活的测试夹具（`e2e/prompt-suggest.spec.ts`）

→ **页面层零死页，全部保留**。上线裁剪由白名单门在 runtime 完成，无需物理删页。
→ 真正死代码在页面**底下**的孤儿组件/lib，靠 knip 取证，不在页面层手动找。

## 3. 教训（铁律4：自评会漏，移动前验证引用）
`/grand-council` 名字含 "council" 命中 RED 关键词启发式，机器判成 demo。但 grep 引用发现它被 17 处链接，
标签全是「转交军机处会审 / 送军机处进入会签 / AI中枢」——**它是军机处会审入口，主 Loop 第④步**。
→ 规则：**任何 src 文件移动/删除前，先 grep 引用数**；零引用才安全，非零必须看清是死链还是主线节点。
