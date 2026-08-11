# 显式 2025 财务分析请求再次落入模型 502

## Summary

用户在上书房输入“我想用本地数据分析出2025年的财务数据分析一下”，拟旨请求完成后，正式下旨约 19.8 秒返回 HTTP 502，页面显示丞相模型调用失败。浏览器既有 Resource Timing 证明失败边界是 `POST /api/decrees/chancellor`；没有为取证重复发起真实模型请求。

本次不是已知 Key 或 provider 配置结论。当前 3000/8000 服务仍由主工作区的旧进程承载，没有加载已验收的财务期间政策，也没有加载 502 脱敏可观测性修复。进一步对冻结财务候选版本和本地数据做只读验证后，确认即使机械集成或重启，也仍有意图识别与真实 loader 两个独立缺口。

## Root Cause

故障由三个相互独立的门禁叠加：

1. 运行态漂移：3000 的 Next dev 进程启动于 2026-08-04 17:23，8000 的无热重载 Uvicorn 进程启动于 2026-08-05 00:42；两者都从 `D:\workspace\chaotang-os-harness-only` 启动。财务 10/10 候选仍位于独立 f38e worktree，502 typed metadata/单次瞬态重试仍位于另一独立 worktree。
2. 意图契约缺口：当前主工作区把精确旨意判为 `requested=False`；f38e 冻结候选把它判为 `NOT_REQUESTED`。其现有测试还明确断言“请分析2025年财务数据”为非报表请求。由于没有“报表/报告/Excel/生成表格”等交付物词，显式 2025 没有进入 `EXPLICIT_PERIOD`，拟旨阶段不会执行 period policy，而是调用模型。
3. 本地数据加载缺口：批准目录存在 2020--2025 共 12 个 `.xlsx/.xls` 文件，2025 的余额表与财务报表文件均存在；但 f38e 严格 loader 对该真实目录返回 `source_schema_invalid`。失败首先由历史文件名 `陕西铭硕202212财务报表.xls` 触发：loader 在筛选请求年度前校验目录内所有文件名，连续年月命名不满足其单独四位年份规则。余额表文件本身也是 10 列且不符合 loader 预期的首行 9 列合成 schema，尚未达到可用验收。

因此本次可观测到的近端断点是 FastAPI 执行图抛出 `ChancellorGraphInvocationError` 后映射为后端 `model_unavailable`、BFF `model` 和 HTTP 502；旧 handler 丢弃阶段、provider HTTP 状态与安全 request ID，历史 provider 异常类别无法重建。不得据此猜测 Key、余额、限流或模型名。

## Prevention

- 启动服务前固定并打印绝对 worktree、HEAD、受影响文件 aggregate、进程 PID/启动时间；运行验收必须核对监听进程实际承载该指纹，不能用离线 10/10 代替运行态证明。
- 在拟旨模型之前，把“使用本地财务数据进行某年度分析”定义为独立、明确的受控交付意图，保留 `EXPLICIT_PERIOD(2025)`；是否必须交付 Excel 由产品契约单独决定，不能靠偶然关键词静默降级。
- 显式期间和默认期间都必须在 authority 登记、模型调用和副作用之前执行同一真实数据可用性预检。来源缺失、文件名不支持或 schema 不支持时确定性返回 HTTP 200 `NEEDS_INPUT`，不得伪装成 provider 502。
- loader 应先按允许文件类型与请求年度建立显式 source manifest，再验证所选文件；支持真实余额表/财务报表格式必须有脱敏元数据夹具与适配测试。不能通过放宽路径、忽略未知文件或读取目录外数据绕过 fail-closed 边界。
- 串行集成顺序：先修复并验收真实 loader/意图/period preflight，再集成冻结财务链路，再叠加 502 typed metadata 与一次瞬态重试，最后启动独立端口服务做 fake/synthetic 全矩阵；只有全部通过后才允许一次精确旨意的真实浏览器 smoke。

## Detection

必须新增以下最小失败测试，主管批准方案后按 TDD 实施：

- 精确旨意必须识别为 `EXPLICIT_PERIOD` 且期间为 2025；拟旨模型调用计数为 0，直到真实 source preflight 通过。
- 显式 2025 文件不存在、文件名不支持、schema 不支持或规范化后无有效行时，拟旨返回 HTTP 200 `NEEDS_INPUT`，`draft/decree_text` 为空，不登记 authority，不创建路由快照或执行副作用。
- 真实目录只读 loader 验收只输出文件名、格式、行数、年度覆盖和稳定错误码；禁止把科目、金额、主体或原始行写入日志、测试快照或模型上下文。
- BFF 保持后端 `model_unavailable` 到页面 `model`/HTTP 502 的既有外部契约；内部日志仅记录 allow-listed 阶段、异常类别、provider HTTP 状态、重试次数和 request ID。
- 运行态 smoke 必须断言 PID/启动时间/指纹与候选一致，并检查页面、Network、console、史馆、附件和 owner 隔离；旧进程或指纹不一致直接 fail-closed。

## Evidence

- 浏览器既有 Resource Timing：draft BFF 请求约 12.8 秒；decree BFF 请求约 19.8 秒，`responseStatus=502`，`transferSize=399`。未重发真实模型请求。
- 进程证据：3000=`next dev` PID 37184，启动于 2026-08-04 17:23:12；8000=`uvicorn app:app` PID 49356，启动于 2026-08-05 00:42:32，Python/venv 路径位于主工作区；健康检查为 backend `0.1.0`。
- 主工作区 HEAD 为 `dd3833c5abf5a83e20799a4e590fdc7bccdfde87`；主工作区缺少 `backend/app/accounting_reports/period_policy.py`。财务候选 aggregate 为 `f6775e95f86831047a6582a27adb8f8a3e9d9a6bde4ce4c6fba5bc736fdf46f3`，其验收明确使用 synthetic 数据且未调用 DeepSeek。
- 精确旨意只读分类：主工作区 `requested=False`；f38e `NOT_REQUESTED`、period policy `NOT_REQUESTED`。
- 数据脱敏元数据：批准目录包含 12 个年度文件，年度覆盖 2020--2025；2025 余额表为 397 行/10 列，2025 财务报表为 3 个工作表、合计 105 行。loader 结果为 `source_schema_invalid`；未输出任何财务明细、金额、账户或密钥。
- 旧 BFF 的稳定页面错误分类是 `model`；FastAPI 稳定分类是 `model_unavailable`。旧响应和旧日志没有可恢复的 request ID/provider HTTP 状态，502 worktree 的改动尚未进入当前服务。
