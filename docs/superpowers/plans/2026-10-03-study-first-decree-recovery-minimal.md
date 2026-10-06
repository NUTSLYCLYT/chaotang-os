# 实施计划：/study 第一旨恢复动作最小修复

任务编号：`OC-STUDY-FIRST-DECREE-RECOVERY-MINIMAL-20261003`

## 实施顺序

1. 在 `studyTaskCockpit.ts` 增加真实的草案阻断阶段和恢复动作纯函数。
2. 在 `decreeJobPolling.ts` 分离无副作用的读取函数与主动清理函数。
3. 让 `StudyClient.tsx` 使用纯读取和统一恢复决策。
4. 让 `DevStudyWorkspace.tsx` 只显示一个恢复控件，不改变正式下旨按钮。
5. 先运行定点测试，再运行前端质量门禁。

## 证明命令

```text
cd frontend
node --test src/features/study-visual/studyTaskCockpit.test.ts src/features/study-visual/DevStudyWorkspace.test.ts src/app/study/decreeJobPolling.test.ts
npm run lint
npm run typecheck
npm run build
cd ..
node scripts/check_harness.mjs --self-test
node --test scripts/harness-doctor.test.mjs
node --test scripts/product-authority.test.mjs
node scripts/harness-doctor.mjs --check
git diff --check
```

## 停止条件

远端漂移、工作树污染、路径扩张、需要后端/BFF/ADR 变化、测试原因不明或 authority 不是 GO 时立即停止并报告。
