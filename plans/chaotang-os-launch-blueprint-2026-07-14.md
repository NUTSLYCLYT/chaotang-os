# 朝堂 OS 从当前态到公开上线：执行蓝图

> 状态：IN PROGRESS — 当前只执行 S1，不代表已上线
>
> 计划日期：2026-07-14
>
> 唯一代码真源：`/home/ubuntu/Projects/chaotang-os`
>
> S1 合入提交：`feature-chaotang-ext` / `93a4483`；本轮文档开始前 ext HEAD 为 `22dc4e2`，工作区仍保留待审主线变更
> 依赖路线图：`.harness/changes/docs-2026-launch-development-roadmap-20260712/roadmap.md`

## 0. 先给结论

朝堂 OS 当前可做内部演示，但不满足公开生产发布条件。2026-07-14 的只读检查得到：

- 根、前端、后端 harness doctor 均为 `0 errors / 0 warnings`；
- `3050 -> /chaotang`、后端 `8081` 和 LiteLLM `4444` 当前均有服务；
- 真实链健康检查为 ready，但 `pnpm prod:doctor -- --json` 判定为 **STOP**；
- STOP 的直接原因是 `3050` 属于旧工作区进程，且当前 monorepo 缺少 `frontend/builds` 不可变构建证据；
- S1 已将当前可执行 deploy/service/cron/monitor 入口收敛到 monorepo 或 manifest，并以 `93a4483` 合入 ext；运行时环境发现与发布门中的剩余旧路径仍需继续按 TDD 收口；
- 后端镜像仍在构建阶段创建管理员，虽然代码已不再使用 `admin123`，但凭据输出、镜像层和首次启动流程仍需重新设计；
- 历史 S1/S2/S10 事故记录确认测试曾污染真实控制面数据，因此测试隔离必须先于功能扩张；证据分别位于 `.harness/changes/incident-s1-real-db-test-pollution-20260713/`、`.harness/changes/incident-s2-real-db-test-pollution-20260713/`、`.harness/changes/incident-s10-control-db-v9-pollution-20260713/`；
- S1 待审队列已独立清算：10 项代码/契约验收合入，1 项 backend lease adapter 退回修正，未决为 0；该结论不改变生产 STOP。
- 外部独立 release/lease attestation trust anchor 尚未配置；本地检查即使全绿也不能签发生产 READY。

因此正确路线不是“继续完善全部六部”，而是：

1. 先让构建、数据、凭据和运行身份可信；
2. 再打通唯一付费主线：**刑部合同审查决策单**；
3. 用黄金样例和真实客户证明准确、有用、可收费；
4. 从内测、真实合同 beta、付费 POC 逐级放权；
5. 付费证据成立后，才进入公开上线和六部扩张。

## 1. 产品北极星与首发边界

### 1.1 一句话产品

中国制造业/B2B 经营者提交真实合同或商业问题，朝堂 OS 返回带证据、风险等级、缺失信息和下一步动作的决策单；最终决定始终由人确认，结果可导出、归档和复盘。

### 1.2 首个可收费切片

只发布一条主线：

`登录 -> 上传/粘贴合同 -> 补充背景 -> 生成真实风险判断 -> 展示条款证据与缺失材料 -> 人工确认 -> 导出决策单 -> 归档 -> 反馈`

首发不做：

- 不同时补齐六部全部页面；
- 不把 mock、fallback、静态推断标成 LIVE；
- 不自动执行付款、签约、对外承诺或删除等不可逆动作；
- 不先做复杂 agent 控制平面，再寻找客户问题；
- 不把 Obsidian 知识库当作线上事务数据库或客户数据存储；
- 不接入未经安全审查的 GitHub Agent 项目到生产主链。

### 1.3 六级上线阶梯

| 等级 | 环境 | 允许数据 | 放行条件 | 明确禁止 |
|---|---|---|---|---|
| L0 | 本地开发 | 合成数据 | 单测、类型、doctor | 宣称上线 |
| L1 | 内部演示 | 合成/脱敏数据 | 可信构建身份、核心 E2E | 外部真实客户 |
| L2 | 封闭 beta | 合成/匿名数据 | 步骤 1–7 全绿 | 上传真实合同 |
| L3 | 真实合同 beta | 经授权真实合同 | 步骤 1–8 全绿、数据协议生效 | 公开注册 |
| L4 | 付费 POC 入场 | 约定客户数据 | 步骤 1–8、合同/支持/删除 SLA | 大规模推广 |
| L5 | 公开生产 | 合规范围内真实数据 | S9 付费 POC 成功、P0/P1=0、步骤 10 全绿 | 无门槛高风险自动执行 |

升级只能逐级进行。任一级出现跨租户泄露、伪 LIVE、不可恢复数据损坏或高风险无引用，立即降级并冻结发布。

### 1.4 最终产品形态冻结

最终产品不是“六部聊天集合”或面向工程师的 Agent 编排器，而是 **证据优先、人工裁决的老板决策工作台**。首发时客户购买的具体产品是“刑部合同审查决策工作台”，底层朝堂组织与蜂群只负责让结果可靠、可解释、可恢复。

客户可见主线固定为：

```text
上书房建案
  -> 刑部合同审查（原文证据、风险、缺证、修订建议）
  -> 圣裁确认（采纳 / 补证 / 复核 / 驳回）
  -> 导出与史馆归档
```

产品交互遵守“一项任务、一个主按钮、一条状态线、一份正式奏折”：上书房是唯一正式入口；军机处展示内部路由、节点和恢复状态；六部与蜂群只生成分奏；御史质量门决定候选结果能否晋升；老板保留所有不可逆决定；史馆保存不可变证据链。

合同决策单的最小稳定输出为：合同版本、原文证据及位置、风险等级、解释、缺失证据、建议修订、来源标签、引擎等级、质量门结果、正式奏折标识和人工裁决状态。无原文证据的高风险结论不得晋升，`FALLBACK/DEMO` 永远不能伪装成可裁决事实。

首发客户不需要理解部门或 Agent 拓扑。大殿、军机处和其他部门在主线稳定前只作为按需展开的运营/解释界面。刑部主线达到“5 家真实客户、3 家复用、1 家付费、1 条证言”且黄金质量门持续通过后，第二条付费切片才可解冻。

