# 变更规格

## 问题

两个非 UI evaluator 位于 `frontend/harness/`，但验证对象分别是研究技能证据链
和后端投资蜂群输出安全，造成归属事实源与目录位置不一致。它们还把带时间戳的
`latest.*` 写入跟踪目录，正常验证会制造脏工作树。

## 验收

- 两个 evaluator 只存在于 `backend/harness/`。
- 后端 manifest 与根级 project manifest 都登记其主 harness 身份。
- evaluator 不依赖调用者当前工作目录。
- 正常运行生成的报告不进入版本控制，参考基线仍可审阅。
- 前后端及根级 doctor 均可通过。
