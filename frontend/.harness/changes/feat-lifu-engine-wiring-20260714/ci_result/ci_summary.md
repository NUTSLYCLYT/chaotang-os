# CI 验证摘要

结论：PASSED

## 指定命令

```bash
cd frontend && npx --yes tsc --noEmit
cd frontend && npx --yes tsx --test src/features/lifu/api/lifu-compliance.nodetest.ts
cd frontend && node scripts/harness-doctor.mjs
cd backend && python3 -m pytest -q tests/test_lipu_vet.py tests/test_lipu_compliance_report.py
```

## 证明范围

- TypeScript：adapter 类型、UI 判别分支和现有前端工程可编译。
- Node test：成功解析、source label 原样透传、网络/HTTP 失败诚实 FALLBACK。
- Frontend doctor：11 阶段记录完整、无 DELIVERED 占位符、无 BFF/route handler。
- Backend pytest：`lipu_vet` 确定性素材回链和 compliance-report 硬灯所有权保持绿色。

## 实际结果

- `pnpm install --frozen-lockfile`：退出码 0，lockfile 无变化，安装 144 个既有依赖。
- `npx --yes tsc --noEmit`：退出码 0，无输出。
- adapter nodetest：`pass 1 / fail 0`（文件内覆盖 3 个行为用例）。受限容器禁止 `tsx` CLI 的 Unix socket，验收时仅在 `/tmp` 用 `node --import tsx` 等价包装器替代 CLI 信号转发，项目文件和依赖均已恢复。
- `node scripts/harness-doctor.mjs`：`harness-doctor: 0 errors, 0 warning(s)`。
- backend pytest：`13 passed in 3.06s`。

## 变更审计

- 只触及礼部 adapter/UI/roster、对应测试、产品第 7.1 节与本 change 目录。
- 没有 backend 逻辑、dadian、其它部门、package/lockfile、`scripts/lib/**` 或 BFF 文件变更。