## 2. 全局工程纪律

这些规则适用于下列每一个 PR：

1. 一个 PR 只解决一个可验证问题；先写失败测试或失败证据，再改代码。
2. 所有跨前后端功能先冻结契约：请求、响应、错误码、权限、超时、幂等键、事件状态。
3. 一次只允许一个写入者拥有某个路径；并行只用于只读审计、不同路径或独立 worktree。
4. 每个验收项必须附命令、退出码、commit SHA 和产物路径；UI 另附截图/trace。
5. 不能因 fallback 成功而把状态标成 LIVE；缺证据必须显示 `missing/degraded`。
6. 连续三次同因失败就停手，提交根因、证据和下一步，而不是盲试。
7. 每个 PR 必须写回滚办法；数据库变化必须有向前修复和恢复演练。
8. 模型输出只是不可信建议，身份、权限、金额、条款引用和执行动作必须由确定性代码验证。
9. 真实客户数据禁止进入日志、prompt fixture、截图、Obsidian vault 和 Git 历史。
10. 未通过独立复审的 `READY_FOR_REVIEW` 不计入上线能力。
11. 根级实质变更必须在 `.harness/changes/<change-id>/` 建立 spec、tasks、CI summary 和 summary；修改前端或后端 harness 时同步建立对应层级 change record，并重跑各层 doctor。
12. 行为变更固定执行 `test-driven-development`：先出现能复现目标缺口的 RED，再做最小 GREEN 和回归；纯文档/现状刻画测试不得伪造 RED。
13. 每个候选 PR 固定执行 `verification-loop`；发布候选必须额外覆盖真实浏览器、运行身份、恢复、回滚和外部信任锚，不能用单测替代。

### 模型分工

- 强推理模型：架构契约、安全边界、迁移方案、失败分析和最终复审；
- 常规模型：范围明确的实现、测试补齐、文档和机械重构；
- 小模型/本地工具：格式化、静态扫描、重复检查；不得独立做发布判定。

## 3. 依赖图与并行策略

```text
S1 真源与基线
  └─ S2 测试/凭据隔离
       └─ S3 生产拓扑与不可变身份
            └─ S4 代理/认证契约
                 └─ S5 租户与用户隔离
                      └─ S6.1 合同契约/状态机
                           └─ S8.1 数据流/Provider 政策/威胁模型
                                ├─ S6.2 -> S6.3 -> S6.4 -> S6.5
                                ├─ S7 数据集 -> scorer -> release gate
                                └─ S8.2 -> S8.3 -> S8.4 -> S8.5

S9 封闭试点 = S6.5 + S7 release gate + S8.5 全部通过
S10 公开上线 = S1–S9 全部通过
```

- S6.1 先冻结输出/状态机契约；随后必须完成 S8.1 数据流、provider 政策和威胁模型，才允许 S6.2 开始真实附件上传/解析。S7 的去标识案例采集/双人标注可在不接触线上客户数据时并行；S7 scorer/release gate 依赖 S6.1 的输出契约，S9 必须等待 S6.5、S7 release gate、S8.5 三路汇合；
- 最大建议并发为 3 个执行单元：1 个实现、1 个测试/评测、1 个只读复审；
- S1–S5 是可信地基，不能以“业务急”为由跳过；
- S9 之前不扩六部，S10 之前不开放公众注册。

### 上书房控制面与十阶段路线映射

| 控制面工作 | 归属阶段 |
| --- | --- |
| 契约现状、ADR、威胁与进程基线 | S1 |
| tenant/actor 字段、Alembic、对象授权 | S5 |
| 统一状态机、请求/响应、幂等、SSE | S4 + S6.1 |
| 请求级 timeout、durable worker、DLQ、恢复 | S8 |
| DepartmentAssignment/DAG、direct/council 真执行 | S6 + S8 |
| 御史 shadow/标注/enforce 质量门 | S7 |
| status 读模型与前端移除本地伪 LIVE | S4 + S6 |
| 圣裁、史馆归档、反馈 | S6.5 |
| canary、外部 trust anchor、回滚与 READY | S10 |

映射只合并执行顺序，不降低门槛；控制面细节必须服从十阶段的产品优先级。

## 4. 十步执行方案

### S1 — 冻结唯一真源并建立可信基线（PARTIAL）

**目标**：消灭“旧仓在运行、新仓在开发、文档指向第三处”的漂移。

**上下文**：根 `AGENTS.md` 已规定 monorepo 为唯一真源；当前 `3050` 却被旧工作区进程占用，部署文档仍引用旧分仓。多个 change record 尚未独立验收。

**建议 PR**：`chore/launch-source-of-truth-baseline`

**主要路径**：根 `.harness/`、`scripts/`、`frontend/deploy/`、`frontend/scripts/`、`frontend/docker-compose.yml`、`backend/Dockerfile`。

**任务**：

- 建立当前分支、worktree、服务 PID/cwd、端口、配置来源和 change record 状态清单；
- 将所有发布脚本、systemd 模板、compose 和 runbook 改为 monorepo 路径；
- 明确 backend 容器内端口与主机映射，删除/隔离 `../jiqun_ai_fresh` 构建依赖；
- 对所有 `READY_FOR_REVIEW` 逐项决定：验收合入、退回修正或明确废弃；
- 记录当前基线失败，不为得到绿灯而修改验收标准。

**S1.0 已实施的可信基线（2026-07-14）**：

- 已冻结上书房 draft/confirm/status/decision 的当前 OpenAPI 请求契约和 direct/council/mixed/422 行为样例；四个成功响应仍为宽松 object，明确列为 S4 阻断项；
- 已确认 status/decision 顶层硬编码 LIVE、direct 无真实 execution receipt、engineTier 缺失，均只记录不在 S1 越级修复；
- 已裁决：confirm 写 `planning_requested` outbox，durable planner 在事务外生成并落版本化军机处计划，再原子写 execution outbox；direct 进入 durable 单节点 executor；以持久化 assignment/DAG 控制面包裹现有蜂群算法，不立即重写或引入 Temporal；
- 已记录本机进程：3050 来自 `/home/ubuntu/workspace/frontend/chaotang-master-wt`，8081 来自当前 monorepo，4444 存在多监听且 `/v1/v1/models` 404；
- `prod:doctor` 仍为 STOP（foreign 3050 + 缺少 `frontend/builds`），此失败是正确结果；
- 证据入口：`.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/`。

