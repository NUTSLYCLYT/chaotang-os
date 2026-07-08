# chaotang-web-lyt/AGENTS.md — Harness L1 Frontend Memory

> This file is the L1 entry for agents working in `chaotang-web-lyt`. It is now a Harness map first, with historical production rules preserved below as authoritative local law.

## Harness Entry

Start here for every material change:

1. Read `.harness/agents/frontend-owner.md`.
2. Read the relevant rules under `.harness/rules/`.
3. Check active work under `.harness/changes/`.
4. Use `pnpm harness:new-change <type> <short-name>` for new work.
5. Run `pnpm harness:doctor` before and after Harness/documentation changes.

## Harness Map

| Area | Path |
| --- | --- |
| Owner / orchestration | `.harness/agents/frontend-owner.md` |
| Product boundaries | `.harness/rules/product-boundaries.md` |
| Project structure | `.harness/rules/project-structure.md` |
| Coding standard | `.harness/rules/coding-standard.md` |
| 11-stage workflow | `.harness/rules/dev-workflow.md` |
| Architecture facts | `.harness/wiki/architecture.md` |
| Domain model | `.harness/wiki/domain-model.md` |
| API contracts | `.harness/wiki/api-contracts.md` |
| Document index | `.harness/wiki/document-index.md` |
| Release operations | `.harness/wiki/release-operations.md` |
| Change audit trail | `.harness/changes/` |

## Non-Negotiable Summary

- Product name: 朝堂OS. `CourtOS` is an internal kernel/protocol, not a third product line.
- Frontend-owned work stays here: pages, UX, direct backend contract adapters, browser tests, release gates.
- Backend swarm truth stays in `jiqun_ai`.
- Capability truth must be explicit: LIVE / MIXED / DEMO.
- Ports: dev 3002, production 3050, never 3001.
- High-risk work needs review plus a regression assertion: auth, tenant isolation, privileged writes, source labels, real-data claims, release gates, and decision-weighting UI.

## 2026-07-08 BFF Retired Boundary

Frontend no longer owns a BFF layer. Do not add or restore `src/app/api/**` route handlers for runtime behavior, including temporary proxy endpoints under `/chaotang/api/**`.

Runtime data must connect to explicit backend services, primarily `jiqun_ai`, through documented contracts and environment-controlled base URLs such as `JIQUN_API_URL`, `NEXT_PUBLIC_JIQUN_API_URL`, and `NEXT_PUBLIC_CHAOTANG_API_URL`.

When a local frontend on 3002/3003 appears disconnected from backend 8081, fix the dev-server environment, backend CORS/auth contract, or documented client adapter. Do not reintroduce a frontend BFF as the integration path.

## Historical Rules

The following sections are preserved from the pre-Harness AGENTS.md. They remain binding unless superseded by a more specific `.harness/rules/*` file.

# chaotang-web-lyt/AGENTS.md — 前端规则

> 进入 `/home/ubuntu/workspace/frontend/chaotang-web-lyt` 工作目录前先读这里。本仓是朝堂 web lyt 前端主仓，不是 `chaotang-os`，也不是旧 `apps/web` worktree。
> 每次纠错后追加规则，让 agent 越用越聪明。

---

## -1. 主仓锚点（最高优先级，禁止漂移）

当前已经确认的两个主仓只有这两个：

| 角色 | 本机路径 | remote |
|---|---|---|
| 前端主仓 | `chaotang-web-lyt` | `git@gitee.com:msxn/chaotang-web-lyt.git` |
| 后端 jiqun 主仓 | `jiqun_ai` | `git@gitee.com:msxn/jiqun_ai.git` |

硬规则：

- ✅ 本节对 Claude Code、Codex、Claude Desktop、子 agent、脚本化 agent 全部适用；任何工具不得绕过主仓锚点。
- ✅ 前端、页面、Next.js、浏览器验证、Web 发布门禁，只在 `chaotang-web-lyt` 做。
- ✅ 后端、蜂群、agent、flow、prompt、provider、数据库、真实运行逻辑，只认 `jiqun_ai`。
- ❌ 不要漂移到 旧 `apps/web` worktree、`chaotang-os`、`court-agent-os` 或其它历史目录继续开发。
- ❌ 搜到旧目录里的相似代码时，只能当历史参考；没有明确指令，不要在那里改代码、跑主验证、提交或合并。
- ✅ 每次涉及仓库判断，先用 `pwd`、`git remote -v`、`git branch --show-current` 确认自己仍在上述两个主仓之一。

如果任务需要跨前后端，只能在这两个主仓之间切换；发现第三个“看起来像主仓”的目录，先停下来按本节纠偏。

---

## -0.5 master 统一政策 + 并发 agent 协调（2026-07-04 立，大神会审沉淀）

用户明确要求：所有分支最终收敛进 `master`，以后不再长期分叉；本仓当天已实测存在
**4 个 worktree + 4 个独立 Claude 进程同时在跑**(`chaotang-web-lyt` 主目录、`libu-wt`、
`chaotang-master-wt`、`xingbu-wt`)，彼此互不感知，是"多进程共享同一状态、互不协调"
的高风险模式(与 dev/prod 共享 `.next` 目录导致 8 小时故障同一类病根)。

硬规则：

- ✅ 功能分支阶段性稳定后，应推进合并回 `master`，不要让多个功能分支无限期分叉存在。
- ✅ 涉及"要不要推送/合并到 master"时默认倾向"是"，但仍必须走完整验证(tsc/test:core/build)
  再动手，见铁律4。
- ✅ 开工前先跑 `git worktree list` 摸清楚当前有几个并发工作区；发现别的 worktree 里有
  未提交改动，那是别人的在制品，不碰、不覆盖。
- ✅ 每个 worktree 只在自己的分支/目录内做验证性 build(`NEXT_DIST_DIR=` 隔离，见 §0 端口纪律
  的姊妹规则)，不共享 `.next`，也不要用同一个隔离目录名互相踩(如 `.next-buildcheck` 被
  多人反复复用又变成过期缓存挡下一次 build，遇到就 `mv` 挪走不要 `rm -rf`)。
