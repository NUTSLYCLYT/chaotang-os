# CapabilityRegistry V1 Ruff Contract Corrective Lineage Successor Plan

任务：`CAPABILITY-REGISTRY-V1-RUFF-CONTRACT-CORRECTIVE-LINEAGE-SUCCESSOR-20260908`

## Decision

采用 forward-only exact4 lineage successor 修复当前 `c51e87454a5daf2d7febb82c715df1264cf593ce`
主线的唯一确定性静态门禁。旧 `91a74574…` 草案仅为 byte donor；禁止 re-anchor、修改旧提交、
扩大到前端、重放历史 donor，或把格式纠偏解释成新的 CapabilityRegistry 产品能力。

`91a74574…` 到 `c51e8745…` 为六个 first-parent 提交、23 条 changed paths；exact4 四路径零重叠，
四个 blob identity 分别保持 `dd147c50…`、`045d3651…`、`760066d1…`、`0943f666…`。
已获 GO 但尚未提交的 Mingshuo exact8 只保留 byte evidence；本 prerequisite 完成后必须基于
届时最新 ext-dev 重新签发，不消费或继承旧 one-child authority。

## Frozen Scope

- `backend/app/capabilities/contracts.py`
- `backend/app/capabilities/projection.py`
- `backend/tests/test_capabilities_api.py`
- `backend/tests/test_capability_registry_projection.py`

结构必须为 `0 ADD + 4 MODIFY + 0 DELETE`，模式均为 `100644`。

## RED Evidence

clean 基线 `c51e8745…` 已证明 full Ruff 精确失败 13 项：1 项 `I001` 和 12 项 `E501`；
同一基线上的 Mingshuo exact8 focused 测试为 `4 passed`，其候选字节未触及 exact4。
四文件最后一次共同产品引入提交为 `67f01c002…`，之后到当前基线的差异对 exact4 为空。

## Implementation

- `contracts.py`：只删除 Ruff 确认的一个多余空行，保持 import 内容及顺序。
- `projection.py`：只把五个超长表达式改为等价括号化多行。
- `test_capabilities_api.py`：只把 helper、route lookup 和断言改为等价多行。
- `test_capability_registry_projection.py`：只把两个断言改为等价多行。
- manifest 必须先强制 `HEAD^..HEAD` 精确为四项 `M/100644`。
- 使用 `ast.dump(..., include_attributes=False)` 直接比较修改前后完整模块。机械取得的 Ruff
  `I001` 建议只删除 `contracts.py` 的一个多余空行，不需要允许任何 import 节点或顺序变化；
  import、调用、条件、常量或测试断言任一 AST 差异立即 STOP。

## Verification

以 proposed approval manifest 的 verification 数组为唯一产品候选矩阵；其中
`a0-candidate-contract` 是矩阵首项，在产品测试前校验模式、状态、完整 AST 和注释一致性。
它以隔离 Python 解释器读取 Git blob，不导入产品代码；不允许添加 noqa、type-ignore 或修改注释。backend-full
允许既有测试使用本机 loopback、临时目录和子进程，但不授权公网、凭据或外部业务副作用。RC 接纳后另在最新
`origin/ext-dev` 复跑前端 typecheck、lint、`TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm test`、production
build 与真实浏览器黄金链；这些 RC 验收不扩大 exact4 产品路径。

## Independent Review

- Governance：范围、lineage、单亲、无门禁放宽、无第二事实源。
- Python：AST 等价、格式修改最小、测试未弱化。
- Security：无 API/权限/凭据/外部调用/租户边界变化。

任一 P0–P2、第五条产品路径、验证失败、远端漂移或 machine STOP 均停止。

## Rollback

candidate 落地主线前不需要回滚；若未来被 Owner 接纳并普通快进后出现问题，只能另立 forward-only
corrective successor，不重写历史、不 force-push。生产部署不在本任务范围。
