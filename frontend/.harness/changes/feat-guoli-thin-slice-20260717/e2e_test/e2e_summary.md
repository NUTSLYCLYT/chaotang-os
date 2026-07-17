# E2E 摘要

结论：PASS（P8 专属与战役累计 smoke 均通过）

## 结果

- P8 专属：PASS。API 返回 `NO_DATA,value=null,sample_size=0,data_source=truth_ledger,window=ALL_RECORDED,includes_demo=false`；同轮 DOM 为 `NO_DATA`、空 `data-value`、`0 条判决`、`全部记录 · 尚无样本`、`truth_ledger`、`不含 DEMO`，没有伪百分比。
- 回滚：PASS。`NEXT_PUBLIC_GUOLI_THIN_SLICE=false` 后 snapshot 中无“御史封驳率”region。
- 截图：ignored artifact `frontend/dev/artifacts/p8-guoli-thin-slice/p8-guoli-api-ui-match.png`，SHA-256 `09fbe021c1ab978ec1d3b562a0aa8fedf3f6a551e48fb0dfb15c2c7028d2d44c`。
- 累计 smoke：PASS，`finance-intel-loop-ui.spec.ts` 2 passed。公开/密旨均命中 canonical endpoint 并停在 authorized human decision，明确未下旨、未执行、未归档；缺证据分支显示不可放行、无归档成功入口并跳转锦衣卫补证。
- trace（ignored）：公开/密旨 SHA-256 `f498e012a48ed79df82a547c2e5ccb5f972ad354cbaba1f7d748462bb9a9c8bc`；缺证据 SHA-256 `5cca8bbea0dc38b76835fa0be3588719613ffafc59696c546658264012f282a3`。
- 历史 404 与旧页面失败未删除，根 change `p8-cumulative-smoke-blocker.md` 记录根因、授权和解阻证据。