- ❌ 不要假设"我看到的分支列表就是全部"——同一仓库随时可能有别的 agent/session 正在推
  新分支或直接推 master，先 `git fetch` 再判断。
- ✅ **一个 agent 一个 worktree，别串门（2026-07-06 立，charity-majors 沉淀）**。每个工作区已配
  独立 git 身份（`extensions.worktreeConfig` + 各 worktree `git config --worktree user.name`）：
  主 checkout=`NUTSLYCLYT`(人手动)、libu-wt=`agent-libu`、xingbu-wt=`agent-xingbu`、
  master-wt=`agent-release`、临时/新 worktree fallback=`agent-claude`。开工先待在自己的 worktree，
  别把某 agent 拉进别人的 checkout 干活——否则它的提交会冒别人的名，`git blame` 归因当场退化。
  病根案例：2026-07-06 多个 Claude session + 人共用 `NUTSLYCLYT` 全局身份，同事把 AI 的改动当成"你改的"。

### -0.5.1 生产工位钉死在 chaotang-master-wt（2026-07-04 立，大神会审沉淀）

`/home/ubuntu/workspace/frontend/chaotang-master-wt` 是**唯一的、永久的生产 worktree**，
`courtos-web.service`(systemd --user，端口 3050)的 `WorkingDirectory` 指向这里。这不是临时
安排——大神会审判定：与其"合并回一个目录"重新制造 dev/prod 共享状态的病根(8 小时故障同一类)，
不如反过来把独立 worktree 的隔离性钉死成永久架构，降低认知负担的方式不是"目录数量最少"，
是"规则最简单"("生产那个谁都别碰"比"记住今天谁在哪个目录干什么"更简单)。

硬规则：

- ✅ 生产只认 `chaotang-master-wt`：`git pull` + `pnpm prod:rebuild`(或手动 build→
  systemctl restart→烟测)，永远不在这里跑 `pnpm dev`、不切别的分支、不留 WIP。
- ✅ 主目录 `chaotang-web-lyt` 和 `libu-wt`/`xingbu-wt` 等其它 worktree 一样，只是众多
  **开发工位之一**，谁都能在里面随便切分支、跑 dev、留改动——它不再背着生产风险。
- ✅ 任何"要不要合并回一个目录"的冲动，先想这条规则解决的是什么问题：不是目录数量，
  是"避免开发中的副作用(切分支/跑 dev/装依赖)不小心影响生产"。多 worktree 只要规则清楚
  (谁是生产、谁是开发)，比一个目录风险更低。
- ❌ 不要把 `chaotang-master-wt` 的 WorkingDirectory 改回主目录，除非明确要撤销这个决定
  (见 `/tmp/courtos-web.service.backup-*` 有原始版本可回滚)。

---

## 0. 端口纪律（最高优先级，违反 = 把生产打挂）

**Next.js 端口分配**：
| 用途 | 端口 | 启动命令 |
|------|------|---------|
| **Production** | **3050** | `pnpm start` 或 `next start -p 3050` |
| **Dev (HMR)** | **3002** | `pnpm dev` |
| ~~3001~~ | 弃用 | ❌ 禁止任何进程绑定 |

`nginx (~/.local/nginx-app/nginx.conf)` 的 upstream **指向 3050**，公网 `app.mingshuoxny.com/chaotang` 通过它对外暴露。

**禁令**：
- ❌ 不要执行 `next dev -p 3001` / `next dev -p 3050` —— 会把生产顶掉
- ❌ 不要手写 `next start -p <其他端口>` —— nginx 找不到 upstream
- ❌ 不要在 `package.json` 的 `dev`/`start` script 里改回 3001
- ✅ 需要本地热重载 → `pnpm dev`，访问 `http://localhost:3002/chaotang/...`
- ✅ 修生产代码 → 改完 `pnpm build && pnpm start`，nginx 自动接上

如果端口被占（启动失败），**先 `ss -tlnp | grep :3050` 看谁占的、问清楚再杀**，不要默默 `kill -9`。

## 0.0 主线仓职责边界（最高优先级）

本仓只承接 **前端 / 网站 / 页面体验 / 浏览器验证 / Web 发布门禁**：

- ✅ 页面、组件、样式、导航、仪表盘、首屏体验、移动端适配。
- ✅ Next.js BFF/API 适配层，只限服务前端页面与发布健康检查。
- ✅ Playwright、Chrome DevTools、截图、E2E、`npm run build`、prod doctor、final release harness。
- ✅ 朝堂 Web 的 UI 状态：红黄绿、下一步、证据边界、任务入口、史馆/军机处/部门页展示。
- ❌ 不在本仓改 `jiqun_ai` 的 flow、prompt、provider、数据库、agent 运行逻辑、commercial-loop harness。
- ❌ 不把后端蜂群质量修复混进前端提交。
- ❌ 不用前端 mock 分数证明后端 agent 已可用。

如果任务本质是蜂群、agent、flow、harness、真实客户样本、质量基线，回 `/home/ubuntu/fe/fengQun/jiqun_ai_fresh`。
如果任务本质是产品设定文档，只读参考 `/home/ubuntu/court-agent-os`，不要在这里复制第二套规则。

## 0.0.1 一个项目整体与 CourtOS 命名（最高优先级）

当前只有一个项目整体，主线名称定为：**朝堂OS**。前端体验线和后端蜂群线只是同一个项目里的两条工程责任线，不是两个产品，更不是分裂路线。

| 工程责任线 | 主仓 | 职责 |
|---|---|---|
| 前端体验线 | `/home/ubuntu/workspace/frontend/chaotang-web-lyt` | 朝堂OS 前端 / weblyt：页面、体验、BFF、浏览器验证、发布门禁 |
| 后端蜂群线 | `/home/ubuntu/fe/fengQun/jiqun_ai_fresh` | jiqun_ai：真实蜂群、agent flow、prompt、provider、数据库、重产线执行 |

`CourtOS` **永远不作为第三条产品线 / 项目线 / 仓库主线**，也不是另一个前端产品名。它已经被吸收为朝堂OS 这个整体项目里的内部决策内核 / 协议名：

