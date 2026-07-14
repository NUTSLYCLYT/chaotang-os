# 朝堂 OS 项目状态盘点

> 盘点时间：2026-07-14 07:46:06 +08:00（Asia/Shanghai）
> 盘点对象：当前检出的 `feature-chaotang-ext`。仓库不存在精确名为 `ext` 的本地或远端 ref；验证命令 `git show-ref --verify refs/heads/ext` 与 `git show-ref --verify refs/remotes/origin/ext` 均退出 1。
> 盘点方式：只读检查仓库和执行安全验证；未安装依赖、未修改配置、未写生产数据库、未自动修复。前端 build/dev/test 在 `/tmp` 副本运行；唯一预期仓库写入是本文件。
> 重要限制：盘点过程中仓库被外部并发修改并产生新提交（ahead 从 87 增至 93，工作区文件也变化）。以下 Git 信息以 07:46:06 的收尾快照为准，命令验证则注明实际执行结果。
> 生成后复核：07:50:41 再次检查时已变为 ahead 95，新增 `e213e8e`、`0b74711` 两个提交且工作区集合再次变化。为保证可引用性，第 2 节保留 07:46:06 的完整原始快照；本仓库在审计窗口内不是静态目标，任何发布判断必须在冻结后的固定 SHA 重跑。

## 1. 项目简介与主要技术栈

朝堂 OS 是面向企业老板和经营负责人的 AI 决策执行操作系统。产品主线是：真实经营问题进入上书房，经过丞相路由、军机处可靠派单、六部/专署会审、御史质量与来源门，形成正式奏折，由人类裁决并进入史馆归档复盘。当前首发商业切片已经冻结为“刑部合同审查决策工作台”。

证据：`README.md`、`docs/product/PROJECT_PRODUCT.md:1`、`.harness/wiki/architecture.md:1`、`backend/README.md:1`、`frontend/README.md:1`。
验证命令：`sed -n '1,260p' docs/product/PROJECT_PRODUCT.md`、`node scripts/harness-doctor.mjs`。
是否阻止上线：否；这是当前产品与架构事实源。
最小修复范围：无需修复；后续功能、导航和发布口径必须继续服从首发切片边界。

主要技术栈：

- 前端：Next.js 16.2.6 App Router、React 19.2.4、TypeScript 5、Tailwind CSS 4、Zustand、SWR、Zod、Playwright 1.60、pnpm。
- 后端：Python 3.11+、FastAPI、Uvicorn/Gunicorn、SQLAlchemy、Alembic、SQLite（开发默认）/ PostgreSQL（生产迁移目标）、LiteLLM、HTTPX、Jinja2。
- AI/运行：多 Agent flow engine、provider 路由、运行时 prompts、可靠 outbox、后端 harness/golden cases。
- 部署资产：Dockerfile、docker-compose、systemd 模板、nginx + Cloudflare tunnel 口径、发布 commander/attestation/rollout 控制面。

证据：`frontend/package.json`、`backend/pyproject.toml`、`backend/requirements*.txt`、`backend/gunicorn.conf.py`、`frontend/deploy/README.md`。
验证命令：`node --version`（v22.23.1）、`pnpm --version`（10.33.0）、`python3 --version`、`find frontend/deploy -maxdepth 2 -type f`。
是否阻止上线：Python 命令文档普遍写 `python`，但当前环境只有 `python3`，会阻止照抄命令执行。
最小修复范围：统一 README/AGENTS/脚本中的 Python 入口，或在受控运行环境提供 `python` 命令。

## 2. 当前 Git 分支、git status、最近 15 次提交

当前分支：`feature-chaotang-ext`，跟踪 `origin/feature-chaotang-ext`，收尾快照为 ahead 93。精确 `ext` ref 不存在；另有拼写不同的 `origin/feature-changtang-ext`，不能视为同一分支。

生成后 07:50:41 的只读复核为 ahead 95，最新两次提交是 `e213e8e`（P0-B ownership gate）和 `0b74711`（rollback 描述修正）。这两次提交发生在下面 15 次提交快照之后，未纳入此前已执行的测试结论。

`git status --porcelain=v1 --branch`（生成本文档前）：

```text
## feature-chaotang-ext...origin/feature-chaotang-ext [ahead 93]
 M .harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md
 M .harness/changes/chore-shangshufang-step0-contract-baseline-20260714/request_analysis/spec.md
 M .harness/changes/chore-shangshufang-step0-contract-baseline-20260714/request_analysis/tasks.md
 M backend/tests/test_p0b_ownership_ratchet.py
 M backend/web/routers/shangshufang.py
 M docs/README.md
?? .harness/changes/docs-chaotang-convergence-guide-20260714/
?? .playwright-cli/
?? .playwright-mcp/
?? backend/knowledge/docs/ima_archived/doc-495e721d6c40.md
?? backend/knowledge/docs/ima_archived/doc-675e21a7f3fb.md
?? backend/tests/test_p0b_cross_user_behavioral.py
?? docs/product/CHAOTANG_CONVERGENCE_GUIDE.md
?? frontend/.next-stale-1783879000/
```

最近 15 次提交：