**S1 已验证完成项**：

- 已在独立 worktree 形成 `c13d969`，并以 `93a4483` 无冲突合入 ext；三项旧路径修复均先 RED 后 GREEN，共 18/18 契约测试通过；
- 已完成 deploy/compose/runbook、backend service runtime、cron/monitor/restore 三个最小闭环，证据分别位于 `.harness/changes/fix-launch-s1-p0-canonical-deploy-paths-20260714/`、`.harness/changes/fix-launch-s1-backend-service-runtime-contract-20260714/`、`.harness/changes/fix-launch-s1-operational-source-paths-20260714/`；
- 已修复 restore dry-run 跳过 HTTP 与端口逆序匹配，S1 联合回归 20/20；证据位于 `.harness/changes/fix-system-restore-dry-run-health-20260714/`；
- 已逐项清算 11 个 `READY_FOR_REVIEW`：10 项验收合入、lease adapter 退回修正、0 未决；证据位于 `.harness/changes/chore-ready-for-review-triage-20260714/triage.md`；

**S1 未完成硬门**：

- foreign 3050 在 S1 保持 STOP/只读冻结；immutable artifact、接管与停机属于 S3，不作为 S1 退出条件；
- 运行时环境发现、release gate 等非上述闭环入口仍需继续枚举旧路径；
- 退回的 backend lease adapter 需补委托路径专项并修复 closeout 仓库形状 fixture；不阻塞 S1 真源退出，但在 S10 前不得计为发布能力；
- Gitee required check、外部 Ed25519 signer 和 lease-attestation authority 仍未配置，继续保持 `EXTERNAL_REQUIRED`。

**验证**：

```bash
cd /home/ubuntu/Projects/chaotang-os
git status --short
git worktree list
node scripts/harness-doctor.mjs
cd frontend && pnpm harness:doctor && pnpm prod:doctor -- --json
cd ../backend && python3 scripts/harness_doctor.py
```

**退出条件**：所有当前可执行部署/cron/service/monitor 入口只引用 monorepo 或 manifest；运行进程 cwd 可追溯且 foreign 3050 明确维持 STOP；待审变更有唯一结论；基线报告可由另一名执行者复现。S1 不构建 artifact、不接管端口。

**回滚**：只回滚文档/配置引用；不删除旧仓，先标只读并保留一个发布周期。

**模型**：强推理模型设计和复审，常规模型执行文档/路径收敛。

### S2 — 测试隔离、密钥与首次管理员安全

**目标**：让任何测试和镜像构建都无法污染真实数据或泄露初始凭据。

**上下文**：历史控制面测试污染过真实数据库；`backend/Dockerfile` 在 build 阶段调用 `ensure_admin()`。当前代码会生成随机密码并写日志，但镜像构建不是安全的首次凭据交付通道。

**本阶段拆成三个有序子 PR**：

1. `test/isolate-runtime-and-production-paths`：测试临时 DB/目录/端口和生产路径 tripwire；
2. `security/bootstrap-jwt-secret-lifecycle`：管理员首次 provisioning、JWT 强度、轮换和吊销；
3. `security/repository-and-image-secret-gate`：当前树、Git 历史、镜像层和提交前扫描。

**主要路径**：`backend/tests/`、`backend/src/tenant.py`、`backend/src/security.py`、`backend/Dockerfile`、根/前端控制面测试工具、`.harness/changes/<change-id>/`。

**任务**：

- 所有 Python/Node/E2E 测试强制使用临时数据库、临时数据根和测试专用端口；
- 增加生产路径 tripwire：测试环境一旦命中真实 DB、真实 runtime dir 或真实客户目录立即失败；
- 将 Docker build 中的 `ensure_admin()` 移到显式、一次性、可审计的首次启动/运维命令；
- 初始密码只从 secret store/交互式安全通道获得，日志不得打印完整秘密；
- 生产启用认证时强制高强度 JWT secret，补齐 secret 轮换 runbook；
- 用 allowlist-aware secret scanner 扫描 Git 历史和当前树中的真实 key、token、合同和个人信息；测试 fixture 中的故意弱口令必须通过文件级 allowlist 解释，不能用裸 `rg` 结果代替安全判定。

**验证**：

```bash
cd backend
pytest -q tests/test_ensure_admin_no_default_password.py tests/test_enforce_jwt_secret_strength.py
pytest -q tests/test_register_no_enumeration.py
<secret-scanner> --path . --allowlist tests/fixtures/secret-scan-allowlist.txt
<secret-scanner> --git-history --allowlist tests/fixtures/secret-scan-allowlist.txt
docker build --no-cache -t courtos-backend:test .
docker history --no-trunc courtos-backend:test
```

`<secret-scanner>` 是本 PR 必须选定并版本锁定的扫描器，不是可直接粘贴的命令。除 `docker history` 外还要导出镜像并扫描各层文件系统。另做破坏性测试的安全替身：在临时目录运行全套测试，前后比较生产 DB hash、mtime、行数和控制面审计事件，必须完全不变。

**退出条件**：测试零触碰真实数据；镜像层无管理员数据/秘密；冷启动无显式 secret 时 fail closed；轮换与吊销演练通过。

**回滚**：可保留显式的本地开发 bootstrap 命令，但生产镜像不得包含或调用它，不能只靠 `NODE_ENV` 字符串隔离。

**模型**：强推理模型做威胁边界，常规模型按 TDD 实现。

### S3 — 统一生产拓扑并建立不可变运行身份

**目标**：任何人都能回答“线上到底运行了哪个 commit、哪个构建、哪套 schema”。

**上下文**：当前 HTTP 健康，但 `prod:doctor` 因 foreign 3050 与缺少 immutable build 判 STOP；前端健康版本为 `unknown`，后端只返回 `1.0`。