- ✅ 前端可保留 `src/core/courtos/**`、`/api/court/**`、loop、harness、sourceLabel、risk gate、archive learning 等内部命名。
- ✅ 后端可把 CourtOS 语义吸收为蜂群执行契约、flow 支撑、归档/证据/风险门字段。
- ✅ 对外用户叙事优先说“朝堂OS / 朝堂 / 上书房 / 军机处 / 史馆 / 六部 / 庄园”。
- ❌ 不再给 CourtOS 单独开路线图、产品线、项目线、仓库主线或第三套规则。
- ❌ 不用 CourtOS 名义新建第二套奏折、第二套质门、第二套 runtime。

遇到“CourtOS vs weblyt vs jiqun”判断时，默认答案是：**朝堂OS 是一个项目整体和主线名称；weblyt 和 jiqun 是工程责任线；CourtOS 是被前后端共同吸收的内部内核/协议名，不能被拆成第三线。**

## 0.0.2 庄园 / 蜂群 / 六部路由语义（最高优先级）

- ✅ `/manors` 是**庄园主页**，也是当前最新的**蜂群主页 / 蜂群执行中心**。涉及“蜂群主页、庄园蜂群、蜂群聚集地、蜂群执行中心”的前端入口，优先认 `/manors`。
- ✅ `/manors/[domain]` 与 `/manors/[domain]/swarm` 是庄园下钻与庄园蜂群二级页；只有接入对应执行数据的 domain 才应可进入。
- ❌ `/departments/personnel` 这类 `/departments/*` 是**六部业务逻辑页**，不是蜂群主页，也不要把它当作庄园蜂群入口。
- ✅ 六部可以作为庄园/蜂群调用的业务能力域，但页面语义上属于部门业务逻辑；蜂群的主舞台仍在 `/manors`。

## 0.1 开发主目录纪律（最高优先级）

本仓开发过程文件统一收束到 `dev/`，不要继续把临时文档、截图、发布包、审查记录散落在根目录。

根目录只保留框架和工具链必须在根层识别的入口文件：

- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`
- `next.config.ts` / `tsconfig.json` / `postcss.config.mjs` / `playwright.config.ts`
- `README.md` / `AGENTS.md` / `CLAUDE.md`
- `.gitignore` / `.npmrc` / `.github/`
- `src/` / `public/` / `scripts/` / `e2e/` / `tests/` 等当前代码和测试主目录

新增开发文件默认放在：

- `dev/notes/`：临时分析、会审、上下文恢复记录。
- `dev/handoffs/`：跨 agent/跨天交接。
- `dev/release/`：发布检查清单、安装包说明、上线记录。
- `dev/artifacts/`：构建包、临时证据、机器产物，默认不入库。
- `dev/screenshots/`：浏览器截图和视觉验收产物，默认不入库。
- `dev/tmp/`：一次性 scratch，默认不入库。

已有历史目录先不大规模搬迁；迁移必须单独开 PR，并同步修改脚本、CI、文档引用和验收命令。
从现在起，除非是框架约定或已有主目录内的源码/测试文件，不要在仓库根层新增散文件或新临时目录。

## 0.2 大神 advisor 与 skill 调度

每个实质任务至少配两位相关 advisor 视角，并按真实板块选 skill/工具/验收方式。主索引见：

- `docs/CHAOTANG_WEB_LYT_ADVISOR_SKILL_SYSTEM.md`

默认流程：

1. 产品/规划先用 `gstack-office-hours` 思路压目标，再用 `gstack-autoplan` 思路拆最小可交付。
2. 朝堂跨板块任务先用 `chaotang-product-system-panel` + `chaotang-panel-maturity-rubric`。
3. 网站/UI/美工任务先用 `website-design-panel`，并用真实浏览器截图验证。
4. 实现任务先明确测试或验收，再改代码，再做 review/QA/security/release gate。

---

## 1. 这不是你训练时的 Next.js

**Next.js 16，breaking changes 很多**。API、约定、文件结构都可能与你的训练数据不一样。
写代码前先看 `node_modules/next/dist/docs/` 里的对应指南，注意 deprecation。

已知差异：
- App Router 是默认，不是 Pages Router
- `next/font` 注入在 `<html>` 上的 4 个 CSS 变量已固定（见第 3 节）
- `output: 'standalone'` 模式启动用 `node node_modules/next/dist/bin/next start -p N`，不要用 `next start`（会有警告但能跑）
- Tailwind 4 用 `@theme` 块（在 `globals.css` 里），不在 `tailwind.config.ts` 里写颜色

---

## 2. 视觉资产是 B 系统冻结的（禁改）

- ❌ 不重写 `src/app/globals.css`（727 行，B 全量搬运）
- ❌ 不重写 `src/lib/design/design-tokens.ts`（colors / agentColors 11 codes / motion）
- ❌ 不修改色板 hex 值（帝金 `#F0C66A/#D4A84B/#8A6A2A` 等）
- ❌ 不改 18 个 keyframe 的 timing 或字段
- ❌ 不改启动动画时序：`SCENE_DURATIONS = [2600, 3000, 3200, 3500, 3900, 6300]` ms

需要新视觉？先去 `docs/migration/02-design-tokens.md` 找有没有现成 utility class 或 token。

### 已注册的 12 个 utility class（globals.css 直接用）
```
.gold-text          帝金渐变文字（135deg）
.display-serif      Noto Serif SC + 0.02em letter-spacing
.page-eyebrow       10px / 0.22em / uppercase / #8f835f
.page-title         24px 帝金渐变 / serif
.page-title-plain   24px 米色 / serif
.page-meta          11px / #b6ab8c
.section-eyebrow    10px / 0.18em / uppercase
.section-title      16px / 米色 / serif
.body-copy          13px / 1.85 line-height / #c6bb9d
.metal-edge         金属渐变描边（gold → blue）
.hud-corner         金线角标（::before/::after 12×12px）
.animate-{breathe,pulse-glow,rotate-slow,fade-in-up}
```

