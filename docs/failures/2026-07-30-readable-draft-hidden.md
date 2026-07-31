# 拟旨草案被隐藏

## Summary

移除拟旨卷轴中的原始 JSON 后，页面没有把同一份结构化草案转换成用户可读的完整内容；同时旧回奏分支优先于新拟旨状态，导致用户点击【拟旨】后可能看到页面没有变化。

## Root Cause

展示层把“隐藏技术序列化格式”错误地实现为“删除完整草案展示”，而测试只约束 JSON 不出现和【下旨】按钮仍存在，没有逐项验证草案契约中的目标、范围、部门、流程、交付物、完成标准和权限边界是否对用户可见。页面状态分支也把旧回奏放在拟旨结果之前，使内部已经得到的新草案仍可能被旧内容遮挡。

## Prevention

结构化业务对象不得直接以 JSON 展示，也不得因为隐藏 JSON 而让用户看不到即将下旨的内容。拟旨页面按最终确认的最小视图只投影“参与部门”和自然语言“即将下旨的草案”；完整草案契约、权限边界、版本、指纹和下旨门禁继续在内部独立保留。拟旨中、拟旨失败和拟旨结果仍优先于旧回奏展示。

## Detection

`frontend/src/features/study-visual/DevStudyWorkspace.test.ts` 必须同时断言：页面不含 `JSON.stringify` 或 `<pre>`；拟旨卷轴只展示参与部门、自然语言“即将下旨的草案”、状态和唯一【下旨】按钮；理解分析、补全说明、暂定边界及逐字段结构化内容不在卷轴重复展示；拟旨中和拟旨失败进入中央卷轴。`npm test`、`npm run typecheck`、`npm run build` 和 `node scripts/check_harness.mjs` 作为完成门禁。

## Evidence

- `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- `frontend/src/app/study/chancellorDraft.ts`
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- `.agents/skills/chancellor-draft-edict/SKILL.md`
