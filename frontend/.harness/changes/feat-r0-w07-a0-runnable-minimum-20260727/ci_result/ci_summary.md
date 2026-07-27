# CI 验证摘要

结论：`SCOPED TEST PASS / FRESH TWO-PASS REVIEW PENDING`

## 命令

- focused Node tests、`pnpm exec tsc --noEmit`。
- `NEXT_PUBLIC_API_MODE=real pnpm build`。
- API contract stability test/generator。
- W07 Playwright config。

## 结果

- latest focused Node 35 passed；TypeScript exit 0；Next real-mode build exit 0。
- OpenAPI fixed baseline `ed822255...`：362 routes / 0 breaking / 9 additions；
  连跑两次报告与 route snapshot hash 不变。
- sixth remediation exact-state Playwright 1 passed，覆盖 delayed initial read、
  READY reload、audit-only exact archive、tampered `archiveId` 与 seeded PARTIAL
  reload。
- canonical `pnpm test:node` 为 1099 passed / 1 个既有非本 diff residual
  failed；另有 1 个不在 canonical glob 的既有 TSX residual，详见 root CI
  summary。
- review envelope `492703ce...` 的 `HIGH 3 / MEDIUM 5` 已在
  implementation `61805256...` 按批准 scope 修复；exact candidate fresh
  two-pass 尚未完成，当前不得整合。