### 18 个 keyframe（不要重新声明）
通用 7 个：`breathe / blink / fadeIn / pulse-glow / rotate-slow / shimmer / fade-in-up`
intro 11 个：`intro-breathe / intro-gold-pulse / intro-copy-shell-in / intro-kicker-in / intro-headline-in / intro-headline-sheen / intro-body-in / intro-particle-converge / intro-dust-float / intro-dna-helix / intro-destiny-bloom`

---

## 2.1 朝堂统一 UI/UX 排布（最高优先级，2026-06-30 立）

所有新增页面、改版页面、弹层、仪表盘、工作台和移动端适配，必须和朝堂OS 当前整体风格统一；不要给单页另起一套 UI/UX 语言。

统一标准：

- ✅ 视觉气质：深色宫廷科技底、帝金主强调、米色正文、青/蓝/红只做状态或部门辅助色；优先复用 `globals.css` utility class、`GlassPanel`、`PageHeaderShell`、`StatusPillButton`、`SignalPulseDot` 等现有组件。
- ✅ 排布骨架：优先沿用“上书房 / 户部 / 军机处”架构，即顶部身份与流程条、中间核心卷轴或主工作面、左右两翼信息/行动面板、底部命令区；页面不是营销落地页，不做孤立大卡片堆砌。
- ✅ 信息表达：默认说“我们做什么、提升什么、降低什么、带来什么价值”，不要把主文案写成一堆“支持问题/你可以问”；严重紧急风险可以一针见血红色警示。
- ✅ 交互语义：卷轴用于核心纪要/分析/裁决，左右翼用于证据、分歧、团队、闭环、下一步；按钮必须对应真实动作或明确标注不可用/待接入，不能只做装饰。
- ✅ 跨页面一致：六部、庄园、史馆、上书房、军机处的卡片密度、标题层级、状态标签、操作按钮、空态/错误态要保持同一体系；新增页面先找最接近的已落地页面复制排布逻辑，再按业务细化。
- ❌ 不新增紫蓝渐变 SaaS 风、白底通用后台、营销 hero、大圆角卡片海、随机插画、独立图标体系或与朝堂视觉无关的组件库风格。
- ❌ 不为了“显得丰富”把内容塞满。核心信息必须先形成卷轴/主工作面，附属信息才进两翼；移动端优先保留核心卷轴，再顺序展开两翼。

验收口径：视觉类改动必须浏览器截图；截图里一眼应看出这是朝堂OS，而不是普通 AI dashboard。若与户部/上书房/军机处排布不一致，必须在 PR/交接里说明为什么需要偏离。

---

## 3. 字体注入（layout.tsx 已配，不要改）

```ts
// src/app/layout.tsx 顶部已 import:
import { Inter, Noto_Sans_SC, Noto_Serif_SC, JetBrains_Mono } from 'next/font/google';
```

4 个变量挂在 `<html>` 上：
- `--font-inter`（拉丁主字体）
- `--font-noto-sans-sc`（中文 sans，weights 400/500/600/700）
- `--font-noto-serif-sc`（中文 serif，weights 400/600/700）
- `--font-jetbrains-mono`（mono）

`globals.css` 已经声明 `--font-sans / --font-serif / --font-mono` fallback 链消费这 4 个。
**新组件不要自己 import next/font**，直接用 `font-family: var(--font-sans)` 即可。

---

## 4. 类型契约（`src/lib/contracts/` 是 SoT）

```
src/lib/contracts/
├── agent.ts        # 11 codes Tier 0 + AGENT_META 注册表
├── task.ts         # 11 状态机 + LEGACY_TASK_STATUS_MAP
├── swarm.ts        # A 兼容层（A 当前后端用的字段）
├── judgement.ts    # 御座总判断
├── events.ts       # 5 个 WebSocket 事件 payload
├── async-state.ts  # AsyncState<T> 五态联合
└── schemas.ts      # 全部 Zod schema（runtime 校验）
```

新代码必须从这里 import 类型：
```ts
import type { SwarmUnit, SwarmOverview } from '@/lib/contracts/swarm';
import type { Judgement } from '@/lib/contracts/judgement';
import { ZSwarmUnit, ZApiEnvelope } from '@/lib/contracts/schemas';
```

`src/lib/types.ts` 已标 `@deprecated`，phase 5 后删除。**不要新增引用它**。

### 类型陷阱
- ❌ `'waiting_dependency'` 是 `AgentState`，**不是 `TaskStatus`**
  - LEGACY_TASK_STATUS_MAP 里 A 的 `blocked` 映射到 `running`，不是 waiting_dependency
- ❌ `SwarmMember.id` 必填，**没有 `agentId` 字段**了。旧代码 `m.agentId ?? m.id` 全部改成 `m.id`
- ❌ `DeptStatus` 不再带 `[key: string]: unknown` index signature，下游组件不要假定有额外字段

---

## 5. 已有组件清单（不要重复造）

```
src/components/
├── GlassPanel.tsx          # 5 variant × 3 tone + hudCorners + glow
├── SignalPulseDot.tsx      # 多层环 + 核心点
├── EnterStagger.tsx        # 列表入场（cubic-bezier(0.16,1,0.3,1)）
├── NumberCounter.tsx       # 数字滚动
├── StatusPillButton.tsx    # 状态药丸按钮
├── DataState.tsx           # loading/empty/error 三态
├── PageHeaderShell.tsx     # 页面头壳
└── Pulse.tsx               # 呼吸光晕（subtle/normal/strong 3 强度）
```

> 2026-06-28 死代码清理：`GlobalInteractionBar / ContextSidePanel / AudienceDrawerTrigger / ProfessionalEntryDrawer`
> 经 knip 取证全仓零引用，已退役至 `dev/_attic/dead-code/`（可逆 git mv）。如需重新启用，从隔离区移回即可。
> 清理台账见 `dev/notes/surface-cleanup-map.md`。