**建议 PR**：`release/canonical-topology-and-runtime-identity`

**主要路径**：`frontend/scripts/prod-*`、`frontend/scripts/safe-prod-*`、`frontend/deploy/`、`frontend/src/app/**/health*`、`backend/web/`、`backend/Dockerfile`、`.harness/changes/<change-id>/`。

**任务**：

- 固定拓扑：前端 `3050 + /chaotang`；后端选定唯一容器端口并显式映射到主机 `8081`；LiteLLM `4444` 仅内网；
- 生成不可变 release artifact，manifest 至少含 commit、tree、build id、digest、build time、environment、schema revision；
- 前后端 `/api/health` 返回一致的发布身份，不泄露 secret；
- 让 systemd/compose 只启动 manifest 指向的产物，禁止直接从脏工作区生产启动；
- 解决 LiteLLM 当前 `/v1/v1/models` 双重路径探针问题；
- 发布前检查脏树、错误分支、foreign listener、非标准端口和旧服务残留。
- 新增 `frontend/scripts/prod-doctor-release-identity.itest.mjs`：使用 test adapter 构造 immutable frontend artifact 与 backend release identity，断言身份一致时 decision 可达预期、身份漂移/foreign 3050/错误 artifact 时 fail closed；机器产物写入 change record 的 `ci_result/artifacts/runtime-identity/`。

**验证**：

生产候选只能由仓库 canonical Release Commander 统一编排。操作员不得手工串联底层 `safe-prod-build/start/stop`；这些脚本只用于 commander 内部实现和组件测试。Commander 负责 `planned -> locked -> building -> starting -> verifying -> ready/failed`、release lease 心跳、子进程凭据注入、证据记录和失败停机。

若 3050 是 foreign listener，先由其原服务管理器停机，不能用 commander 冒充接管。S3 时外部 lease-attestation authority 尚未落地，因此不运行真实 `dry-run`，只用仓库 test adapter 验证状态机、心跳和底层编排：

```bash
cd /home/ubuntu/Projects/chaotang-os
node --test scripts/release-commander.nodetest.mjs
cd frontend
npx --yes tsx --test scripts/prod-runtime-identity.nodetest.ts scripts/safe-prod-lifecycle.nodetest.ts
node --test scripts/safe-prod-wrappers.nodetest.mjs scripts/prod-doctor-release-identity.itest.mjs
```

真实签名 dry-run 后移到 S10.0，在 lease-attestation 公钥和签名 authority 配置后执行。低层组件测试可验证 immutable build、supervisor、identity 和 doctor，但不能作为生产授权证据。

**退出条件**：上述全部测试均 exit 0；专项集成报告证明合法 immutable artifact 下 `prod:doctor` 身份门通过、前后端 health 关联同一 release，且身份漂移、错误 artifact、foreign 3050 均 fail closed；Commander 的状态迁移、心跳、失败停机和 READY 私有权限测试全绿。真实生产进程证据仍在 S10.0/R0 再验证一次。

**回滚**：只有 schema 已证明向后兼容时才能回切 N-1；否则进入维护模式并执行预演过的 forward-fix。切换 active manifest 后必须重新检查健康与数据兼容。

**模型**：强推理模型负责发布身份和回滚不变量。

### S4 — 契约优先打通 3050 → 8081、认证和错误语义

**目标**：前后端不再靠猜字段、猜状态、猜超时协作。

**上下文**：现有真实链可达，但上线主线需要对 GET/POST/SSE、cookie/JWT、错误状态、幂等和取消形成单一契约。

**建议 PR**：`feat/production-bff-auth-contract`

**主要路径**：`frontend/src/lib/upstreams.ts`、`frontend/src/lib/auth/`、`frontend/src/app/**/api/`、`frontend/src/lib/contracts/`、`backend/web/`、双方契约测试、`.harness/changes/<change-id>/`。

**任务**：

- 为跨前后端 transport 写版本化 OpenAPI/JSON Schema；冻结 envelope、认证、错误、幂等 header、SSE/取消和兼容政策；合同领域字段与业务状态机只由 S6.1 拥有，S4 只引用；
- 定义 `401/403/404/409/422/429/5xx/timeout` 的前后端展示和重试语义；
- BFF 只从集中 upstream 配置读取 8081，不接受浏览器注入上游 URL；
- POST 使用幂等键；SSE/长任务支持 request id、task id、取消和断线恢复；
- 先写消费方契约测试，再写提供方测试，最后跑真实代理 smoke；
- 伪造 `alg:none`、过期 token、错租户 token 必须被拒绝。

**验证**：

```bash
cd frontend
pnpm guard:auth
pnpm guard:upstreams
pnpm exec tsc --noEmit
pnpm test:node
node scripts/jiqun-contract-smoke.mjs
```

加上针对真实 `3050/chaotang/api/...` 的 GET、POST、SSE、超时、重复提交和后端下线矩阵。

**退出条件**：契约测试双方全绿；断开 8081 时前端诚实显示 degraded/failed；重复 POST 不创建重复任务。

**回滚**：保留兼容一版旧响应的 adapter；数据库写入用幂等键防止回滚后重放。

**模型**：强推理模型冻结契约；常规模型分别实现前后端。

### S5 — 租户、用户和对象级授权闭环

**目标**：用户只能看到和操作自己租户、自己有权限的任务、合同、归档和下载。

**上下文**：线程租户继承曾发生静默回落；DecisionTask、事件、下载和归档都必须证明对象级权限，而不只是页面需要登录。

**建议 PR**：`security/tenant-user-object-isolation`

**主要路径**：`backend/src/tenant.py`、`backend/src/chaotang_store.py`、`backend/web/`、`frontend/src/lib/auth/`、DecisionTask/归档/导出相关路由与测试。

**任务**：

- 建立授权矩阵：角色 × 租户 × 对象 × 动作；默认拒绝；
- 每个查询、下载、导出、事件流和后台 worker 显式携带 `tenant_id/user_id`；
- 禁止客户端传入的 tenant id 覆盖服务端身份；
- 修复线程、队列、重试和 outbox 中的租户上下文传播；
- 加入双租户/双用户黑盒测试，覆盖可枚举 ID、直接 URL、SSE 和导出链接；
- 审计日志记录主体、对象、动作、结果和 request id，但不记录合同全文。

