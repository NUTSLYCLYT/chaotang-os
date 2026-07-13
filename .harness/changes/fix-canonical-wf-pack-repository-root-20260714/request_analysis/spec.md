# 规格说明：fix-canonical-wf-pack-repository-root-20260714

## 背景

`backend/scripts/wf_pack_rd_cost_split.js` 将旧 sibling checkout 写死为 `REPO`，随后把该值插入数据产物、知识库、配置、validator、Agent 提示、重启和 review 的全部路径。即使当前 monorepo 正确，工作流仍会指挥 Agent 修改旧仓库。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `REPO` 是旧绝对路径，且被所有阶段复用 | `backend/scripts/wf_pack_rd_cost_split.js:17` 及模板引用 | Backend owner | 是 |
| 已确认事实 | workflow 文件位于 canonical `backend/scripts/` | 文件系统与 root manifest | Project owner | 否 |
| 推测 | 该文件由支持 `export meta`/`phase`/`agent` DSL 的外部工作流 runner 执行 | 仓库内未发现 runner 实现 | 外部 workflow owner | 否 |
| 未知问题 | 实际 runner 的调用量、工作目录和 E2E 执行能力 | 无 runtime telemetry sink/runner 文档 | Backend owner | 是；阻止删除与 E2E 声明 |

## 数据流与调用链

`workflow file URL -> canonical backend root -> PRODUCT_DIR/PRICE_SRC/PHYS_LIB/JUDGE -> Baseline/Falsify/Implement/Static/Restart/Validate/Review/Synthesize`。REPO 只改变路径根，不改变各阶段逻辑、Agent schema、重启策略或业务闸门。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| repository root | `wf_pack_rd_cost_split.js` 文件位置 | 所有 workflow phases | `fileURLToPath(new URL('..', import.meta.url))`；pytest 禁止旧路径 |
| capability inventory | root manifest inventory | 入口治理/删除门 | `MIGRATED_OBSERVE`、replacement VERIFIED、telemetry null |
| pack cost verdict | `src/pack_rd_cost_validator.py` / flow engine | workflow validation | 既有专项 pytest；本轮不修改契约 |

## 范围

- 将一个硬编码 REPO 改为按脚本自身位置解析 canonical backend。
- 更新 inventory 和 S1 蓝图状态。

## 非目标

- 不运行高成本 Agent workflow，不调用 provider，不重启 8081。
- 不修改 pack_rd prompt/flow/validator/数据。
- 不删除旧仓库或 inventory 项，不修 JWT 401。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 从任意 cwd 加载 workflow | REPO 仍指向该文件所属 backend | source contract；文件 URL 语义 |
| 旧绝对路径出现 | test RED/FAIL | focused pytest |
| 路径末尾分隔符 | 去除一个 `/` 或 `\\`，避免双分隔符 | source review |
| runner 不支持该 ESM 语义 | 未验证，禁止宣称 workflow E2E | 未知问题/后续 runner owner |
| 无调用遥测 | 保持 `null`，不得 DELETE_CANDIDATE | inventory contract |

## 风险与回滚边界

风险是仓库内没有可复现的该 DSL runner，因此只能验证路径契约和其依赖的确定性 pack gates，不能宣称完整工作流执行。回滚只恢复此单提交；不触碰 provider、运行进程或数据。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：下一步收编最后一个已登记旧入口，继续 RED→GREEN 与 verification-loop。
- 明确未批准：运行高成本蜂群、重启生产/开发服务、扩展修复 JWT。

## 验收标准

- focused pytest 必须先失败再通过。
- 活 workflow 不含旧路径且默认根由文件位置决定。
- pack gate、正式业务主链、harness 无回归；生产仍 STOP。

## 验证计划

focused pytest、pack validator/flow tests、43 条主链、backend/root doctor、frontend real build/type、prod doctor、diff/security。工作流 E2E 明确列为未验证。