```text
ecedac9 | 2026-07-14T07:45:57+08:00 | fix: verify rollback with an actual revert dry-run instead of guessing
756a36b | 2026-07-14T07:42:34+08:00 | fix: merge department alias tables, document control-plane scope, retract wrong ORPHANED marks
f09dae3 | 2026-07-14T07:41:05+08:00 | fix: correct rollback description in AGENTS.md rules change record
cffebc5 | 2026-07-14T07:39:55+08:00 | fix: resolve wf_pack root from canonical backend
8dee499 | 2026-07-14T07:38:12+08:00 | docs: add Claude Code specific operating rules to AGENTS.md
9940e45 | 2026-07-14T07:36:48+08:00 | fix: anchor guoli LIVE metric to real write path; make P0-B gate executable
7f7f389 | 2026-07-14T07:32:24+08:00 | fix: reconcile self-contradicting evidence in ci_summary.md
f001907 | 2026-07-14T07:31:38+08:00 | docs(frontend): link BFF-guard commits back to the change record
ed59555 | 2026-07-14T07:28:26+08:00 | feat: add guoli dashboard endpoint and full-court loop plan
be2f57c | 2026-07-14T07:27:25+08:00 | fix: route smoke help to canonical backend launcher
2d4c8c7 | 2026-07-14T07:27:21+08:00 | fix(frontend): use mkdtempSync for BFF-guard test uniqueness, not process.pid
10ed317 | 2026-07-14T07:27:04+08:00 | fix: move test-runner globs out of package.json script text
54bb9bc | 2026-07-14T07:23:26+08:00 | fix(frontend): stop BFF-guard regression test from deleting shared src/app/api
3afc397 | 2026-07-14T07:19:09+08:00 | test(frontend): add BFF-guard failure-path regression tests, finish change record
95d0666 | 2026-07-14T07:16:09+08:00 | fix: canonicalize release artifact identity
```

证据：Git 索引与 refs。
验证命令：`git branch --show-current`、`git status --porcelain=v1 --branch`、`git log -15 --date=iso-strict --pretty=...`。
是否阻止上线：是。脏工作区、93 个未推送提交和盘点期间持续变化的 HEAD 不能形成可审计发布候选。
最小修复范围：冻结写入，按所有权拆分/审查现有改动，形成 clean commit，推送并从固定 SHA 重新跑全部门禁；不得直接丢弃未知用户改动。

## 3. 项目目录结构（关键目录）

```text
chaotang-os/
├── .harness/             根级边界、manifest、契约、控制面、变更审计
├── frontend/
│   ├── .harness/         前端工程护栏
│   ├── src/app/          17 个 page.tsx 路由入口
│   ├── src/features/     页面功能与交互
│   ├── src/core/         CourtOS 前端领域逻辑
│   ├── src/lib/          API adapter、契约、数据库/工具层
│   ├── e2e/              58 个 Playwright spec
│   ├── scripts/          构建、发布、门禁、恢复脚本
│   └── deploy/           env/nginx/systemd/LiteLLM 脱敏模板
├── backend/
│   ├── src/              flow、agent、provider、领域逻辑、数据库模型
│   ├── web/routers/      76 个 Python router 文件（含辅助模块）
│   ├── alembic/versions/ 001–010 共 10 个迁移
│   ├── tests/            283 个顶层 test_*.py
│   ├── harness/          后端运行/评测 harness 与 manifest
│   ├── runtime_prompts/  运行时 prompt 资产
│   └── agent_design/     Agent 职责设计参考资产
├── docs/                 项目级产品、契约、部署和审计文档
├── courtos-brain/        个人知识归档，不是第四运行主线
└── scripts/              根级 doctor、控制面、发布与契约审计
```

证据：`AGENTS.md`、`.harness/wiki/architecture.md`、实际 `find` 结果。
验证命令：`find . -maxdepth 2 -type d`、页面/router/test 计数命令。
是否阻止上线：否；但仓库包含大量归档、生成配置和历史资产，发布包必须依赖白名单/ignore。
最小修复范围：保持现有三层所有权；确认 Docker/package 脚本不把 `.env`、data、stale build、Playwright 临时目录打入产物。

## 4. 已经完成并且实际可用的功能

本节只列本次命令或结构门禁实际证明的能力，不把“代码存在”当作“业务已上线”。

1. 根/前端/后端三层 harness 架构可用：三个 doctor 均为 0 error、0 warning。
2. 前端可通过严格 TypeScript 检查：`pnpm exec tsc --noEmit --incremental false` 退出 0。
3. 前端在显式 `NEXT_PUBLIC_API_MODE=real` 时可完成 production build：Next 16.2.6 编译、TypeScript、31 个静态页面生成和 build trace 均完成，退出 0。
4. 前端开发服务器可启动：临时副本 `pnpm dev` 343ms ready；实际 base path `http://127.0.0.1:3002/chaotang/shangshufang` 返回 HTTP 200。裸 `/` 和裸 `/shangshufang` 返回 404，说明访问必须遵守 base path。
5. 后端代表性 commercial-loop/legal-redteam harness 行为测试通过：28 passed in 3.17s。
6. 前端核心纯逻辑的大部分能力通过：`pnpm test:core` 共 70 个 test file，69 通过，涵盖 archive/recall、部门 flywheel、质量门、source label、路由与运行适配等。
7. 无前端 BFF：doctor 实际确认 `src/app/api` 不存在，且 `src/app` 无 route handler。
8. 数据契约骨架存在：DecisionTask、路由、outbox、过程事件、候选/正式奏折、人工裁决与史馆模型及 Alembic 001–010 均在仓库中。

