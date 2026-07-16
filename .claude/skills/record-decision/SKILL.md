---
name: record-decision
description: 在 docs/decisions/ 下新建一条架构决策记录(ADR)。当仓库结构、技术选型、依赖方向或前后端契约发生实质变化时使用;触发词:ADR、架构决策、决策记录、adopt、record decision。
---

# 记录架构决策(ADR)

## 何时用

`ARCHITECTURE.md`、`AGENTS.md` 或跨前后端契约发生实质变化时,必须在这里留一条
记录,不能只改文档不留决策依据(参见 `docs/decisions/0001-*.md` 的先例)。

## 步骤

1. 在 `docs/decisions/` 里找到当前最大编号,新文件用
   `000<N+1>-<kebab-case-短名>.md`。
2. 必须包含以下五个二级标题,一个都不能少(`scripts/check_harness.mjs` 会
   逐个核对,标题必须是 `## ` 开头,降级成 `###` 不算):
   - `## Status`(如 `Accepted — <日期>`)
   - `## Context`(为什么需要这个决策,之前是什么状态)
   - `## Decision`(具体决定了什么)
   - `## Consequences`(带来的好处和代价,包括对其他文档/规则的影响)
   - `## Verification`(实际可运行的验证命令,不能只写"应该没问题")
3. 如果决策影响了 `AGENTS.md`/`ARCHITECTURE.md` 的内容,同步更新它们,不要让
   ADR 和实际文档说法不一致。
4. 如果新增了必须长期存在的文件,同时把它加进
   `scripts/check_harness.mjs` 的 `REQUIRED_FILES`;所有 ADR 的章节由检查器动态
   遍历,不要只写文档不接检查。
5. 写完后运行 `node scripts/check_harness.mjs`,确认新文件通过章节完整性
   检查。