**验证**：

```bash
cd frontend
pnpm guard:tenant
pnpm guard:auth
cd ../backend
pytest -q -k "tenant or authorization or register_no_enumeration"
```

**退出条件**：跨租户泄露 0、跨用户未授权 0；所有后台任务能证明原始主体；ID 枚举与缓存串租户测试全绿。

**回滚**：权限不确定时收紧到只读/拒绝，不允许为可用性退回宽松默认。

**模型**：强推理模型做授权审查；独立复审者只读验证。

### S6 — 完成“刑部合同审查决策单”端到端付费闭环

**目标**：让一个没有工程师陪同的目标客户在 3 分钟内得到可采取行动的决策单。

**上下文**：这是唯一首发业务，不以六部齐全为验收。所有输出必须区分原文事实、模型推断、缺失证据和建议动作。

**本阶段不是单一大 PR**，按以下顺序拆分，每个子 PR 都建立根 change record：

1. `feat/contract-review-contract-and-state-machine`：冻结 schema、状态机、权限、幂等和错误语义；
2. `feat/contract-ingest-and-evidence-location`：安全上传、解析、页/段证据定位；
3. `feat/contract-risk-decision-card`：风险项、缺失证据、人工门和决策单；
4. `feat/contract-review-ui-and-recovery`：单入口 UI、轮询/SSE、失败恢复和人工确认；
5. `feat/contract-export-archive-feedback`：导出、归档和结构化反馈。

**主要路径**：`frontend/src/core/courtos/xingbu/`、`frontend/src/app/` 下刑部页面与 BFF route、`backend/web/`、合同解析/决策单/归档服务、双方专项测试、`.harness/changes/<change-id>/`。

**任务**：

- 在 S6.1 冻结首发法律范围：仅支持中文、中华人民共和国大陆法域、目标客户日常 B2B 采购/销售/服务合同；跨境、劳动、证券金融、强监管行业专项合同和无法确定适用法的材料必须 fail closed，明确转人工法律审查，不生成“可签”结论；
- 上传限制文件类型、大小、页数和恶意内容；抽取失败可恢复；
- 合同文本按页/段定位，风险项必须链接回原文证据；
- 输出固定结构：风险等级、原文引用、为何有风险、缺失材料、建议修改、禁止自动承诺事项；
- 高风险或证据不足必须触发人工确认，不能自动“准奏”；
- 实现草稿、处理中、需补资料、待确认、已完成、失败、取消状态机；
- 导出 PDF/Markdown 和史馆归档；用户接受/驳回/改写形成结构化反馈；
- UI 只保留一个入口、一个主 CTA 和一条主路径，隐藏未达标功能。

**阶段验证**：每个子 PR 先运行其新增的具名专项测试（路径在该 PR 的 tasks 中冻结，期望 exit 0），再运行：

```bash
cd frontend
pnpm exec tsc --noEmit
pnpm test:node
pnpm build
pnpm test:e2e
```

另跑 10 个匿名合同的全浏览器闭环，机器产物固定写入该 change record 的 `ci_result/artifacts/contract-e2e/`，验证 10/10 主流程终止、失败恢复、导出一致性、人工确认事件和无伪 LIVE。自动合同样本不能证明“无陪同完成率”。

可用性另设至少 5 名符合目标画像、未参与开发的测试者，每人按同一任务脚本独立完成一次；成功定义为不经工程师指导完成上传、理解至少一个风险证据、作出人工决定并导出。观察记录、计时和去标识反馈写入 `ci_result/artifacts/usability/`；至少 4/5 完成，完成者首次价值中位数 ≤3 分钟。

**退出条件**：机器门 10/10；目标画像测试者至少 4/5 无陪同完成，完成者首次价值中位数 ≤3 分钟，至少 4/5 作出人工决定；失败可恢复且无伪 LIVE。真实客户复用与付费仍由 S9 证明。

**回滚**：功能旗标关闭合同入口；已生成决策单保持只读可导出，不丢用户数据。

**模型**：强推理模型审查业务状态机，常规模型实现各纵切面。

### S7 — 建立黄金样例、幻觉门和质量飞轮

**目标**：把“感觉挺聪明”变成可重复、可回归、能阻止发布的质量标准。

**上下文**：法律建议的关键失败不是文风差，而是虚构条款、漏掉高风险、引用错位和把未知说成确定。

**建议子 PR**：

1. `test/contract-golden-dataset-schema`：案例 schema、30+ 去标识化案例和人工复核记录；
2. `test/contract-golden-runner`：专用只读 runner、隔离输出、确定性 scorer；
3. `test/contract-hallucination-release-gate`：legal redteam、御史门和 release gate 集成。

**主要路径**：新建 `backend/harness/contract-review-quality/`，复用 `backend/harness/legal-redteam/`、`backend/harness/yushi_global_gate/`，并修改 `backend/tests/` 和前端 release gate 集成点。现有 `chaotang-commercial-loop` 只有 3 个商业销售案例，不能作为合同 30 例门。

**任务**：

- 建立至少 30 个去标识化黄金案例，覆盖付款、交付、验收、违约、IP、保密、终止、争议、保证收益等；每例记录来源授权、司法辖区、语言和去标识化证明；
- 首发总门只计算中文、中华人民共和国大陆法域的目标 B2B 合同；指标必须同时按合同类型分层报告，任何不支持法域/语言或排除类型不得混入分母，并应验证 fail-closed/人工升级；
- 每例由两名有合同审查经验者独立标注“必须发现、严重度、允许差异、必须引用、禁止声称和人工升级条件”，分歧由第三人/指定领域负责人仲裁并留记录；
- 每次评测锁定并记录 model、prompt、provider、知识库/检索器和 scorer 版本；
- 质量指标分开：引用正确率、重大风险召回、误报率、缺证据标记、结构完整性、稳定性、成本和延迟；
- 对抗样例覆盖提示注入、恶意附件、矛盾条款、扫描件、空文档、超长文档和诱导虚构法律依据；
- 评测失败阻止发布，不允许仅靠另一个 LLM 的主观打分放行；
- 将真实用户反馈经人工去标识、复核后加入回归集，不能直接学习客户原文。