证据：`scripts/harness-doctor.mjs`、`frontend/scripts/harness-doctor.mjs`、`backend/scripts/harness_doctor.py`、`frontend/src/core/courtos/**/*.nodetest.ts`、`backend/tests/test_commercial_loop_harness.py`、`backend/tests/test_legal_redteam_harness.py`、`backend/src/db/models.py`、`backend/alembic/versions/`。
验证命令：见第 9 节。
是否阻止上线：上述单项不阻止；它们不能单独证明完整用户闭环或生产可用。
最小修复范围：保留这些通过项作为回归基线，修复失败后从固定 SHA 全量复跑。

## 5. 已写但尚未验证的功能

- 完整上书房确认 → 丞相路由 → outbox worker → 部门回奏 → 御史质量门 → FinalMemorial → EmperorDecision → ShiguanArchive 真实闭环：模型、router、页面和测试均存在，但本次后端契约组运行超过 90 秒无输出后中断，且未运行真实浏览器+真实后端+真实 provider E2E。
- 58 个 Playwright 场景：文件存在，本次未全量执行；多个 spec 需要真实后端、真实 DB 条件或显式环境开关。
- 真实 LLM/provider 蜂群、nightly、daily-real-swarm、合同首发真实质量：存在脚本和环境变量，但为了不产生模型费用、运行账本或数据库写入，本次未运行。
- 生产 safe build/start/release commander、signed attestation、release fencing、rollback：实现和文档存在，但当前没有固定干净 SHA、外部签名和 required check，未作生产启停。
- Docker、systemd、nginx、Cloudflare tunnel、域名链路：只有仓库模板证据，未检查宿主 systemd、证书、隧道、DNS 或公网健康。
- PostgreSQL 迁移：10 个 Alembic 迁移存在，但未对任何生产/准生产 PostgreSQL 执行 upgrade/downgrade。

证据：`.harness/wiki/architecture.md`、`frontend/e2e/`、`frontend/package.json`、`frontend/deploy/`、`backend/alembic/`、`docs/multi-agent-control-plane-rollout-runbook.md`。
验证命令：`find frontend/e2e -name '*.spec.ts'`、`find backend/alembic/versions -type f`；待验证命令见第 8 节。
是否阻止上线：是；首发核心价值就是完整合同决策闭环，不能用结构或 mock 测试替代。
最小修复范围：建立隔离 staging 数据库和测试租户，以真实合同样本跑一条唯一主线，并保存浏览器、API、事件账本、奏折、人工裁决和归档证据。

## 6. 明确未完成的功能

- 工程多 Agent 控制面尚未进入真实 Observe：manifest 状态为 `s10-local-observe-pending` / `IMPLEMENTED_LOCAL_OBSERVE_PENDING`。
- 外部 test identity / attestation trust anchor 未配置，Gitee protected-branch required check 未验证。
- 生产 break-glass 为 `EXTERNAL_REQUIRED` 占位，按设计 fail closed。
- 礼部应在首发前隐藏/实验，但当前前端标记 active，导航和直接路由也不读取 status；后端真实部门引擎没有礼部实现。
- `dispatchDeptToSwarm` 所谓唯一派发桥未实现/无调用方，相关守卫测试实测 0 个 route。
- 邮件 MCP 和企微 MCP 仍有真实服务接入 TODO。
- `cleanup_old_failures()` 明确尚未实现，对应测试主动 skip。
- 翰林角色仍未从 JWT 显式 role claim 获取；治理 FSM 完整版和 archive mapping 重构仍为 deferred TODO。
- 当前首发要求的 5 家真实客户/3 家复用/1 家付费/1 条公开证言扩张门没有仓库内完成证据。

证据：`.harness/manifest/project-harness.json:83`、`.harness/wiki/multi-agent-control-plane.md:37`、`docs/product/PROJECT_PRODUCT.md:145`、`docs/chaotang-os-duplication-conflict-audit-2026-07-14.md:62`、`backend/mcp_servers/*.py`、`frontend/src/features/hanlin/lib/server-access.ts:114`、`frontend/src/features/governance/lib/actor-context.ts:133`。
验证命令：`node scripts/integration-lease-gate.mjs --status`、相关 `rg` 命令、`pnpm test:node`。
是否阻止上线：外部发布门、首发隐藏边界、完整主链证据阻止上线；邮件/企微、翰林和重构不阻止合同 V0.1。
最小修复范围：先只补 V0.1 必需的外部发布门、首发导航/路由门和合同主链；非首发 TODO 保持冻结并明确 source label。

## 7. 当前核心用户完整流程

目标流程（代码/产品统一主线）：

```text
客户登录/受邀注册
  -> 上书房上传或粘贴合同、补业务背景
  -> 用户确认拟旨
  -> ChancellorRouteDecision 生成唯一版本路由
  -> OutboxEvent 可靠入队并由 worker 领取
  -> 刑部/锦衣卫等产生带证据和 sourceLabel 的候选分奏
  -> CourtReview.memorial_json 形成候选奏折
  -> 确定性质量门 + provenance gate
  -> FinalMemorial 唯一晋升
  -> 裁决人采纳 / 补证 / 复核 / 驳回
  -> EmperorDecision 记录人工决定
  -> ShiguanArchive 保存输入版本、路由、分奏、正式奏折、裁决与后续结果
```

