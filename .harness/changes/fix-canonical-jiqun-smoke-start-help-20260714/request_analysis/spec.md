# 规格说明：fix-canonical-jiqun-smoke-start-help-20260714

## 背景

`jiqun-contract-smoke` 在后端不可达时仍提示操作者进入旧绝对仓库并直接运行 `uvicorn`。这既指向错误代码真源，也绕过 canonical `backend/scripts/serve-dev.sh` 的 env、鉴权姿态、代理清理和解释器选择。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | DOWN help 包含旧绝对仓库和 direct uvicorn | `frontend/scripts/jiqun-contract-smoke.mjs`；初始 test exit 1 | Frontend | 是 |
| 已确认事实 | canonical dev launcher 已存在 | `backend/scripts/serve-dev.sh` | Backend owner | 否 |
| 推测 | 操作者会复制 smoke 输出 | 这是该输出的明确用途，但无调用遥测 | Frontend | 否 |
| 未知问题 | 该旧帮助过去 14 天调用量 | capability inventory 的 telemetry 保持 `null` | Frontend owner | 是；只阻止删除 |

## 数据流与调用链

`smoke probe -> backend DOWN -> warning -> canonical relative path -> backend/scripts/serve-dev.sh -> env/auth/proxy/interpreter -> python -m web.main :8081`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| DOWN result | `runJiqunContractSmoke` | CLI / release gate | 返回 skipped=N、failed=0、exit 0，不改变现有语义 |
| startup help | frontend smoke | operator | `cd ../backend && bash scripts/serve-dev.sh`；测试禁止旧 path/direct uvicorn |
| inventory item | root capability inventory | harness doctor/清算 | `MIGRATED_OBSERVE`，调用量仍 `null` |

## 范围

- 只修改 DOWN 分支帮助和同文件产品注释。
- 更新该 inventory 项及 S1 蓝图。

## 非目标

- 不修改 smoke HTTP/schema 行为、超时、认证或 SKIP 策略。
- 不启动/停止真实服务，不修改 backend launcher。
- 不处理最后一个 `wf_pack` 旧路径。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| backend DOWN | 打印 canonical launcher，保持 exit 0/SKIP | 聚焦 test + port 9 实际 CLI |
| backend UP | 契约逻辑不变 | 源码 diff + 43 主链回归 |
| 从非 frontend cwd 复制相对命令 | 提示明确“从 frontend/” | 实际 CLI 输出 |
| 无调用遥测 | 不进入删除候选 | inventory contract test |
| 生产身份不可信 | 继续 STOP | prod doctor |

## 风险与回滚边界

风险是相对路径依赖当前目录；输出已明确“从 frontend/”，且 `pnpm smoke:jiqun` 的 canonical cwd 就是 frontend。回滚仅恢复本提交；无数据库或生产进程变更。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：下一最小闭环，继续每入口 RED→GREEN 和 verification-loop。
- 明确未批准：同时修改 `wf_pack`、部署或删除旧入口。

## 验收标准

- 一条新测试必须先失败再通过。
- DOWN 实际输出不得含旧仓库/direct uvicorn，且必须指向 canonical launcher。
- 正式业务主链、harness 和生产 STOP 不退化。

## 验证计划

聚焦 node test、真实 DOWN CLI、inventory contract、TypeScript/build、43 pytest、doctor、prod doctor、diff/security。
