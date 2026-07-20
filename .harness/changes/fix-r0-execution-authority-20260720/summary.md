# 变更摘要：fix-r0-execution-authority-20260720

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录 G0 治理护栏与证据；产品实施仍须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-execution-authority-20260720 |
| 类型 | fix |
| 状态 | IMPLEMENTED_UNVERIFIED |
| Owner | Codex / Project Owner |
| 创建日期 | 20260720 |

## 范围

- 主线：从 `origin/feature-chaotang-ext@4ed5a0379e87c6ea65ed9a3ad89dca962aa785fe` 新建 `task/r0-execution-authority-20260720`。
- 文件：根级 authority schema、manifest、resolver/CLI、Node 测试、doctor 接线、消费者政策与本 change 证据。
- 验证：authority RED→GREEN、`--authorize` 退出码 2/`STOP`、根/前端/后端 doctor、diff 检查、Claude Code 三路只读审查。
- 不包含：M0–M10 amendment、合同 runtime、前端页面、后端业务逻辑、远端默认分支或生产部署。
