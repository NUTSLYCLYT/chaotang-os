# 未指定年份的财务报表请求静默返回空附件

## Summary

用户明确要求“读取系统内既有财务数据并生成可下载财务报表”，但没有写年份时，系统会把该请求判定为普通旨意。拟旨、下旨和回奏均可能显示成功，最终 `artifacts` 却为空，Study 页面因而没有可下载附件。

这是用户可见的假成功：请求中的核心交付物是财务报表附件，系统却以无附件的正常回奏结束。已确认的产品规则是：未写年份时采用上一完整年度；以当前日期 2026 年为例，应采用 2025 年。若 2025 年没有有效数据，必须在确认前返回 `NEEDS_INPUT`，不得继续回退到 2024 年或更早年份。

## Root Cause

根因是会计报表意图模型把“用户请求了报表”和“系统成功解析出报表期间”错误地合并为同一个布尔状态。

- `backend/app/accounting_reports/models.py` 的 `ReportIntent` 要求 `requested == (period is not None)`，因此无法表达“明确请求报表，但期间尚未解析”的合法中间状态。
- `backend/app/accounting_reports/intent.py` 在识别到报表交付语义、却没有找到年份时返回 `requested=False, period=None`，使请求在最早的意图层被降级为非报表请求。
- 后续拟旨路由约束、户部/会计司生成器、附件发布约束都以 `requested` 为门控。错误的 `False` 贯穿整条链路，导致既不强制路由到户部/会计司，也不生成附件，更不会把“缺少报表附件”视为失败。
- 前端 `StudyArtifactLinks` 对空数组返回空视图。这一行为对普通回奏是正确的，但放大了后端假成功：用户只看到回奏，没有任何解释说明为何缺少请求的附件。

现有测试主要覆盖显式年份（例如 2024–2025）的成功路径，并分别证明附件生命周期、BFF 严格解析、owner 隔离和下载鉴权；它们没有覆盖“明确请求报表但未写年份”的入口，因此形成假绿。

## Prevention

1. 将报表请求意图与期间解析状态拆开，至少表达 `NOT_REQUESTED`、`EXPLICIT_PERIOD`、`MISSING_PERIOD`、`INVALID_PERIOD` 四种状态；禁止把缺少期间静默转换成非报表请求。
2. 对 `MISSING_PERIOD` 应用唯一确定的期间政策：`reference_date.year - 1`。2026 年固定解析为 2025 年，不枚举或回退更早年份。
3. 在拟旨登记权威前，用既有严格 loader 验证该年度来源文件、schema 和规范化行是否可用。不可用时直接返回 `NEEDS_INPUT` 并撤销/不登记拟旨权威，不调用真实模型、不生成旨意、不进入下旨。
4. 数据有效时，把采用年份确定性写入确认前草稿的 `expert_example`、`decree_text` 和假设说明；随后仍用现有指纹和权威登记机制绑定该文本，防止确认后期间漂移。
5. 执行层增加 fail-closed 不变量：已识别为报表请求时，期间未解析或户部/会计司没有产生待发布附件都必须失败，不能返回 HTTP 200 加空 `artifacts`。
6. 保持 ADR 0028 的先归档后发布、owner 隔离、允许根目录和下载鉴权不变；修复只补足报表意图、期间政策和附件必需性。

## Detection

增加以下 RED 测试，并把无年份 synthetic 流程纳入每次完整验收：

- 意图测试：无年份财务报表请求必须为 `MISSING_PERIOD`，不能是 `NOT_REQUESTED`。
- 期间政策测试：固定日期 2026-08-05 时解析为 2025；2025 数据无效时返回 `NEEDS_INPUT`，且 loader 只被调用一次、不得探测 2024。
- 拟旨测试：成功草稿在确认前明确显示 2025；数据无效时不调用模型、不登记 authority。
- 执行测试：报表请求若未产生 pending artifact，必须失败且不得归档/发布；普通非报表回奏仍允许空附件。
- 跨层 synthetic 测试：使用无年份提示词，经拟旨、确认、户部/会计司、PENDING/PUBLISHED、史馆绑定、BFF、Study 下载链路，最终得到恰好一个 XLSX；owner 下载为 200、跨 owner 为 404。
- 最终同一实现版本必须连续通过 10 轮完整验收；任一轮失败，或代码、配置、验收流程发生实质变化，计数归零。

## Evidence

调查时的只读工作区证据：

```text
ABSOLUTE_WORKSPACE=D:\workspace\chaotang-os-harness-only
BRANCH=harness-only
HEAD=dd3833c5abf5a83e20799a4e590fdc7bccdfde87
git status: clean
```

稳定复现证据：

```text
输入：读取系统内既有财务数据并生成可下载财务报表
结果：ReportIntent(requested=False, period=None)

输入：读取系统内 2020-2025 年财务数据并生成可下载财务报表
结果：ReportIntent(requested=True, period=ReportPeriod(2020, 2025))
```

数据发现只读证据：受控财务数据根目录中存在 2020–2025 年的 12 个 `.xls/.xlsx` 文件；2026 年文件不存在，上一完整年度 2025 的文件存在。调查未读取真实私有密钥，也未调用 DeepSeek、真实或付费模型。

相关代码证据：

- `backend/app/accounting_reports/models.py`：`ReportIntent` 当前不允许“已请求、期间缺失”。
- `backend/app/accounting_reports/intent.py`：无年份时返回非请求状态。
- `backend/app/agents/chancellor_draft/graph.py`：只有 `requested=True` 才强制户部/会计司路由。
- `backend/app/accounting_reports/session.py`：只有 `requested=True` 才生成 workbook。
- `backend/app/api/decrees.py`：只有 `requested=True` 才要求精确会计路由；现状没有“报表请求必须有附件”的独立不变量。
- `frontend/src/features/study-visual/StudyArtifactLinks.tsx`：空附件数组不渲染下载链接。

既有显式年份路径的定向后端测试和前端测试在调查阶段通过，说明附件生成、发布、响应、展示与鉴权链路本身可用；故障入口集中在无年份意图/期间解析以及缺少附件必需性断言。
