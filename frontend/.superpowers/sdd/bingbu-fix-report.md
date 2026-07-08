# 兵部飞轮会审修复报告

**分支**: feat/bingbu-flywheel  
**commit**: ce39a4a5  
**日期**: 2026-06-28  

---

## 四门验证结果

| 门 | 结果 |
|---|---|
| `pnpm test:core` | **332 pass / 0 fail** |
| `pnpm test:node` | **445 pass / 0 fail** |
| `pnpm exec tsc --noEmit` | **0 errors** |
| `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck npm run build` | **成功 · 175 server routes** |

---

## HIGH 修复：passesThreshold 阈值门递进

**问题**: `passesThreshold` 与 `selectCandidates` 使用同一条件（`BINGBU_KEYWORDS.some(...)`），
第二道闸 100% 通过 → 刷屏。

**修法**: `passesThreshold` 改为关键词命中数 ≥2：

```typescript
// src/core/courtos/department-flywheel/bingbu/hooks-pure.ts
export function passesThreshold(task: SourceTask): boolean {
  const text = `${task.title} ${task.command}`;
  const hitCount = BINGBU_KEYWORDS.filter((k) => text.includes(k)).length;
  return hitCount >= 2;
}
```

- `selectCandidates`: ≥1 关键词（宽筛候选）
- `passesThreshold`: ≥2 关键词（明确商机语境，比第一道严）

**测试改动** (`hooks.nodetest.ts`):
- 删除旧断言"passesThreshold 与 selectCandidates 门判断一致"（固化缺陷）
- 新增 `singleKeywordTask`（title='销售讨论', command='本周工作安排确认'，命中数=1）
- 新增断言：sk1 通过 selectCandidates（≥1）但被 passesThreshold 拦截（1 < 2）
- 新增断言：候选集中存在至少一条不通过阈值门（两道闸递进有效）

---

## MED-1 修复：row-to-source-task 共享化

**问题**: bingbu route 跨部门 import `../../hubu/auto-raise/row-to-source-task`。

**修法**:
- 将 `row-to-source-task.ts` 上移至 `src/core/courtos/department-flywheel/row-to-source-task.ts`
  - 类型 import 从 `@/core/...` 改为相对路径 `./types.ts`（test:core 兼容）
- 将 `row-to-source-task.nodetest.ts` 同步移至同目录（现在被 test:core 覆盖而非 test:node）
- `hubu/auto-raise/route.ts`: import 改为 `@/core/courtos/department-flywheel/row-to-source-task`
- `bingbu/auto-raise/route.ts`: import 改为同路径（消除跨目录依赖）
- 删除旧 hubu 目录下的两个文件

**户部正常**: tsc 0 + build 成功 + test:node 445 pass 确认无断链。

---

## MED-2 修复：FALLBACK/DEMO 已知债标注

**问题**: `hooks.ts` 中 `sourceLabel:'LIVE'` 硬编码 → 质门中 FALLBACK/DEMO 检查永远 pass。

**v1 务实处理**:
- `bingbu/hooks.ts` 在 `sourceLabel:'LIVE'` 处加 TODO 注释，说明债与修路
- `bingbu/route.ts` 在 `rows.map(rowToSourceTask)` 前加注释，说明 FALLBACK/DEMO 过滤待
  `SourceTask` 扩展 `sourceLabel` 字段后补足

---

## 安全修复：catch 错误信息泄露

**问题**: `bingbu/auto-raise/route.ts` catch 块将 `err.message` 透传到响应 `detail` 字段。

**修法**:
```typescript
// 修前
return NextResponse.json({ error: 'flywheel-error', detail: message }, { status: 500 });

// 修后
console.error('[bingbu/auto-raise] flywheel error:', err);
return NextResponse.json({ error: 'flywheel-error' }, { status: 500 });
```

---

## 文件变动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/core/courtos/department-flywheel/bingbu/hooks-pure.ts` | 修改 | HIGH: passesThreshold ≥2 |
| `src/core/courtos/department-flywheel/bingbu/hooks.nodetest.ts` | 修改 | HIGH: 删固化断言，加递进断言 |
| `src/core/courtos/department-flywheel/bingbu/hooks.ts` | 修改 | MED-2: TODO 注释 |
| `src/core/courtos/department-flywheel/row-to-source-task.ts` | 新增(移入) | MED-1: 共享工具 |
| `src/core/courtos/department-flywheel/row-to-source-task.nodetest.ts` | 新增(移入) | MED-1: 进 test:core |
| `src/app/api/court/hubu/auto-raise/route.ts` | 修改 | MED-1: import 共享路径 |
| `src/app/api/court/bingbu/auto-raise/route.ts` | 修改 | MED-1+MED-2+安全: import+catch+注释 |
| `src/app/api/court/hubu/auto-raise/row-to-source-task.ts` | 删除 | MED-1: 迁入共享层 |
| `src/app/api/court/hubu/auto-raise/row-to-source-task.nodetest.ts` | 删除 | MED-1: 迁入共享层 |