当前可证明程度：登录/注册路由、上书房/刑部/史馆页面、后端模型/router、outbox/质量门代码均存在；build/type/harness 通过；但整条链本次没有端到端通过证据。因此当前结论是“流程已实现到可构建、局部可测，完整 LIVE 闭环未验证”，不能写成“实际可用的生产闭环”。

证据：`docs/product/PROJECT_PRODUCT.md:85`、`.harness/wiki/architecture.md:24`、`backend/web/routers/auth.py`、`backend/web/routers/shangshufang.py`、`backend/src/execution/outbox_worker.py`、`backend/src/formal_memorial.py`、`backend/src/db/models.py`、前端对应 app/features。
验证命令：`pnpm build`、后端 contract pytest、`pnpm test:e2e`、live business gate。
是否阻止上线：是。
最小修复范围：只选择一份受支持的大陆法域 B2B 合同，完成一次 staging 真闭环并验证四个首发界面，不扩展其他部门。

## 8. 安装、本地启动、构建、类型检查、Lint、测试命令

推荐按当前仓库真实入口使用：

```bash
# 根级护栏
node scripts/harness-doctor.mjs

# 前端安装（本次未执行，会修改依赖）
cd frontend
pnpm install --frozen-lockfile

# 前端本地开发
NEXT_PUBLIC_API_MODE=real pnpm dev
# 实际访问 http://127.0.0.1:3002/chaotang/

# 前端类型、构建、测试
pnpm exec tsc --noEmit --incremental false
NEXT_PUBLIC_API_MODE=real pnpm build
pnpm harness:doctor
pnpm test:node
pnpm test:core
pnpm test:e2e

# 前端 lint
# package.json 没有 lint script，也没有 ESLint 配置；当前只能运行 knip/专项 guards，不能等价为 Lint。
pnpm knip

# 后端安装（本次未执行，会修改依赖）
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip check

# 后端本地开发（会在 lifespan 初始化/迁移数据库，本次未执行）
uvicorn web.main:app --host 127.0.0.1 --port 8081 --reload

# 后端检查与测试
python3 scripts/harness_doctor.py
python3 -m ruff check src web tests --no-cache
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider \
  tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py

# 生产入口
# pnpm start 是故意禁用的 legacy 入口；应通过 release commander / prod:safe-* 工作流。
pnpm prod:safe-build
pnpm prod:safe-start
```

证据：`frontend/package.json`、`frontend/AGENTS.md`、`backend/AGENTS.md`、`backend/gunicorn.conf.py`、`frontend/scripts/reject-legacy-production-entry.mjs`。
是否阻止上线：缺少统一前端 Lint、文档仍示例 `pnpm start`/`python`，会导致运维误操作；生产启动本身因发布门 fail closed。
最小修复范围：修正文档命令，增加明确 lint script，保留 release commander 为唯一生产入口。

## 9. 上述命令的真实执行结果

| 命令 | 结果 | 结论 |
| --- | --- | --- |
| `node scripts/harness-doctor.mjs` | exit 0，0 errors / 0 warnings | 根级及委托护栏通过 |
| `cd frontend && pnpm harness:doctor` | exit 0，0 errors / 0 warnings | 前端结构/BFF guard 通过 |
| `cd backend && PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness_doctor.py` | exit 0，0 errors / 0 warnings | 后端 harness manifest 通过 |
| `cd frontend && pnpm exec tsc --noEmit --incremental false` | exit 0，无输出 | 类型检查通过 |
| `cd frontend && pnpm build`（未设 API mode） | exit 1 | 发布门正确拒绝：必须显式 real 或显式允许 mock |
| `/tmp` 副本中 `NEXT_PUBLIC_API_MODE=real pnpm build` | exit 0 | production build 通过；有 middleware→proxy deprecation warning |
| `/tmp` 副本中 `NEXT_PUBLIC_API_MODE=real pnpm dev` | ready 343ms；base-path URL HTTP 200 | 本地 dev 可启动；裸路径 404，需 `/chaotang` |
| `cd frontend && pnpm start` | exit 64 | legacy 生产入口按设计被拒绝 |
| `cd backend && python3 -m ruff ...` | exit 1：`No module named ruff` | 当前环境无法执行后端 Lint |
| 后端代表性 harness pytest | exit 0，28 passed in 3.17s | 代表性后端 harness 行为通过 |
| 后端五组核心契约/API pytest | 运行超过 90 秒无输出，手工中断 exit 130 | 未验证；需分组定位 hang |
| `/tmp` 副本 `pnpm test:core` | exit 1；70 files，69 pass / 1 fail | stale BFF 路径测试失败 |
| `/tmp` 副本 `pnpm test:node` | exit 1；1004 tests，997 pass / 7 fail | 存在 7 个确定失败，见第 10 节 |
| `pnpm test:e2e` | 未执行 | 会启动浏览器/服务并依赖真实后端；当前无隔离 staging 且安全要求禁止 DB 写 |
| 安装命令 | 未执行 | 用户要求不修改依赖 |
| 后端/生产启动 | 未执行 | FastAPI lifespan 会建表/补列/确保 admin/invite，违反本次无 DB 写要求 |
| `node scripts/integration-lease-gate.mjs --status` | IMPLEMENTED_LOCAL；public key false；required check false | 外部发布权威未配置/未验证 |

