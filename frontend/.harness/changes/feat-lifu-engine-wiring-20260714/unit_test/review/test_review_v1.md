# 测试审查 v1

结论：PASSED

## Findings

- adapter 测试断言对外行为（path/body/outcome/source labels），没有绑定内部解析函数或调用顺序。
- 成功 fixture 同时包含确定性硬闸、LLM_ONLY 与 ENGINE_BACKED 三源，能发现 source label 被洗成 LIVE 的回归。
- 两类失败覆盖 transport 异常与 HTTP 401；失败 outcome 的类型和断言都不包含 report/light，能发现错误态伪装真实结果的回归。
- transport 以参数注入，不修改全局 fetch、localStorage 或认证状态，测试之间无共享副作用。
- 真实后端测试单独验证软意见不能覆盖硬灯，职责与前端 adapter test 清楚分层。

## TDD 证据

- 先创建 nodetest，再创建 adapter 实现；初始执行因模块不存在进入 RED。
- 实现最小 adapter 后使用 Node 的 tsx loader 完成 GREEN；最终验收再按任务包指定命令运行。
