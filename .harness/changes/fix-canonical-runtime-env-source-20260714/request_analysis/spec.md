# 规格说明：fix-canonical-runtime-env-source-20260714

## 背景

monorepo 已是唯一代码真源，但 Next 启动包装器、生产 release gate 和服务端 LLM registry 仍会自动向 `../jiqun_ai*`、`../fengQun/...` 与 `/home/ubuntu/fe/...` 搜索 `.env`。机器上只要残留旧仓，当前构建/运行就可能静默读取旧配置，破坏运行身份可证明性。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 三个运行消费者含自动 sibling/绝对路径发现 | 新契约测试首轮 3/3 failed | TDD RED | 是 |
| 已确认事实 | canonical 后端环境文件位于 monorepo `backend/.env` | 本机文件系统；AGENTS 三层架构 | 只核路径，不读取/输出秘密 | 否 |
| 推测 | 外部部署可能仍显式设置旧 `JIQUN_*_ENV_FILE` | 仓库无配置引用 | 因外部状态未知暂保兼容 | 否 |
| 未知问题 | 外部服务管理器实际是否使用旧 override 名称 | 仓库外状态 | S3 部署清单核对 | 否，不阻塞本闭环 |

## 数据流与调用链

`frontend package command / server LLM registry -> explicit CHAOTANG_BACKEND_ENV_FILE (优先) -> legacy explicit override (兼容) -> ../backend/.env (唯一自动来源) -> 只填充未设置的 LLM env keys`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 自动环境来源 | monorepo `backend/.env` | Next wrapper/release gate/LLM registry | 三文件契约测试 + real-mode build |
| 显式 override | `CHAOTANG_BACKEND_ENV_FILE` | operator/CI | 优先于兼容变量与 canonical 默认 |
| 兼容 override | `JIQUN_ENV_FILE` / `JIQUN_AI_ENV_FILE` | 未迁移的外部 operator | 只在显式设置时读取，不做路径猜测 |

## 范围

- 删除三个消费者中的旧 sibling repo/绝对路径自动发现。
- 增加 `CHAOTANG_BACKEND_ENV_FILE`。
- 自动默认只保留 `../backend/.env`。

## 非目标

- 不修改 `.env` 内容，不提交或输出秘密。
- 不删除旧显式 override 名称；待 S3 核对外部部署后另行迁移。
- 不处理 package appName、帮助文案、历史 handoff 或一次性研发脚本。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| canonical backend env 存在 | 加载未显式设置的 LLM keys | real-mode build/契约 |
| sibling 旧仓存在 | 不自动读取 | banned source contract |
| 显式 canonical override 存在 | 优先读取该文件 | candidate 顺序 review |
| process env 已有 key | 不覆盖 | 保留既有 parser 行为 |
| 不导入共享 env | `CHAOTANG_IMPORT_JIQUN_ENV=0` 保持跳过 | 既有行为不变 |

## 风险与回滚边界

只改三处候选列表与一条测试。回滚会重新引入旧仓静默配置漂移；没有数据库、进程或 secret 文件写入。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：继续 S1 runtime discovery 下一最小闭环
- 明确未批准：部署、服务接管、删除外部旧仓或 secrets

## 验收标准

- 契约先 3/3 RED，修复后 3/3 GREEN。
- 三个消费者不存在旧自动来源，均包含 canonical override/default。
- S1 联合回归、TypeScript、real-mode build、doctor、diff/security 通过。
- prod doctor 仍如实 STOP。

## 验证计划

- 新 runtime env source contract。
- S1 全部 Node 契约。
- `pnpm exec tsc --noEmit`、`NEXT_PUBLIC_API_MODE=real pnpm build`。
- 根/前端/后端 doctor、prod doctor、diff/security review。