完整复现命令均在第 8 节或对应问题卡。
是否阻止上线：测试失败、Lint 不可运行、核心契约组 hang、E2E 未执行均阻止形成 V0.1 发布证据。
最小修复范围：先恢复可重复的本地/CI 工具环境，再逐个修复 7 个前端失败和后端 hang，最后跑 staging E2E。

## 10. 当前错误和阻塞问题（P0/P1/P2）

### P0（当前不能发布）

#### P0-1：没有可发布的固定候选 SHA

- 证据文件路径：Git 工作区、`.harness/changes/`、`backend/web/routers/shangshufang.py` 等当前 status 路径。
- 复现/验证命令：`git status --porcelain=v1 --branch && git log -1 --oneline`。
- 是否阻止上线：是；dirty + ahead 93 + 并发变更无法生成可信 attestation/build identity。
- 最小修复范围：冻结仓库写入，所有权审查，形成 clean、已推送、受保护的候选 SHA。

#### P0-2：生产外部权威门和 CI required check 未配置

- 证据文件路径：`.harness/manifest/project-harness.json:83`、`.harness/wiki/multi-agent-control-plane.md:37`、`docs/gitee-required-check-lease-attestation-template.md:3`。
- 复现/验证命令：`node scripts/integration-lease-gate.mjs --status`，实际显示 public key 未配置、required check 未验证。
- 是否阻止上线：是；生产入口已 fail closed。
- 最小修复范围：由仓库管理员在 Gitee protected branch 配 required check，固定受审公钥/外部 authority，并从 clean commit 验证一次 signed release。

#### P0-3：完整合同决策 LIVE 闭环无通过证据

- 证据文件路径：`docs/product/PROJECT_PRODUCT.md:85`、`frontend/e2e/`、`backend/tests/test_shangshufang_loop_api.py`、`backend/src/execution/outbox_worker.py`。
- 复现/验证命令：五组后端契约 pytest 本次 hang；`pnpm test:e2e` 未运行；需 staging live-business gate。
- 是否阻止上线：是；这是 V0.1 核心价值。
- 最小修复范围：隔离 staging DB/租户/provider，跑一份真实受支持合同的全链，保存事件与页面证据。

#### P0-4：前端生产环境文件缺失，默认 build 被拒绝

- 证据文件路径：`frontend/deploy/env.example`、`frontend/scripts/next-with-base-path.mjs`；`find frontend -maxdepth 2 -name '.env*'` 无结果。
- 复现/验证命令：`cd frontend && pnpm build`，实际 exit 1，`NEXT_PUBLIC_API_MODE` 未设。
- 是否阻止上线：是。
- 最小修复范围：在部署平台安全注入首发所需变量，运行 `prod:doctor`/safe build；不要提交 `.env.local`。

### P1（必须在 V0.1 候选前处理）

#### P1-1：前端 Node 测试 7 处失败

- 证据文件路径：`frontend/src/config/chaotang-v1-modules.nodetest.ts`、`frontend/src/core/courtos/runtime/recruit-verdict.nodetest.ts`、`frontend/src/features/bureaus/lib/bureau-page-view-builder.nodetest.ts`（由失败名定位）、`frontend/src/lib/auth/require-court-swarm-auth.nodetest.ts`、`frontend/src/lib/department-learning/store.nodetest.ts`。
- 复现/验证命令：`cd frontend && pnpm test:node`；实际 1004 tests / 997 pass / 7 fail。
- 失败摘要：礼部期望 pending 实际 active；国库司期望实际出纳司；派发 guard 预期至少 4 routes 实际 0；4 个测试读取已被 BFF guard 删除的 `src/app/api/**` 路径而 ENOENT。
- 是否阻止上线：是；其中礼部状态与首发隐藏边界直接冲突，stale BFF tests 说明测试事实源漂移。
- 最小修复范围：裁决模块/司局 SoT，删除或迁移所有对已退役 BFF 的断言到后端 owner；不要恢复 BFF。

#### P1-2：后端核心契约测试组 hang

- 证据文件路径：`backend/tests/test_contract_alignment_p0.py`、`test_swarm_runs_api_contract.py`、`test_dadian_api.py`、`test_libu_router.py`、`test_shangshufang_loop_api.py`。
- 复现/验证命令：第 9 节五组 pytest；超过 90 秒无输出，Ctrl-C exit 130。
- 是否阻止上线：是；不能证明 P0 API 合约。
- 最小修复范围：用 `pytest -vv -x` 单文件二分定位 collection/fixture/线程 hang，保持 DB 与网络隔离。

#### P1-3：后端 Lint 工具未安装，前端无正式 Lint 命令

- 证据文件路径：`backend/pyproject.toml:[tool.ruff]`、`frontend/package.json`。
- 复现/验证命令：`python3 -m ruff check ...` → No module named ruff；`pnpm run` 中无 lint。
- 是否阻止上线：是（质量门不完整）。
- 最小修复范围：将 Ruff 纳入受锁定的 test/dev dependencies；给前端增加不联网、版本锁定的 lint script 和 CI check。

#### P1-4：首发隐藏/鉴权边界与产品角色模型不一致