**硬门槛**：

- 高风险结论引用覆盖率 100%；
- 虚构合同条款 0；
- 缺失证据显式标注率 100%；
- P0 致命风险至少包含 10 个独立标注 finding，召回率必须 100%；P1 重大风险至少包含 20 个独立标注 finding，召回率必须 ≥90%；
- 高风险 precision 必须 ≥80%（误报率 ≤20%）；样本不足、分母为 0 或标签未仲裁一律 fail closed，禁止真空 100%；
- 单例成本和 P95 延迟必须有预算且持续可见。

**验证**：

专用 runner 在子 PR 2 中实现，并必须提供显式只读/隔离参数。目标接口如下，接口和路径由契约测试锁定后才算可执行：

```bash
cd backend
pytest -q tests/test_contract_review_quality_harness.py tests/test_legal_redteam_harness.py tests/test_yushi_global_gate.py tests/test_yushi_verdict.py tests/test_contract_quality_release_gate.py
python3 harness/contract-review-quality/scripts/run_contract_quality.py \
  --cases harness/contract-review-quality/golden_cases/contracts.json \
  --output .harness-tmp/contract-quality/run-1.json --no-ledger-write
```

禁止用 `chaotang-commercial-loop` 的默认 runner 代替。对非确定模型用固定模型/参数连续运行至少 3 次，输出 `run-1.json` 至 `run-3.json` 和方差报告；人工抽查所有高风险和所有模型分歧样例。所有产物复制到对应 change record 的 `ci_result/artifacts/contract-quality/`。

**退出条件**：质量报告可复现；任何结论可定位到证据或明确标成推断；门槛接入 release gate。

**回滚**：模型/prompt/知识库按版本回切；新版本不过门不得替换线上版本。

**模型**：强推理模型生成候选分析，但黄金标签由人审核；确定性程序做最终计分。

### S8 — 可观测性、数据生命周期、安全与恢复

**目标**：真实合同进入系统前，团队能发现故障、控制成本、删除数据并从灾难恢复。

**上下文**：当前 true-chain 可见部分依赖 degraded；Shangshufang outbox 曾停在 `processing`；生产必须能从单个用户操作追到后端任务和模型调用。

**本阶段拆成五个有序子 PR**：

1. `design/contract-data-flow-threat-model`：真实合同启用前冻结数据流、provider 政策、威胁模型和日志红线；
2. `ops/task-trace-and-outbox-recovery`：trace contract、租约、超时、死信和卡住任务恢复；
3. `privacy/data-retention-export-delete`：保留期、导出、可验证删除和审计；
4. `ops/encrypted-backup-restore-drill`：加密备份、空机恢复、RPO/RTO 实测；
5. `security/contract-ingest-and-incident-response`：附件、SSRF、注入、依赖/费用滥用和事故演练。

**主要路径**：前后端任务/outbox/日志模块、`frontend/scripts/`、`frontend/deploy/`、备份恢复脚本、`.harness/changes/<change-id>/` 证据包。

**任务**：

- 全链路统一 `request_id/task_id/tenant_id/release_id/model_version`；
- 为上传、抽取、模型调用、引用验证、人工确认、导出和删除建立结构化事件；
- 定义 SLI/SLO：可用性、任务成功率、P95 延迟、队列年龄、卡住任务、模型错误率和单位成本；
- outbox 增加超时、租约、重试上限、死信和人工恢复；根治永久 `processing`；
- 日志、trace、告警和截图自动脱敏；设保留期、导出和可验证删除；
- 备份加密，完成一次从空机器恢复和一次单客户删除演练；
- 建立 P0/P1/P2 事故响应、值班、状态页、客户通知和 postmortem 模板；
- 对附件解析、SSRF、提示注入、依赖供应链、上传病毒和费用滥用做安全测试。

**阶段验证**：每个子 PR 必须新增具名专项测试并将机器输出写入自身 `ci_result/artifacts/`；阶段末组合演练：

- 人为让后端、LLM、对象存储分别故障，确认告警、用户提示和恢复；
- 创建一条任务并用一个 request id 查到全链路，但日志中不能还原合同正文；
- 恢复备份后核对数据数量、hash、schema 和权限；
- 删除一个测试客户后证明主库、对象存储、索引、缓存和后续备份策略均符合约定。

**退出条件**：无不可解释的卡住任务；P0 演练达标；RPO/RTO 被实测而非只写文档；数据删除有机器证据。

**回滚**：观测组件故障不得拖垮主链；涉及安全审计的核心事件写入失败则高风险动作 fail closed。

**模型**：强推理模型做故障树和威胁模型；常规模型补 instrumentation。

### S9 — 5 家客户封闭试点并完成首个付费 POC

**目标**：证明产品不是工程演示，而是有人重复使用并愿意付费的工作流。

**上下文**：工程绿不等于商业成立。试点必须观察客户独立完成真实任务，不以“喜欢这个想法”作为成功。

**建议变更包**：`pilot/contract-review-five-customer-poc`（以运营证据和小修 PR 为主）

**主要路径**：`.harness/changes/` 试点证据包、`courtos-brain/` 去标识化决策记忆，以及由实际阻塞触发的独立小修 PR。

**任务**：

- 选择 5 家目标一致的制造/B2B 客户，签署数据处理、保密、免责声明和支持约定；
- 先用匿名样例演练，再由明确授权客户进入真实合同 beta；
- 每次观察：进入原因、完成时间、卡点、采纳/驳回、人工修改、是否再次使用；
- 每周只修阻断主链的前三个问题，不扩功能面；
- 定义收费单元：按份、按席位或 POC 固定费，只选一个先验证；
- 至少获得 1 个付费 POC、1 个可公开匿名案例和明确续用信号；
- 将反馈沉淀到 Obsidian：问题、决定、证据、实验、结论分开；客户原文只留安全系统中的引用 ID。

**成功门槛**：

