# E2E 计划

## 覆盖范围

本任务不新增 Playwright 用例。任务包指定 adapter nodetest 为前端行为证据，且真实 endpoint 每次触发非幂等 LLM 流程，需要有效登录身份和 provider 运行环境；在无发布环境凭证的本地 E2E 中伪造成功响应会违反本任务“不用 mock 证明真实能力”的边界。

## 替代证据

- TypeScript 验证组件与判别联合的渲染分支。
- adapter nodetest 验证成功、source label 与失败降级。
- backend pytest 验证真实 hard gate 和三源聚合语义。
- frontend harness doctor 验证没有引入 BFF。

## 发布后检查建议

在具备真实登录与 provider 的受控预览环境中，进入 `/liubu/libu_rites` 的承诺门，提交一段含可核验素材的文案，检查 network POST、硬灯、三源标签、缺失覆盖和 console 健康。
