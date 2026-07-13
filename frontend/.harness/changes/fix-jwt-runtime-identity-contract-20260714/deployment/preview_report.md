# 预览 / 部署报告

结论：VERIFIED_FAIL_CLOSED / NOT_READY

## URL

- Frontend: `http://127.0.0.1:3050/chaotang`
- Backend identity: `http://127.0.0.1:8081/api/health`

## 检查

- `pnpm prod:doctor -- --json` 已运行：JWT 子门因 runtime metadata/expected id 缺失 STOP，且 `shouldProbe=false`；foreign 3050 与 builds 缺失继续 STOP。

## 剩余风险

- live 8081 尚未通过受控流程配置 key id 和外部 probe token；不能声称 runtime MATCH。