- 5 家完成试用；至少 3 家在首次任务完成后的 30 天观察窗内，无团队主动提醒，使用同一“上传合同 -> 决策单 -> 人工裁决 -> 归档”工作流完成第二份合同；中途退出者仍计入 5 家分母；
- 无陪同完成率 ≥80%；人工决策完成率 ≥80%；
- 至少 1 家完成可核验付款，至少 1 家书面授权一条可引用客户证言；同一家可以同时满足两项，但不得把口头意向计为付款或证言；
- 未关闭的 release-severity P0/P1 incidents 为 0；跨租户、伪 LIVE、虚构条款均为 0。

**退出条件**：达标才进入 L5；未达标则保持 L3/L4，按证据调整定位或主链，不用更多功能掩盖问题。

**回滚**：关闭新客户邀请，保留已有客户只读/导出/删除能力并按合同完成支持。

**模型**：常规模型整理匿名反馈；强推理模型做每周证据复盘，产品负责人作最终决定。

### S10 — 公开生产发布与上线后飞轮

**目标**：在已证明可收费后，以可回滚、可监控、可限流的方式开放生产。

**上下文**：公开发布是最后一道门，不是寻找产品方向的实验。S1–S9 未完成时禁止执行本步骤。

**本阶段分为管理员前置和发布 PR**：

1. `S10.0 外部发布信任落地`（管理员/平台任务，不是普通代码 PR）；
2. `release/public-production-v1`（只有 S10.0 验证通过后才可执行）。

**主要路径**：根 `scripts/release-commander.mjs`、`scripts/lib/release-evidence-*`、外部 Gitee required check/独立签名服务、`frontend/scripts/prod-*`、`frontend/deploy/`、版本与发布说明；原则上不在发布 PR 混入业务功能。

**任务**：

- **S10.0 硬前置**：在受保护 base branch 配置不可绕过的 required check；由独立于发布主机的 authority 保管 Ed25519 私钥，仓库/控制面只固定公钥摘要和 key id；让外部 authority 对 release evidence checkpoint 签名并可独立验证；
- 同时落地 lease-attestation 公钥/签名 authority；用真实签名执行一次 `release-commander.mjs dry-run`，确认完整状态迁移和证据成立但 dry-run 绝不 READY；
- 实现密钥撤销、轮换、authority 不可用和签名重放的 fail-closed 流程；证明 tampered、revoked、local-only checkpoint 均不能得到 READY；
- 将当前 `readyEligible:false / EXTERNAL_REQUIRED` 只在外部 checkpoint 验证成功时变为 true；不得增加本地 bypass；
- 从干净受保护分支生成签名 release artifact、SBOM 和 release notes；
- staging 使用生产同构配置和匿名数据，运行完整 release gate；
- 小流量 canary：内部账号 -> 试点账号 -> 邀请制新客户；观察一个完整业务周期后再扩大；
- 设置配额、限流、费用上限、熔断、只读模式、kill switch 和功能旗标；
- 发布状态页、隐私政策、服务条款、法律边界、支持入口和删除申请流程；
- 上线后 24 小时重点监控，72 小时复盘；任何硬门失败自动停止扩流；
- 只有付费主线稳定后，才按客户证据逐个解冻其他部院。

**最终发布命令族**：先完成普通 CI：

```bash
cd /home/ubuntu/Projects/chaotang-os
node scripts/harness-doctor.mjs
cd backend && python3 scripts/harness_doctor.py && pytest -q
cd ../frontend
pnpm harness:doctor
pnpm exec tsc --noEmit
pnpm test:node
NEXT_PUBLIC_API_MODE=real pnpm build
```

确认 `node scripts/rollout-control.mjs status` 不再是 `EXTERNAL_REQUIRED`，且外部 trust anchor 演练全绿后，只启动一个受监管的 canonical Release Commander 进程。它内部负责低层 build/start/gate、每 10 秒 heartbeat、状态迁移、证据和失败停机：

```bash
cd /home/ubuntu/Projects/chaotang-os
node scripts/release-commander.mjs run-production \
  --release <release-id> --task <authorized-task-id> \
  --commander <owner> --attestation sha256:<verified-request-digest> \
  --previous <last-ready-release-id> \
  --cwd /home/ubuntu/Projects/chaotang-os
```

首次没有上一 READY release 时，在外部 trust anchor 已生效后，用同一个 `run-production` 流程省略 `--previous` 建立 R0 受控基线，但不得把没有回滚目标的 R0 扩到公众流量。随后创建 `R1-drill --previous R0`，在 verifying/gate 阶段使用受控故障注入让它进入 `FAILED`；再调用 canonical rollback（当前实现会为 FAILED release 重新取得新 epoch），并验证运行身份、build id、artifact digest 和 health 全部恢复 R0：

```bash
node scripts/release-commander.mjs rollback \
  --release <R1-drill-release-id> \
  --reason "controlled N-1 rollback drill" \
  --cwd /home/ubuntu/Projects/chaotang-os
```

当前实现只允许 ACTIVE/FAILED release 进入 rollback，因此演练必须在 R1-drill 的 FAILED 状态执行；`--previous` 本身不是回滚证据。演练通过后，使用**全新 release id** 发布正式 R1（`--previous R0`）。该 bootstrap/故障注入/凭据交接必须先有契约测试和管理员 runbook。操作员不得直接调用 `safe-prod-*` 获取生产 READY。

真实发布须使用合法任务、lease attestation 和外部签名，不得使用测试 bypass。命令、退出码、状态迁移、heartbeat、commit、artifact digest、外部 checkpoint、浏览器 trace、回滚演练和批准人共同构成发布证据包。

**退出条件**：真实 `run-production` 获得私有 `READY`；tampered/revoked/local-only/authority-down 四类演练全部 STOP；R1-drill 从 FAILED 经 canonical rollback 恢复 R0 的身份与健康证据成立；正式 R1 使用新 release id；release gate 全绿；canary 期间 SLO 达标；未关闭的 release-severity P0/P1 incidents=0；备份恢复在本 release 上实测。

**回滚**：自动停止扩流，切 N-1 不可变产物；若 schema 不向后兼容则进入维护模式并执行预演过的向前修复，禁止临场手改生产库。

**模型**：强推理模型只做审查和诊断；发布权属于确定性 gate 与授权人。