- 证据文件路径：`frontend/src/middleware.ts:20` 将大殿、上书房、军机处、六部、专署、史馆全部列为公开前缀；`docs/product/PROJECT_PRODUCT.md:145` 要求按客户成员/裁决人/租户管理员/内部运营/平台管理员分权；`frontend/src/features/auth/lib/session-auth.ts` 仍有硬编码演示账号逻辑（本文不记录任何凭据值）。
- 复现/验证命令：`rg -n 'PUBLIC_PREFIXES|DEMO_ACCOUNTS' frontend/src`，并用无 cookie 浏览器访问首发路由。
- 是否阻止上线：是，除非明确证明页面只公开壳且所有敏感读取/动作均由后端逐项鉴权。
- 最小修复范围：冻结四个首发界面角色矩阵，增加匿名/跨角色/跨租户 E2E；退役未使用的演示认证逻辑或严格限制为 dev-only。

### P2（不阻止内测，但应进入债务清单）

#### P2-1：文档/运行入口漂移

- 证据文件路径：`frontend/README.md` 仍指向已退役 `/court-briefing` 等路由并写 `pnpm start`；`frontend/deploy/nginx-app.conf.template` 仍称 “Next.js BFF”，与无 BFF 规则冲突；`backend/AGENTS.md` 使用当前环境不存在的 `python`。
- 复现/验证命令：`pnpm start` exit 64；访问旧路由；`command -v python` 为空。
- 是否阻止上线：不直接阻止代码，但会阻止可靠安装/运维，发布前应修。
- 最小修复范围：只更新事实源文档与模板注释，不改变运行逻辑。

#### P2-2：Next middleware 约定已弃用

- 证据文件路径：`frontend/src/middleware.ts`。
- 复现/验证命令：`NEXT_PUBLIC_API_MODE=real pnpm build`，出现 middleware→proxy deprecation warning。
- 是否阻止上线：否。
- 最小修复范围：单独迁移到 Next 16 `proxy` 约定并跑 auth/route E2E。

#### P2-3：大量 fallback/mock/历史代码增加事实边界风险

- 证据文件路径：第 13 节列出的命名 mock 与 source-label/fallback 文件；`frontend/dev/_attic/`。
- 复现/验证命令：第 13 节 `rg`。
- 是否阻止上线：如果 source label/生产门能阻止漂白则不直接阻止；任何被标 LIVE 的 fallback 都升级为 P0。
- 最小修复范围：只清理可达生产路径上的临时 mock，历史/测试 fixture 保留但明确隔离。

## 11. 数据库、迁移、认证、权限、环境变量

### 数据库与迁移

- SQLAlchemy 默认 `DB_URL=sqlite:///backend/data/fengqun.db`，代码声明支持 PostgreSQL URL。
- `src.tenant` 仍用原生 sqlite3 管理 tenants/users/invites，和 SQLAlchemy 业务表并存，user/tenant 关系多为逻辑 FK。
- Alembic 有 001–010 十个迁移；FastAPI lifespan 还会 `create_all(checkfirst=True)` 并补列/约束，形成“正式迁移 + dev 自愈”双路径。
- RAG 默认 sqlite-vec；部分 ChromaDB 测试仍存在且条件 skip。
- 本次未启动后端、未执行 migration、未写任何数据库。

证据：`backend/src/db/engine.py`、`backend/src/tenant.py`、`backend/web/main.py:70`、`backend/alembic/versions/`。
验证命令：`find backend/alembic/versions -type f`、`rg -n 'create_all|DB_URL|DB_PATH' backend`。
是否阻止上线：生产 DB migration/up/down 未验证会阻止上线；SQLite dev 双路径本身不阻止。
最小修复范围：对脱敏 staging PostgreSQL 从空库和上一版本各跑 upgrade，验证约束、回滚和启动后 schema 无漂移。

### 认证与权限

- 后端实现 invite/register/login/me/logout、JWT、HttpOnly cookie、secure 默认 true、登录/邀请码限流、CORS allowlist、安全响应头。
- JWT 默认值存在于源码，但 `enforce_jwt_secret()` 负责生产硬停；实际后端环境文件中的对应变量已配置（本报告不记录名称和值）。
- 前端 middleware 只检查 cookie 存在和可解码的 exp，不验签；注释说明由后端做最终鉴权。
- 多个核心页面被列为公开路由；前端还保留演示账号表。后端是否对每个敏感 API 逐项 enforce role/tenant 需要用行为 E2E 证明。

证据：`backend/web/routers/auth.py`、`backend/src/tenant.py`、`backend/src/security.py`、`frontend/src/middleware.ts`、`frontend/src/features/auth/lib/session-auth.ts`。
验证命令：`rg` 与 auth/tenant/actor spoof 测试；本次未跑完整安全 E2E。
是否阻止上线：当前未验证的角色/租户行为边界阻止外部 V0.1。
最小修复范围：首发四界面 + 对应 API 的匿名、普通成员、裁决人、租户管理员、跨租户负向矩阵。

### 环境变量状态（不记录敏感名称和值）

仓库没有 `frontend/.env.local`；`frontend/deploy/env.example` 为已跟踪模板。模板声明 13 个部署变量，当前均未在前端本地环境文件配置。

`backend/.env` 被 `.gitignore` 忽略且存在。只读检查发现 14 个相关变量为非空；本报告不记录敏感变量名称和值。