新页面优先复用这些。依赖纪律（2026-06-02 对齐代码现实校正）：
- ✅ `lucide-react` **已是事实标准，可用**（全仓 ~200 文件在用，已在 deps）。~~旧规则"禁用 lucide"已作废~~——之前的禁令与现实背离，按实际放行。
- ❌ 仍不要新装 `motion/react`：动画统一用 `framer-motion`（import 是 `'framer-motion'`，仓内现状）
- ❌ 仍不要新装 `@radix-ui/*` / `shadcn-ui`（用现有简单 div + Tailwind）

---

## 6. 路由约定（来自 docs/migration/01-golden-flow-map.md §1）

### 已落地（9 个路由）
```
/              → 307 → /intro
/intro         22.5s 启动动画（fixed positioning 覆盖 Nav）
/enter         3-phase 令牌核验
/onboarding    实例创建表单
/throne        御座主厅
/prime         丞相台
/swarm         蜂群总览
/swarm/[unit]  蜂群详情
/archive       史馆归档
```

### 待建（22 个 to-build，按 phase 推进）
- `/agent/[code]` × 11（phase 4 后端就绪后）
- `/task/[id]/{,plan,runs,report}` × 4（phase 5 状态机就绪后）
- `/throne/{compose,brief/[taskId],help}` × 3
- `/swarm/[unit]/{members,output}` × 2
- `/archive/[id]`、`/settings`、`/settings/audit`

---

## 7. 全屏页面如何绕过 layout.tsx Nav

`layout.tsx` 有全局 `<Nav />` 浮于 z-50 + `<div className="pt-12">` 给 nav 留位。
启动流页面（`/intro` `/enter` `/onboarding`）需要全屏沉浸，**不要改 layout.tsx**。

正确做法：page 的 main/root 用 inline style 覆盖：
```tsx
<main style={{ position: 'fixed', inset: 0, zIndex: 100, ... }}>
```

z-100 > nav 的 z-50，盖住即可。这是 phase 2 已采用的模式。

---

## 8. 数据获取约定

- 所有数据请求走 `swrFetcher` 从 `@/lib/api`，不要直接 `fetch`
- 同源请求（next.js dev rewrites）：`/api/v1/...`
- WebSocket 用 `getSocket()` 从 `@/lib/socket`，事件名常量见 `src/lib/contracts/events.ts` 的 `SOCKET_EVENTS`

```ts
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';
const { data, error, isLoading, mutate } = useSWR<SwarmUnit[], Error>(
  '/swarms',
  swrFetcher<SwarmUnit[]>,
);
```

`onRetry` 必须接 `mutate`，错误状态才能恢复（见各 page.tsx 的现有写法）。

---

## 9. 验证步骤（每改一行 tsx 都要跑）

```bash
# 1. 当前主仓跑 TypeScript
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
pnpm exec tsc --noEmit

# 2. Next.js typecheck/build，更严，必跑
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
pnpm build

# 3. 浏览器验收（视觉类必跑）
pnpm dev
# 访问 http://localhost:3002/<route>
# QA 可加 ?skipOnboarding=1 避免首次引导遮挡截图
# 用 Playwright 或 Chrome DevTools 截图/交互验收
```

**Next.js typecheck 比 root tsc 严**。能过 root tsc 不代表能过 build。

---

## 10. 浏览器服务管理

```bash
# 查看端口占用；不要未确认就杀进程
ss -tlnp | grep ':3002\|:3050' || true

# 启动 dev（热重载）
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
nohup pnpm dev > /tmp/chaotang-web-lyt-dev.log 2>&1 &
disown

# 等待就绪
sleep 5; ss -tlnp | grep :3002
```

生产启动使用 `pnpm start`，端口固定 3050。不要用 dev 服务顶生产端口。

---

## 11. 经验教训（每个错误一条规则）

- ✅ B 用 `'motion/react'`，A 用 `'framer-motion'`，import path 不一样
- ✅ B 用 `lucide-react` icon，A 没装。用 emoji 或 inline SVG 替代
- ✅ B 的 `AuthShell` / `client-auth` 是 B 独有的内部组件，**不要 cargo cult**，需要的能力直接 inline 写
- ✅ Tailwind 4 的 `@theme` 块在 `globals.css`，不在 `tailwind.config.ts`
- ✅ 启动流页面用 fixed positioning 覆盖 Nav，**不要改 layout.tsx**
- ✅ `src/lib/types.ts` 已 deprecated，新代码从 `src/lib/contracts/*` import
- ✅ `SwarmMember.id` 必填，没 agentId 字段了
- ✅ `m.agentId ?? m.id` 全部改成 `m.id`
- ✅ `next.js build typecheck > tsc --noEmit`，每改 tsx 必须跑 `pnpm build`（舱根 `/home/ubuntu/workspace/frontend/chaotang-web-lyt`，本舱是单包不是 apps/web）
- ✅ Bash cwd 不持久化，重启 web 用绝对路径 + nohup + disown
- ✅ 端口纪律：dev=3002 / prod=3050，3001 禁用（§9/§10 已校正为本舱实况，勿用旧 worktree 路径）
- ✅ `lucide-react` 是事实标准，可用（~200 文件在用，已在 deps）；旧"禁用 lucide"规则已作废（见 §5）
- ✅ 双门鉴权：当前服务端 `src/middleware.ts` 认 cookie `courtos.access_token`（仅查存在、不校验值；Next 16 后续需迁 `proxy`）+ 客户端 `AuthGate` 认 localStorage `courtos.auth`。写 E2E 要两道都喂（cookie + localStorage 种子）
- ✅ E2E 范式见 `e2e/swarm-members.spec.ts`：`page.context().addCookies` 种 cookie + `addInitScript` 种 session + `page.route` mock 三态，无需后端
- ✅ 新页面必带 E2E spec（照成员页范式），向 80% 覆盖爬
- ✅ 上书房数据闭环：`briefing.sourceMode === 'unavailable'` 只能表示主库真正不可达，不能用本地骨架冒充真实朝报；所有下旨/dispatch/orchestrate 路径必须先写入同一主库 `tasks`，再由 `/api/court/shangshufang/briefing` 和 `/api/court/backend/tasks/[id]` 读回同一 `taskId` 验证闭环。本地开发缺 `TURSO_DB_URL` 时用持久化 `file:./.chaotang-main-dev.db`，来源标 `primary`，不要硬标 `turso`。
- ✅ `package.json` 的 npm scripts 必须跨平台；Windows/npm 不支持 `BASE_PATH=/chaotang next ...` 这种 POSIX 环境变量前缀，Next 入口统一走 `node scripts/next-with-base-path.mjs ...` 注入 `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH`。
- ✅ 路由语义纠偏：`/manors` 是庄园主页 + 最新蜂群主页；`/departments/*`（如 `/departments/personnel`）是六部业务逻辑页，不是蜂群主页。
- ✅ 锦衣卫世界地图必须用真实地图底图（Web Mercator / OSM tiles / 可审计地图服务）并保留 attribution；禁止再用手绘大陆 path、`public/world-map.svg` 或装饰 SVG 冒充真实地图。

