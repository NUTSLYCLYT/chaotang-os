# 任务：中央锦衣卫证据服务

## Status

Blocked

## Product Definition

- 用户确认：2026-07-20，用户确认采用“中央锦衣卫证据服务”方案并授权自动交付。
- 问题：业务 Agent 缺少数据时只能描述缺口或依赖模型常识继续推演，缺乏统一、可追溯且安全的数据补给能力。
- 目标用户：六部、各司、军机处、丞相等业务 Agent，以及查看调查依据的系统使用者。
- 目标：让司级 Agent 用结构化缺数单请求锦衣卫；锦衣卫按“史馆 → 注册公开 API → 公开网页”补充证据，返回冻结、可追溯的证据包，并最多恢复原司级 Agent 一次。部级、军机处和丞相不调用锦衣卫。
- 非目标：登录私有系统、绕过付费墙或验证码、联系外部人员、执行购买或申请、持续监控、让锦衣卫代替业务 Agent 作结论。

## Acceptance Criteria

- [x] 提供严格校验的 `DataGapRequest`、`EvidenceItem`、`EvidencePack` 契约；缺数项限制为 1–5 项，状态和来源枚举稳定。
- [x] 史馆已有且满足时效与覆盖要求时不访问公网；不足时只继续调查未解决的事实槽位。
- [x] 公开 API 只能来自显式注册表；公开网页经可替换搜索提供器发现，并由安全抓取器读取最小必要内容。
- [x] 只允许 HTTPS 公网地址；阻断本机、私网、链路本地、云元数据、DNS 重绑定及危险重定向，并限制超时、体积、MIME 和重定向次数。
- [x] 公网请求不携带 Cookie、Authorization、密钥、完整业务提示或私人内容；网页内容始终按不可信数据处理。
- [x] 证据包含来源、发布者、时间、质量、立场、最小摘录、内容哈希与规则计算的置信度；冲突和证据不足不得标记为已解决。
- [x] 只有司级 Agent 能触发调查；同一司级 Agent 最多调查并恢复一次，第二次仍缺数时输出明确限制，不形成循环；部级、军机处、丞相保持原契约且不调用锦衣卫。
- [x] 锦衣卫使用独立 SQLite 存储调查、证据、来源尝试、缓存和采用关系，不新增史馆档案类型。
- [x] 新回奏可挂接最终采用的证据引用；未采用材料只留在锦衣卫调查记录。
- [x] 后端提供只读调查列表、详情和汇总 API；前端提供只读 `/jinyiwei` 调查台，不提供任意 URL 输入、编辑或删除操作。
- [x] 外部网络能力受特性开关控制，默认关闭；离线测试覆盖正常、部分、冲突、超时、缓存与安全边界。
- [ ] 在安全检查通过后完成一次无登录、无副作用的真实公网冒烟并记录证据；不运行真实下旨业务流。

## Delivery Constraints

- 范围：`backend/app/jinyiwei/`、相关 Agent 协议与编排、锦衣卫 API、回奏证据挂接、`frontend/src/app/jinyiwei/`、前端 BFF/客户端、相关测试和文档。
- 兼容性：保持既有下旨、六部、史馆双文种和 `/study` 行为；既有 API 默认响应不破坏。
- 风险与限制：公网抓取必须先过 SSRF 安全闸门；不得把不可信网页当指令；不得提交运行态 SQLite、密钥或真实私人数据。
- 技能计划：`brainstorming`、`writing-plans`、`product-flow`、`codex-engineering-workflow`、`test-driven-development`、`record-decision`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。
- 外部动作：本任务未授权提交、推送、发布或部署；联网只允许验收标准中的无副作用公开数据冒烟。

## Affected Modules

- 模块：候选模块“锦衣卫证据域”、业务 Agent 缺数/恢复协议、史馆回奏证据引用、锦衣卫只读调查台。
- 允许路径：`backend/app/jinyiwei/**`、`backend/app/agents/**`、`backend/app/shiguan/**`、`backend/app/api/**`、`backend/app/main.py`、`backend/tests/**`、`frontend/src/app/jinyiwei/**`、`frontend/src/app/api/jinyiwei/**`、`frontend/src/lib/**`、`frontend/src/**/*.test.*`、`docs/**`、必要的 AGENTS/架构/检查脚本。
- 依赖模块：史馆召回与回奏归档、既有模型调用层、Next.js BFF。

## Technical Plan

- 架构边界：独立的证据域负责缺数校验、来源编排、安全访问、证据抽取、证据核验与持久化；只有司级 Agent 声明缺口和消费冻结证据包，上级 Agent 只消费司级意见；史馆只保存最终回奏及采用证据引用。首版公开网页发现限定为 Wikimedia 官方搜索并明确标识，不宣传为通用全网搜索。
- 接口与依赖：新增同步领域模型/来源端口、公开 API 注册表、Wikimedia 搜索端口、固定解析 IP 的安全 HTTPS Fetcher、受限 EvidenceExtractor、调查协调器、司级 Agent Resume Adapter、只读 API/BFF/UI；不新增生产依赖。
- 实施顺序：先契约和存储，再来源与安全网络，再协调器，随后接入业务 Agent 和回奏，最后 API/UI。
- 验证计划：每个模块先写失败测试；运行后端/前端专项测试、lint/typecheck/build、仓库 harness、浏览器验收和一次安全公网冒烟。
- 技术风险：Wikimedia 提供器的稳定性与覆盖范围、固定 IP HTTPS 实现、Agent 输出兼容、跨 SQLite 采用关系最终一致性、回奏引用迁移；提供器不可用时必须显式降级为 PARTIAL/UNAVAILABLE。