provider 配置引用 4 个凭据变量，其中 1 个未在后端环境文件中发现。

证据：`frontend/deploy/env.example`、`.gitignore:15`、`backend/.env`（仅变量名/非空状态检查）、`backend/config/providers.yaml`。
验证命令：使用只输出汇总计数的本地检查，以及 `find frontend -name '.env*'`。
是否阻止上线：前端必需变量缺失、provider 配置完整性未做 preflight，阻止上线。
最小修复范围：部署平台 secret store 注入最小变量集，并跑 `prod:doctor`/provider preflight；禁止提交真实值。

## 12. 部署平台、生产配置、域名、CI/CD 和回滚

- 仓库内没有 `.github/workflows`、`.gitee` CI 配置、GitLab CI、Jenkinsfile 或 Azure pipeline。
- 远端是 Gitee；protected branch required check 需要管理员在仓库外配置，当前未验证。
- 前端/后端各有 Dockerfile，前端有 docker-compose；生产主口径更偏 systemd user services + nginx + Cloudflare tunnel。
- nginx 模板配置域名 `app.mingshuoxny.com`，`/chaotang` 代理到前端 3050，`/api` 到后端 8081；这是模板事实，不代表 DNS/证书/隧道当前在线。
- systemd 模板包含前端、jiqun 后端、LiteLLM、外部 legal-agent。
- `pnpm start` 被禁用；production build/start 必须通过 release commander、signed attestation 和 release fencing。
- 回滚有 `system-restore.sh --dry-run`、release commander、rollout rollback-stage/reconcile-pointer 文档；本次没有执行真实回滚。control plane 尚为 local observe pending。

证据：`frontend/deploy/`、`frontend/Dockerfile`、`backend/Dockerfile`、`frontend/docker-compose.yml`、`docs/multi-agent-control-plane-rollout-runbook.md`、`frontend/package.json`。
验证命令：`git ls-files '.github/**' '.gitee/**' ...`（空）、`pnpm start`（exit 64）、`integration-lease-gate --status`。
是否阻止上线：是；缺外部 CI/required check、固定候选 SHA、生产 env 和真实部署/回滚演练。
最小修复范围：先建立一条 Gitee 外部 required-check pipeline，只执行锁定版本的 install/check/build/test/package；再在 staging 演练发布和回滚，不直接触碰生产。

## 13. 当前所有 TODO、FIXME、被跳过测试和临时 Mock

扫描范围：运行代码、测试、脚本；排除 `.git`、`node_modules`、`.next*`、lock、根/前后端 change 记录、`courtos-brain` 知识归档。命令可复现全部明细，不把文档中的普通英文 “todo” 或测试状态字段误报为工程 TODO。

### TODO / FIXME

未发现 `FIXME`。实际工程 TODO：

- `backend/mcp_servers/email_server.py:103`：接真实邮件服务。
- `backend/mcp_servers/wechat_server.py:44`：接企微外部联系人 API。
- `backend/scripts/new_swarm.py:88,91`：新角色模板要求人工补铁律和结构化输出。
- `frontend/src/features/governance/lib/actor-context.ts:133`：LANE-03/GOV-FSM-01 完整版 deferred。
- `frontend/src/features/hanlin/lib/server-access.ts:114`：翰林角色改由 JWT role claim。
- `frontend/src/core/courtos/archive/archive-store.ts:300`：MED-3 mapping 重构。
- `frontend/dev/_attic/dead-code/src/lib/tools/executor.ts:40,61,82,122`：四个已归档死代码 TODO，不是当前可达功能。

复现命令：

```bash
rg -n -i '\bTODO(?:\([^)]*\))?\b|\bFIXME\b' \
  frontend/src frontend/dev backend/src backend/web backend/mcp_servers backend/scripts
```

### 被跳过测试

显式/条件 skip 位于：

- 前端 E2E：`pack-swarm-shangshufang-entry.spec.ts:144`、`golden-loop-liveness.spec.ts:76`、`finance-intel-loop-ui.spec.ts:150`、`shangshufang-pack-real.spec.ts:47`、`finance-intel-loop-smoke.spec.ts:197`、`shangshufang-flywheel.spec.ts:59,68`、`agents-run-auth.spec.ts:131`。
- 后端：`test_finance_validators.py:300`；`test_manor_group_subagents.py:352,369,381,403,407,417`；`test_knowledge_vet.py:30,33,38,41,103`；`test_prompt_validator.py:111`；`test_failure_memory.py:322`；`test_case_archive_rag.py:29`；`test_orchestrator.py:228`；`test_court_flywheel.py:152`；`test_knowledge_rag.py:43,61,77,112`；`test_chaotang_smoke_real.py:8`。

跳过原因集中为：未启真实 E2E 开关、后端/DB/run 目录不存在、真实财报不存在、Chroma/embedding/Ollama/网络不可用、配置缺失，以及一个功能明确未实现。
复现命令：`rg -n 'pytest\.mark\.skipif|pytest\.skip\(|test\.skip\(' backend/tests frontend/e2e`。
是否阻止上线：真实合同闭环、鉴权、租户、live swarm 相关 skip 阻止上线；历史 RAG/财报/庄园样本不阻止合同 V0.1。
最小修复范围：为 V0.1 单建 `staging-required` 测试集合，禁止关键测试按服务不可用静默 skip；非首发测试保留条件 skip。

