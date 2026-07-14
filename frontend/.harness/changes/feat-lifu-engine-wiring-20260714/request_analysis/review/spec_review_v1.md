# 需求审查 v1

结论：APPROVED

## Findings

- 后端契约清晰：请求字段、认证依赖、非信封响应和三源字段均有实现与测试证据。
- `backendFetch` 是客户端正确入口：它保留 canonical backend path、浏览器 Bearer/cookie 和 401 refresh；裸 `fetch(backendApiUrl(...))` 会丢失这条认证约定。
- 范围保持纵切最小化：只接承诺门，不把其它纯客户端礼部模块提升为真实引擎。
- hard gate 的产品语义明确锁定为 `lipu_vet`；LLM 软意见与舆情意见只展示，不参与灯色。
- dadian 冻结路径、其它部门、BFF 和后端业务逻辑均不在改动面。

## Questions

- 无。任务包已明确选择 option B，且 endpoint/auth 合约均可用。