## Implementation Report

- 改动摘要（Task 1–10）：
  - 新增 `backend/app/jinyiwei/` 严格契约、领域错误、独立 SQLite v1、来源端口、史馆适配、
    Wikidata 注册 API、`WIKIMEDIA_ONLY` 页面来源、固定解析 IP 的 HTTPS 安全边界、结构化
    抽取、确定性核验、调查协调/缓存、冻结证据包和只读查询模型。
  - 新增 `backend/app/agents/evidence_protocol.py` 并只在 39 司的意见节点接入一次调查/恢复；
    部级、军机处和丞相只向下传递会话。丞相图输出有序采用 ID，并只在首次成功非缓存调查后
    插入一次“锦衣卫（调查）”。
  - 史馆升级为 schema v3，以 `archive_evidence_references` 原子保存最终采用证据的不可变
    快照；锦衣卫通过完整批次 PENDING/CONFIRMED 采用关系支持跨库对账，不新增档案类型且不
    改变下旨成功响应。
  - 后端新增三个 GET-only 锦衣卫汇总/列表/详情 API；前端新增严格服务端客户端、三个同源
    GET-only BFF 与 `/jinyiwei` 只读调查台，没有任意 URL、采集触发、编辑或删除能力。
  - 新增 ADR 0018，并同步 `ARCHITECTURE.md`、前后端 `AGENTS.md` 与 harness 基线，记录独立
    领域/数据库、来源顺序、联网开关与 SSRF 边界、司级唯一调用权、回奏采用和安全冒烟方式。
- 自审：各模块在 TDD 后分别经过契约/质量/安全审查并修复了缓存误记调查、流转路径位置、
  采用顺序/幂等时间/批次子集、只读 API 孤儿数据隐藏等问题；所有测试使用临时 SQLite 或
  离线 stub，未读写运行库。
- 验证（Task 1–11）：契约 60 项；存储 14 项连续两次；史馆来源 10 项；公网安全 72
  项；公开来源回归 170 项；协调器回归 218 项；司级协议/图 242 项及 Ruff；史馆采用相关
  222 项及 Ruff；只读存储/API 43 项、API 兼容 112 项及 Ruff；最终后端全量 771 项及 Ruff，
  前端 103 项，并通过 lint、typecheck 和 production build。仓库 harness 基线、自测、hook
  自测与 product-flow runner 自测均通过。
- 实际使用的 skill：`brainstorming`、`writing-plans`、`product-flow`、
  `codex-engineering-workflow`、`test-driven-development`、`frontend-design`、
  `record-decision`、`browser:control-in-app-browser`、`verification-before-completion`；全程
  Codex-only，未调用 Claude 能力。
- 验证命令与结果：后端 `pytest -q` → 771 passed，`ruff check .` → clean；前端
  `npm test` → 103 passed，lint/typecheck/build 均通过；harness 55 个基线、22 项自测、3 项
  hook 自测与 25 项 runner 自测通过。浏览器实测已填充 `/jinyiwei` 的总账、案卷、证据脊线、
  未解决/不可推断和回奏挂接均正常；独立审查确认桌面与 360px 无横向溢出，空态、错误态、
  零证据态和陈旧响应抑制另有自动化测试覆盖。截图能力超时，后续空态浏览器切换又被浏览器
  本地 URL 安全策略阻止，未绕过策略。
- 未通过项与原因：真实 Wikidata 公网冒烟在沙箱内及获批外部执行后均失败。当前环境把
  `www.wikidata.org` 解析为保留的基准测试网段 `198.18.0.206`，`PinnedHTTPSClient` 按设计以
  `UnsafeNetworkRequestError` 拒绝；未绕过公网地址校验，也未把 stub 结果冒充真实公网证据。
- 剩余风险：首版外部覆盖仅为 Wikidata/Wikimedia；同步调查会增加延迟；双 SQLite 采用关系
  是可对账的最终一致；本地 MVP 尚无鉴权、多用户隔离、后台任务或公开部署保证。

## Acceptance Review

- 验收结果：Blocked（实现完成；12 项中 11 项通过，真实公网冒烟受执行环境 DNS 改写阻塞）。
- 验收证据：后端 771 项、前端 103 项、Ruff/lint/typecheck/build、四组 harness 检查、独立
  前端复审和已填充案卷浏览器验收均通过；各模块明细见 `.superpowers/sdd/task-*-report.md`。
- 未通过项：需在能把 `www.wikidata.org` 解析到真实公网地址的环境，按 `backend/AGENTS.md`
  的无登录、无副作用命令补跑一次安全公网冒烟。通过后才可勾选最后一项并改为 `Accepted`。