### 临时 Mock / Fixture / Fallback

明确命名的生产源码 mock/fixture 入口：

- `frontend/src/lib/mock/fixtures.ts`
- `frontend/src/features/court-console/lib/audit-mock.ts`
- `frontend/src/features/court-console/lib/mock-events.ts`
- `frontend/src/features/hanlin/lib/hanlin-home-mock.ts`
- `frontend/src/features/imperial/grand-council/lib/council-fixtures.ts`
- `frontend/src/features/auth/lib/session-auth.ts`（演示账号）
- `frontend/src/components/DemoDataBanner.tsx`、`frontend/src/lib/api/client.ts`（显式 mock fallback/source label）
- `frontend/src/components/chaotang/live/SixMinistriesLive.tsx`（API 失败后静态 fallback）
- `backend/src/persona_eval.py`（默认离线占位，真实评分需 gateway）
- `backend/web/routers/hanlin.py`、`backend/web/routers/court_session.py`（FALLBACK 响应）
- `backend/src/db/models.py` 的 DepartmentReport 第一版仍说明保存规则路由 + mock 专业蜂群输出。

关键词扫描命中 293 个前端源码文件、85 个后端 runtime 文件；大量命中是测试 fixture、诚实 source-label/fallback 处理、提示词中“禁止占位”的规则，并非临时假实现。完整路径清单用下列命令生成，不能把匹配数直接当缺陷数：

```bash
rg -l -i '\bmock\b|mock_|_mock|fixture|fallback|demo data|sample data|临时|占位' \
  frontend/src backend/src backend/web --glob '!**/*.lock' | sort
```

是否阻止上线：命名 mock 只要不可达或明确 DEMO/FALLBACK 不阻止；`session-auth`、公开页面、六部 fallback 若能在 production 被当 LIVE 使用则阻止。
最小修复范围：对四个首发界面做 reachability + sourceLabel 审计，production real 模式禁止 mock 数据晋升、裁决或归档；不做全仓机械删除。

## 14. 距离最小 V0.1 上线还缺哪些任务

1. 冻结并推送一个 clean 候选 SHA，停止并发漂移。
2. 修复 7 个前端 Node 测试失败，尤其礼部隐藏边界和已退役 BFF 测试。
3. 定位后端 P0 契约 pytest hang，恢复可重复通过。
4. 补齐锁定版本的 Ruff 和前端 Lint 门。
5. 明确首发四界面与五类角色权限，补匿名/跨角色/跨租户负向测试。
6. 配置前端 real 环境变量和 provider preflight，不提交秘密。
7. 用隔离 staging PostgreSQL 验证 Alembic 001–010 upgrade、旧库升级和回滚。
8. 用一份受支持的真实大陆法域 B2B 合同跑完整主链，证明证据、质量门、人工裁决和归档。
9. 配置 Gitee protected branch required check、外部 attestation 公钥/authority；生产门保持 fail closed 直到验证。
10. staging 完成 safe release、健康检查和真实 rollback drill，保存不可变证据。
11. 校正文档中的旧路由、`pnpm start`、`python`、BFF 注释和 base path。
12. 获得至少一个真实老板/裁决人完成一次决策并给出“这帮我了”的验收证据；客户扩张 5/3/1/1 是 1.0 解冻门，不必冒充 V0.1 已完成。

证据：第 9–13 节。
验证命令：每项对应问题卡命令。
是否阻止上线：1–10 均阻止外部 V0.1；11 应在发布前完成；12 是产品验收，不是纯技术门。
最小修复范围：严格限定在合同首发主线与四个界面，不扩张六部、庄园、翰林或其他第二切片。

## 15. 建议的最短上线关键路径（最多 10 项）

1. **冻结候选**：停止并发写入，审查/提交/推送现有工作，选定唯一 SHA。
2. **恢复基础门禁**：修 7 个前端失败、后端 contract hang、Ruff/前端 Lint，使静态与单测全绿。
3. **锁首发面**：production 只暴露上书房、刑部决策单、圣裁、史馆；其他模块隐藏/实验。
4. **锁权限**：完成匿名、客户成员、裁决人、租户管理员、内部运营的首发 API/UI 权限矩阵与负向测试。
5. **验迁移**：隔离 PostgreSQL 对空库和旧库跑 001–010 upgrade + rollback，不触碰生产。
6. **配 staging**：通过 secret store 注入 real/provider 变量，跑 provider、auth、DB、source-label preflight。
7. **跑真闭环**：一份受支持合同走拟旨、路由、outbox、刑部/证据、质量门、正式奏折、人工裁决、史馆。
8. **跑浏览器验收**：在同一 staging run 上执行四界面 Playwright、移动端/错误态/补证/驳回路径，零关键 skip。
9. **接外部门**：启用 Gitee required check 和外部 attestation/authority，从固定 SHA 产出签名发布包。
10. **演练上线与回滚**：staging safe deploy + canary + rollback drill 全通过后，才批准小范围 V0.1；生产仍保留人工签字闸。

最终 Go 条件：固定 SHA、clean worktree、静态/单测/E2E 全部通过、无关键 skip、staging 真合同闭环可追溯、角色/租户隔离通过、迁移与回滚通过、外部 required check 和签名发布门已生效。
