# R1：保留本机登录修复，合入 ext-dev

## Status

Blocked

等待 P0.3 历史对象和六部治理验收；R1 暂存候选不提交、不推送。

状态：旧 R1 批准记录已落地；两文件产品候选仅在工作区暂存并完成针对性测试，尚未提交或推送。依赖图要求先完成 P0.3；旧批准在治理基线变化后必须重发，不得沿用。

## Product Definition

把本机已经验证的登录输入上限、账户服务不可用反馈合入 Git 目标，让客户遇到故障时得到明确且不泄露内部信息的错误。保持现有账户、会话、租户和数据隔离。

不改数据库、不碰真实账号、不调用模型、不动权限系统、根门禁、ADR 0028 或 UI；不推送产品候选、不部署。此批不声称完成客户全流程。

## Affected Modules

- 模块：后端认证 API、登录回归测试
- 允许路径：backend/app/api/auth.py、backend/tests/test_auth_api.py

基线 `dd96e571944a5128ac8eb79c3c1e611294faa1ba`，tree `3eb25ccb4c81b21bc0c92b976833730d7803990f`。

只允许修改：

1. `backend/app/api/auth.py`：复用本机已有 Field 上限、注册最短口令约束和 AuthenticationStorageError 的固定 503 映射。
2. `backend/tests/test_auth_api.py`：保留现有租户/会话测试；复用本机上限与边界测试；补齐注册、登录、读身份、退出四类存储错误的精确响应测试；验证过大输入不会进入存储。

已经复核 `app/auth/storage.py`、`errors.py`、`models.py` 和 `tests/test_auth_storage.py` 两侧相同，不需要扩大范围。若实施发现额外依赖、已有超长账号兼容需求或新的行为变化，停止扩大范围并更新任务。

## Acceptance Criteria

- [ ] 正常注册/登录/读身份/退出保持原响应和状态。
- [ ] 用户名、邮箱或登录标识超过 254 字符，口令超过 1024 字符时，返回 422；恰好上限仍可使用。注册少于 6 字符口令仍被拒绝。
- [ ] 不能通过输入 owner/tenant/membership/role 字段获得权限。
- [ ] 存储异常在四类认证操作上返回固定 `AUTH_STORAGE_UNAVAILABLE`、503 和固定公开消息，不含路径、内部异常或凭据。
- [ ] 已退出、过期、无效或成员资格失效的会话仍拒绝访问。
- [ ] 原有账户存储/口令/会话测试与前端认证 BFF 契约通过；新增失败用例先在旧实现显示 RED，再对最终候选得到 GREEN。
- [ ] 候选需经过既有精确路径验证。全项目历史对象、指纹及发布环境问题继续单列，不因本批测试通过而宣布全系统可发布。

## Technical Plan

工程路线：跨来源整合采用项目 `codex-engineering-workflow` 的 Superpowers 等价步骤；本批缩小为局部行为合并，保持先诊断、最小变更、回归、自审和新鲜证据。不启动 Claude runner。

本轮已对未修改的两套实现执行诊断：六个目标场景在 Gitee 失败、本机通过；详见 `canonical-auth-acceptance.json`、`local-auth-acceptance.json`。这证明了来源差异，不能代替未来合并后候选测试。

验证器使用 Linux 工具路径；当前 Windows 的 20 项 M0 测试为 7 通过、12 失败、1 跳过，原因是宿主没有 `/usr/bin/git`、`/usr/bin/python3`。已在 CodexAgentLab WSL 的临时目录使用 Node v24.21.0 官方 Linux 构建（SHA-256 已校验）、Git 2.43.0，并将 G 盘只读挂载，重跑后 **19 通过、0 失败、1 跳过**；跳过项是安装态 broker acceptance，本机尚未安装该 broker。DuiXDistro 的 Git 2.25.1 太旧，不用于最终验收。详见 `R1-verifier-environment-20260925.json`。后端锁定的 Python 3.12 测试依赖仍未在 Linux 验证环境配置。批准记录必须先独立落地到远端，现有 `--authorize --task CT-R1-AUTH-INTEGRATION-20260925` 真正返回 GO 才开始产品修改；不改旧指纹来绕过失败。

## Delivery Constraints

拟建独立批准记录仅包含 `.harness/approvals/CT-R1-AUTH-INTEGRATION-20260925.json` 和 `docs/product/tasks/2026-09-25-r1-auth-integration.md`。批准该记录的提交/推送不等于批准未来产品候选推送或部署。

旁边 proposed-approval 文件使用仓库 schema 要求的状态常量，但位于仓库外，并且没有 Owner 确认和批准提交；它不是已生效授权。摘要通过仓库现有解析器生成，参见 review 文件。

## 回退

本批不迁移数据。未提交时只撤回本批两文件差异，先核对期间无人插入其他改动；已提交后使用受审查的反向提交，禁止 reset/force push。保留错误修复的原本机源码与已校验增量包。

## Implementation Report

- 在 CodexAgentLab WSL 临时环境，按 `backend/requirements-runtime.lock` 的 64 个依赖和 SHA-256 哈希安装后，针对当前 Gitee `ext-dev` 运行 `tests/test_auth_api.py`、`tests/test_auth_storage.py`、`tests/test_auth_passwords.py`：**25 通过、0 失败**。运行区间：2026-09-25 15:32:49–15:32:53 UTC。
- 对当前 `ext-dev` 运行 6 个目标验收探针：**0 通过、6 失败**。4 类账户存储错误仍返回 500（预期固定脱敏 503）；2 类超长输入分别返回 201/200，且都调用了存储（预期入库前拒绝）。这与本机待合入修复的 6/6 诊断结果构成明确差异。
- 证据：`R1-canonical-baseline-20260925.json` 与 `R1-verifier-environment-20260925.json`。仓库在验证期间只读挂载；产品文件未修改；真实模型、数据库和原生窗口均未使用。
- 这次复核没有解除 Owner/M0 门禁，R1 仍等待对摘要及批准记录 Git 动作作出精确确认；不得据 25/25 基础测试宣称登录修复已完成。

## Acceptance Review

当前仅确认隔离 LF 副本中，拟议 P0.3 治理补丁与已暂存 R1 差异叠加后的六部就绪和认证针对性测试 43/43、项目自测 175 项、Ruff 检查通过。正式仓库尚未应用治理补丁；项目总检查仍被缺失的历史 Git 对象阻断。R1 必须在治理完成后的新基线上重新取得精确批准，再独立验证候选提交、推送和客户流程；本记录不表示验收通过。

## 2026-09-26 治理提交后的 R1 基线续接（待具体批准）

治理补丁已独立提交为 `36c67bafe1d632a7ebeb146ba9e9fd01a63bd70e`，tree 为 `aba24469cb89c24a6612ff5d7a3e367d7fb106ee`。上方旧基线和旧批准是历史记录，不能作为本轮继续施工的授权。此次重新冻结同一个 R1 两文件范围，不扩大行为、数据迁移、权限或 UI；已存在的两文件修复须保持不变。

先核实此治理提交已在 origin/ext-dev，再把本次批准清单与本任务说明独立提交。得到 Owner 对新摘要的确认并由现有 M0 对精确任务返回 GO 后，才能把保留的两文件修复形成其直接子候选；后续候选确认和 Git 动作继续按原门禁处理。批准记录提交/推送不等于产品发布。

当前已保存的同源码验证包括完整后端 5,221 通过、4 跳过、真实 HTTP 认证18项通过、史馆隔离26项通过。它们是准备依据，不能代替新候选对应的 M0 验证矩阵或原 UI 用户验收。没有真实模型调用、原生窗口操作或部署。