---

## 12. 大神视角：默认带（用户偏好，2026-06-04 二次确认）

**每次实质性 / 决策类回答尽量带一行 `🎲 大神视角`**（全局定义见 `/home/ubuntu/AGENTS.md` 的“大神视角 / 天才建议 / 天才设计”）：
用最相关大神（战略大神优先）的镜片一句话点出最该警惕处；遇设计取舍再附一个天才设计建议。
仅琐碎确认 / 纯回报 / 事实查询可省，别制造噪声。此外仍由这些触发：
1. **用户点名**："上大神 / XX 会怎么看"。
2. **提示词关键词**：提到某大神招牌词（"威胁建模""可观测性""第一性原理""做减法"），对应 skill 自动激活。
3. **真·单向门决策**：不可逆 / 烧钱 / 难撤的取舍，主动附 `🎲`（必要时直接拉会审）。

### 大神视角格式（2026-06-04 升级）

每次大神视角必须包含两段，缺一不可：

```
🎲 大神视角（[大神名]）
⚠️ 警示：[一句话点出最该警惕/最被低估的风险或盲点]
💡 天才建议：[一条反直觉、高杠杆的具体可执行动作，不是废话建议]
```

- 警示：说别人看不到的危险，不说显而易见的废话
- 天才建议：必须足够具体（能马上去做的），要有点"疯"——正常人不会第一时间想到
- 大神要匹配：技术决策选 karpathy/charity-majors，产品选 jobs，战略选 munger/taleb，营销选 seth-godin

**蜂群任务触发**：重大会审用 `Workflow({ name:'persona-panel', args:'...' })`——从全 54 位名册自动选 5
（已固化"每审 ≥1 战略大神"），或 `args.personas` 手动点名差异化阵容。

### 核心 6 人（日常默认只想到这 6 个）
`karpathy`(AI系统) · `charity-majors`(可靠性/可观测) · `bruce-schneier`(安全/红队) ·
`zhangxiaolong`(产品减法) · `jeff-bezos`(战略/单向门) · `deming`(质量闭环/outcome)
> 其中 charity-majors / schneier / 张小龙 是当前盲区，最该长进脑子。

### 10 位备选（特定时刻才拉，每位钉一个触发条件）
| 何时拉 | 备选大神 |
|---|---|
| 动评测 / 数据飞轮 / judge 可靠性 | `andrew-ng` |
| 重开 agent 编排 / 记忆 / 工具调用架构 | `harrison-chase` |
| 重新质疑"单 agent vs 真蜂群"涌现 | `eo-wilson` |
| 让 agent **自动执行**、担心对齐/失控 | `stuart-russell` |
| 设计呈现/界面、怕用户误判 | `daniel-kahneman` |
| 押一个不可逆大赌注前过尾部风险 | `taleb-perspective` |
| 重大决策找盲点 / 逆向 / 认知偏误 | `munger-perspective` |
| 产品品味 / 聚焦取舍关键时刻 | `jobs` |
| "我们到底在做什么生意" / 组织怎么带 | `drucker` |
| 长期研发投入 / 熵减 / 危机意识 | `ren-zhengfei` |

### 8 蜂群 × 2 固定大神（常驻对——上面 16 位重排，每对一组张力，成对才有交锋）
| 蜂群 | 常驻二人 | 张力(为何成对) | 何时点火 |
|---|---|---|---|
| AI 系统工程 | `karpathy` + `andrew-ng` | 建造者 × 验证者 | 搭/改 agent、抽象层、评测 |
| 生产可靠 | `charity-majors` + `deming` | 看得见 × 持续改 | 上线、观测、防退化 |
| 安全对抗 | `bruce-schneier` + `stuart-russell` | 防外敌 × 防自身失控 | 鉴权、注入、**自动执行授权** |
| 产品克制 | `zhangxiaolong` + `jobs` | 双减法互校准 | 加/砍功能、呈现 |
| 战略高度 | `jeff-bezos` + `ren-zhengfei` | 西 × 东战略 | 单向门、长期投入、危机 |
| 决策与风险 | `munger` + `taleb` | 认知偏误 × 黑天鹅 | 重大**不可逆**赌注 |
| 多 agent 涌现 | `eo-wilson` + `harrison-chase` | 涌现 × 控制流 | 重开蜂群架构题 |
| 人与组织 | `daniel-kahneman` + `drucker` | 个体决策 × 业务定义 | 用户误判、组织/业务方向 |

用法：某决定落在哪个蜂群，就拉那对二人（"上安全对抗那对"）；要全局会审仍用 persona-panel。

其余 ~38 位 = 图书馆，处境变了（开始卖货 / 进某垂直领域）再调，平时不进会审免稀释信号。
- 想完全关掉拉模式：删本节即可。

### 12.1 司·守护大神映射表（2026-06-27 立 · 减法落地）

> **接口只在「审查」，不在「执行」。** 11 个司（`src/lib/contracts/agent.ts` Tier0，运行态 agent，在 jiqun 后端）**干活**；
> 守护大神（`~/.claude/skills/*-perspective`，开发态 skill）只在该司产出**过质门时做铁律4 的独立会审**——
> 谁做活仍按铁律9（前端不自建第二套）。大神官职（御史大夫/太傅/…）是 skill 库内部封号，**不是司名**，
> 靠「领域」映射、不靠同名硬对（严禁据此改 `agent.ts` Tier0 锁；注意 skill 库「司天监·Schneier」≠ 产品「钦天监」agent）。