## 5. 发布总门：Go / No-Go 清单

### 产品门

- [ ] 首发只有刑部合同闭环，目标客户能独立完成；
- [ ] 首次价值 ≤3 分钟，无陪同完成率 ≥80%；
- [ ] 5 家试点、3 家复用、1 家付费、1 条证言；
- [ ] 用户清楚知道系统不是律师、最终决定由人承担。

### 质量门

- [ ] 30+ 黄金案例可复现；
- [ ] 高风险引用覆盖率 100%，虚构条款 0；
- [ ] 缺证据标注率 100%，重大风险无显著回退；
- [ ] 类型、单测、构建、E2E、真实链和 release gate 全绿。

### 安全与数据门

- [ ] 跨租户泄露 0，跨用户未授权 0；
- [ ] 测试无法触碰生产数据库和客户目录；
- [ ] 镜像、日志、Git 和 Obsidian 无 secret/客户原文；
- [ ] 删除、备份恢复、密钥轮换和事故响应演练通过。

### 运行门

- [ ] 线上进程、commit、artifact、schema 可证明一致；
- [ ] `prod:doctor` 判定 `PROD`，无 foreign listener；
- [ ] SLI/SLO、告警、成本、队列和卡住任务可见；
- [ ] N-1 回滚实测成功，未关闭的 release-severity P0/P1 incidents=0。
- [ ] 外部独立 trust anchor 已配置；真实 Commander `run-production` 获得 READY，tampered/revoked/local-only 均 STOP。

任一硬门未通过即 No-Go；不得用口头批准覆盖机器证据。

## 6. Obsidian 与 Agent 工具怎样服务项目

### Obsidian：只做“决策记忆层”

在 `courtos-brain/` 的既定边界内建立以下知识类型，不让它进入代码执行主线：

- `Projects/Chaotang-Launch`：每个 S1–S10 的目标、负责人、证据链接和结论；
- `Decisions`：为什么选择单一刑部切片、为何拒绝某项扩张；
- `Incidents`：事实、影响、时间线、根因、修复和预防；
- `Customers`：只存去标识反馈、痛点和实验结论，不存合同正文；
- `Golden-Cases`：只存案例 ID、标签说明和评测报告链接；
- `Weekly-Review`：指标变化、最大学习、下周唯一瓶颈。

每条笔记必须链接到可验证证据（commit、change record、CI、trace、指标），不能把聊天总结当事实。

### GitHub/Gitee Agent 项目：走准入制，不“周榜即安装”

候选 agent 工具只能按以下顺序进入：

1. 在隔离环境做许可证、维护状态、依赖、网络权限、secret 和供应链审查；
2. 先用于只读任务：代码检索、文档整理、测试建议；
3. 再用于受限写入：独立 worktree、路径所有权、禁止生产凭据；
4. 必须通过现有 harness、TDD、独立 review 和证据门；
5. 永不直接获得生产发布、客户数据删除、密钥管理或合并主分支权限。

优先用仓库已有能力，只有明确减少瓶颈且能被验证时才新增 agent。Agent 数量不是产能指标，交付周期、缺陷逃逸率和客户价值才是。

## 7. 建议节奏与负责人

| 周期 | 重点 | 结果 |
|---|---|---|
| 目标周期 1 | S1–S2 | 真源、测试、secret 安全可信 |
| 目标周期 2 | S3–S4 | 可证明的生产拓扑和稳定契约 |
| 目标周期 3–4 | S5–S6 | 租户隔离与合同端到端闭环 |
| 目标周期 5–6 | S7–S8 | 黄金评测、观测、隐私与恢复 |
| 至少 2 个真实使用周期 | S9 | 5 客户封闭试点和快速修阻塞 |
| 证据达标后 | S10 | 付费 POC 转邀请制公开生产 |

这是按至少 1 名产品负责人、2 名工程执行者、1 名独立安全/可靠性复审者估算的容量假设，不是日期承诺。资源更少就顺延；只按退出证据推进，某一步未绿，后续步骤不得用“已经开始”伪装完成。

建议最小角色：

- 产品负责人：首发范围、客户选择、最终 Go/No-Go；
- 工程负责人：契约、合并顺序、发布身份；
- 安全/可靠性复审者：独立只读审查、故障和恢复演练；
- 领域专家：黄金案例和高风险结论人工标注；
- 客户成功：试点观察、支持和续用证据。

## 8. 第一个工作日只做什么

不要同时启动十步。第一天只执行 S1：

1. `[完成]` 从当前脏工作区保留用户改动，不做 reset；
2. `[完成]` 固化当前 STOP、服务 PID/cwd、上书房契约、ADR 与威胁基线；
3. `[完成]` 列出并修复当前可执行部署/cron/service/monitor 中的旧路径与 sibling repo 依赖，历史文档只归档不机械改写；
4. `[完成]` 在独立 worktree/分支承载 S1 路径收敛实现，以 `93a4483` 合入 ext；
5. `[完成]` 对 11 个 `READY_FOR_REVIEW` 给出唯一结论：10 验收合入、1 退回修正、0 未决；
6. `[进行中]` S1 路径与 restore dry-run 闭环已执行 verification-loop；继续枚举剩余运行入口并完成独立复审后才进入 S2；
7. `[移交 S3]` immutable artifact、3050 接管和由原服务管理器停止 foreign 进程。

这样做看似慢一天，实际会避免后续所有“改对了仓库但线上没变”“测试通过却污染真库”“健康 200 却不知道跑的谁”的返工。

## 9. 计划登记与维护

- 本文件是现有 2026 上线路线图的执行化补充，不替代 `.harness/` 规则；
- 上书房到蜂群的生产控制面细化方案位于 `.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md`；两份计划发生冲突时，先写 ADR，不允许静默选择；
- 当前 S1 基线证据位于 `.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/`；
- 每完成一步，只更新该步的证据链接、实际结果和偏差，不重写历史结论；
- 任何范围变化先写 Decision Record，并说明对依赖图、上线等级和回滚的影响；
- 计划完成的定义不是十个 PR 合并，而是 L5 的产品、质量、安全、运行四类硬门全部有证据。
