# CI 验证摘要

结论：PASSED

## 指定命令

```bash
cd frontend && npx --yes tsc --noEmit
cd frontend && node --import tsx --input-type=module --eval "await Promise.all([import('./src/features/lifu/api/lifu-compliance.nodetest.ts'), import('./src/features/lifu/lib/lifu-roster.nodetest.ts'), import('./src/app/(dashboard)/liubu/page.nodetest.tsx')])"
node scripts/harness-doctor.mjs
cd backend && python3 -m pytest -q tests/test_lipu_vet.py tests/test_lipu_compliance_report.py
```

## 证明范围

- TypeScript：adapter 枚举类型、逐字段无断言构造、timeout 参数、UI 和 hub 页面可编译。
- Node test：页面真实 anchor、roster、成功标签字段、非法标签、网络/HTTP 失败与永不返回超时均受回归保护。
- Root doctor：根/前端/后端 harness 委托与 11 阶段记录通过，无 BFF/route handler。
- Backend pytest：`lipu_vet` 确定性素材回链和 compliance-report 硬灯所有权保持绿色。

## 实际结果

- `npx --yes tsc --noEmit`：退出码 0，无输出。
- 完整礼部 nodetest：退出码 0，`tests 7 / pass 7 / fail 0`（adapter 5、roster 1、六部 hub 页面挂载 1）。
- `node scripts/harness-doctor.mjs`：退出码 0，`project-harness-doctor: 0 errors, 0 warning(s)`。
- backend pytest：`13 passed in 3.06s`。

## 变更审计

- 只触及六部 hub 导航、礼部 adapter/UI、对应测试、产品第 7.1 节与本 change 目录；roster 本轮仅执行既有测试，未改实现。
- 没有 backend 逻辑、dadian、其它部门、package/lockfile、`scripts/lib/**` 或 BFF 文件变更。