**第一梯队·已真 agent（户/刑/工，改其产出/质门时必唤）**

| 司(运行态) | 守护大神(开发态审查) | 盯什么 |
|---|---|---|
| 户部 `hu_bu` | 户部·马克斯 + 大司徒·贝索斯 | pack_rd 成本拆分、周期、报价非对称 |
| 刑部 `xing_bu` | 司天监·Schneier + 太史令·塔勒布 | C1验签、缺证、出口门、尾部风险 |
| 工部 `gong_bu` | 工部·Karpathy + 将作大匠·马斯克 | agent 编排、质门、成本结构 |

**第二梯队·骨架司（守护大神 standby——该司有第一条真实数据前不进会审，守铁律5）**

| 司 | 守护大神 | 备注 |
|---|---|---|
| 丞相 `prime_minister` | 丞相·诸葛亮 | 拟旨/战略 |
| 史官 `scribe` | 尚书令·达利欧 + 国子监·吴恩达 | outcome 闭环、数据回流 |
| 吏部 `li_bu` | 尚书令·达利欧 | 人事/可信度加权 |
| 礼部 `li_bu_rites` | 侍中·张小龙 | 呈现克制、防用户误判 |
| 兵部 `bing_bu` | 大鸿胪·索罗斯 | 竞争反身性（兵部尚书·孙子待招后补） |
| 钦天监 `qin_tian_jian` | 太史令·塔勒布 | 预测=不确定性，防过度自信 |
| 锦衣卫 `jin_yi_wei` | 司天监·Schneier | 情报可信度/异动（配合 `锦衣卫` skill） |
| 太医院 `tai_yi_yuan` | 少府·大野耐一 | 现场根因，守「绝不诊断/开方」红线 |

**图书馆·备用 3 位**（挂不上任何真司，按需拉，不进默认会审）：
- **御史大夫·芒格** → 不可逆决策/架构换轨（全场风控，不绑单一司）
- **大司马·格鲁夫** → 战略转折/危机决断
- **典客·霍夫曼** → 等真卖货/做平台增长再上岗（现无对应真业务，先冻）

判据：`git diff` 命中某司的产出/质门/contract → 无「对应守护大神的会审记录」即视为未过铁律4 独立会审门。

**内胆（开发态强绑定，2026-06-27）**：改某司代码时戴的镜片 = `docs/CHAOTANG_GUARDIAN_INNER_CORE.md`
（把守护大神 5 模型/8 启发式蒸馏进该司 domain + 强制自问清单；户/刑/工 满卡，8 骨架司 standby）。
执行门 = `pnpm guard:guardian`：顾问模式列出该唤谁；commit-msg 钩子 `GUARDIAN_STRICT=1` 拦户/刑/工 无 `守护:` 行的提交。
大神不进运行时（铁律9）——内胆只改「我怎么审这司代码」，不改「司 agent 怎么想」。

---

## 13. Loop + Harness 架构铁律（2026-06-17 立）

> **核心心法：Loop = 状态 + 动作 + 下一步。** 不让 AI 自由发挥，让 AI 在规定好的状态机里只执行其中一步。
> CourtOS 不是聊天工具，是 AI 决策操作系统。主闭环：
> 上书房问题 → 丞相拟旨 → 缺证检查 → 军机处会审 → 圣旨/奏折 → 用户裁决(采纳/补证/复核/驳回/追问) → 高风险人工确认 → 史馆归档 → 下次引用旧案。

### 13.1 适配原则（铁律2 SSOT 延伸 · 最高优先）

Loop+Harness 的原语**这仓已存在大半，一律 import 现有的，禁新建平行类型**：

| 概念 | 唯一真相源（import 它） |
|---|---|
| SourceLabel | `src/lib/reality/reality-state.ts`（RealityState + normalize + merge） |
| 决策/任务状态 | `src/lib/contracts/task.ts`（TaskStatus） |
| AI 调用核心 | `src/lib/llm/router.ts`（callLLM，含三层 fallback） |
| 人工确认门 | `src/features/governance/lib/gate.ts`（L0-L4 + blast-radius + needs_signoff） |
| 数据结构 | `src/lib/contracts/{task,memorial,decree,archive,chancellor-decision}.ts` |
| 持久化 | `src/lib/db/{primary-store,schema,turso}.ts` |

新增 Loop 代码统一放 `src/core/courtos/`（orchestrator / harness / evals 分层），但**类型从上表 import，不重定义**。

### 13.2 不可违反

1. AI 调用最终必须经 AgentHarness（`callLLM` 之上的薄壳），UI 组件 / 随手 API route 禁直连模型。
2. 所有面向用户的决策结果必须带 sourceLabel（LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO，经 reality-state 归一）。
3. DEMO/FALLBACK 禁伪装成 LIVE。fallback 可发生，但必须明示。
4. 上传文件是 evidence（证据），不是普通 attachment。
5. 高风险事项（股权/合同/法律责任/重大付款/不可逆承诺/对外报价/客户承诺/供应商锁定/独家/违约金/预付款）必须过人工确认门，禁一键静默采纳。
6. 奏折必须含：圣裁 / 分奏 / 证据 / 缺证 / 风险 / 后令 / 质门 / 来源。缺任一即非法。
7. 用户裁决必须持久化；失败可发生，但禁丢任务；任务刷新不丢。
8. 先做一条真闭环，不增无关页面。改坏防线靠 EvalLoop。
9. **引擎边界（防前后端双 runtime 焊死，2026-06-17 立）**：前端 CourtOS runtime（`/api/court/decision` / `src/core/courtos/`，直连 `callLLM`→LiteLLM:4444）只许做**无重资产、无外部副作用的咨询决策**。一旦触碰**真实产线资产**（PACK / 报价 / BOM / 交期 / 真实交付 / 付款 / 对外承诺 / 供应商锁定），**必须 HTTP 转交后端 jiqun `:8081`（`/api/swarm/run` 等）**，禁在前端自建第二套产线 flow / 第二套奏折格式 / 第二套质门。切分判据是「**是否触碰真实产线资产**」，不是「谁先写好」。新决策入口落地前先回答：该走前端咨询引擎，还是转后端产线引擎？
10. **并发 agent 地盘协议（防对撞搞红 build，2026-06-17 立）**：本分支 `feat/courtos-loop-harness` 同时有多个 agent 在推，必须划地盘。① §13 core `src/core/courtos/**` 归 **core-builder**（在建 decision-loop/harness/gates/runtime/executors）；② `e2e/**` + 发布门禁 + 后端 `jiqun_ai_fresh/web/**` + 端到端验证归 **fusion**；③ 共享文件（`AGENTS.md`、`src/lib/jiqun-api.ts`、`src/lib/contracts/**`、`package.json`、`next.config.ts`）改前必须在 commit message 首行喊 `[shared] <文件>`，改完立刻 `pnpm build` 自检。禁 `git add .`，文件级分拣；两 agent 不在对方地盘内改文件。交接现状见 `docs/AGENT_HANDOFF.md`。

### 13.3 每个改动必答（开发自检）

1. 影响哪条 Loop？ 2. 从哪个状态进？ 3. 去哪个状态？ 4. 产出什么 sourceLabel？
5. 是否需人工确认？ 6. 失败怎么办？ 7. 结果是否持久化？ 8. 有没有 eval/test？

---

## 14. 视频链接默认进入翰林炼 Skill（2026-06-20 立）

用户只要粘贴 B 站 / YouTube / 视频链接，默认自动使用本机 Codex Skill：

- `learn-video-to-skill`

按顶尖工程师标准处理，禁止只做摘要：

1. 不要只总结。
2. 区分官方能力、视频宣传、本机可验证事实。
3. 能装就装。
4. 不能装就复刻成本地 Skill。
5. 必须在朝堂项目里实战一次；若因账号、灰度、交互权限卡住，明确写 blocker。
6. 输出必须包含：已学习 / 已安装或创建 / 已试用 / 未完成风险。
7. 最后给一个大神视角：下一步最该自动化哪条重复流程。

朝堂产品语义：这类任务归 **翰林院 · 炼 Skill 工房**，不是普通聊天总结。视频是“外部前沿/方法论来源”，处理链路是：

`采证 -> 学习 -> 炼 Skill -> 评测 -> 入史`

前端展示归 `/hanlin/skill-forge`；本机执行归 `~/.codex/skills/learn-video-to-skill`。如果视频涉及真实插件或 Codex/OpenAI 新能力，先查本机 CLI/官方来源，不用视频标题替代安装事实。

---

## 15. 提交纪律（2026-06-25 立）

- ❌ 不要自动提交代码，即使改动已完成。
- ❌ 不要自动推送到远程仓库。
- ✅ 只有当用户明确说"提交"或"推送到远程"时，才执行 git commit 和 git push。
- ✅ 改动完成后，只做本地验证（TypeScript 检查、构建测试），等待用户指令。
- ✅ 如果用户问"要不要提交"，可以建议但不要自动执行。

---

## 16. 清理纪律 · 零事故路径（2026-06-28 立 · 一次228文件清理沉淀）

> 删除是单向门，清理是会反复发生的流程。本节钉死「取证→隔离→双门验证→到期再删」这条**全程不走单向门**的路径。
> 凡"清理代码/删死代码/整理上线版/瘦身"任务，按此办，别凭手感。

**1. 取证 not 手感（铁律4）**：死代码靠工具，不靠肉眼。`pnpm dlx knip`（只读，不必装）跑「无引用」清单；
   单文件判活看 `grep -rl` 入站引用数。**零引用才安全；非零必须看清是死链还是主线节点**。
   血泪：`/grand-council`(17处链)是军机处入口、`/throne/decision`是主闭环发布门禁——名字像 demo，差点误删。

**2. 隔离 not 删除**：确认死的，先 `git mv` 进 `dev/_attic/`（保留 `src/` 路径结构，反向恢复直接移回），
   **不直接 `rm`**。隔离是可逆双向门，删除是单向门。

**3. 双门验证，缺一不算完**：移动后必跑 ① `pnpm exec tsc --noEmit` EXIT=0 ② `NEXT_PUBLIC_API_MODE=real pnpm build`
   跑到底（webpack Compiled + 全页静态生成）。webpack 成功=路由图无断 import；tsc=非路由文件也无类型错。两者互补。

**4. knip 候选别只过滤 components/lib/features**：`src/app` 下**非路由辅助文件**（`*-client.tsx`/`client.tsx`/
   `*.original-*.tsx`/无 page.tsx 的目录簇）也会 import 死叶子→tsc 报错。它们也是死的，需一并退役。

**5. 页面层用白名单门当筛子，黄≠死**：`launch-whitelist.ts` 放行的是绿色主干；其余 redirect→上书房 ≠ 死，
   多为主闭环内部工位（军机处/史馆/裁决/御座）。一次96页清理实测：71黄页**0死页**。别在页面层制造删除。

**6. 两段式删除，不靠记忆**：隔离区放 `dev/_attic/EXPIRES-YYYY-MM-DD.md` 到期标记；到期日仍无人复活，
   再一次性物理删（那一刀才关闭可逆窗口，有 git 历史兜底）。

**7. 大批 git mv 后立即自提交（§13.2.10 并发地盘）**：别把 228 个 rename 留在索引里等——并发 agent 的
   `git commit -am`/`git add -A` 会一锅端把你的暂存吞进它的业务 commit（本轮就被 `7d4ce42 feat(hubu)` 吞了）。

**8. 不为化妆走单向门**：清理混进了别人业务 commit、标签不对——只要已绿已进 HEAD，**别 rebase 拆**。
   活分支上改写历史的风险 >> 标签好看的收益（Taleb）。台账备查即可。

DO NOT send optional commentary
