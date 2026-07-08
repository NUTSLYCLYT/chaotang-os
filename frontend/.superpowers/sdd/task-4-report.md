# Task 4 Report — 铁律4 回归断言(不编outcome + 空旧案不挂徽章)

**日期**: 2026-06-28  
**分支**: feat/shiguan-value  
**commit**: a4bc3a1  
**状态**: DONE ✓

---

## 变更文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/features/shangshufang/lib/recall-badge.ts` | 新建 | 纯函数 `recallBadgeLabel(count)` |
| `src/features/shangshufang/ShangshufangPage.tsx` | 修改 | 内联三元 → 调 `recallBadgeLabel()`，行为不变 |
| `src/core/courtos/archive/shiguan-honesty.nodetest.ts` | 新建 | 铁律4 两条钢轨断言（5 个 test case） |

---

## 两条钢轨怎么钉的

### 钢轨1：不编 outcome

**问题**：`findSimilarCourtArchives` 有 `server-only`，不能在 Node test runner 直接 import。

**解决**：复用 Task1 的策略——用 `buildRecallQuery`（纯函数）+ `@libsql/client` 内存 DB，还原 archive-store.ts 的 SQL 层 + 映射逻辑：

```ts
const rawStatus = row!.retrospective_status;  // LEFT JOIN 未命中 → null
const retrospectiveStatus = rawStatus ? String(rawStatus) : undefined;  // 映射逻辑
assert.notEqual(retrospectiveStatus, '达成');  // 钢轨核心断言
assert.equal(retrospectiveStatus, undefined);   // 确认具体值
```

数据构造：插入一条 `court_archives` 行（`task_id = 'task-no-retro'`），`shiguan_archives` 中无对应行 → LEFT JOIN 未命中 → `retrospective_status = null` → 映射为 `undefined`，绝不是 `'达成'`。

### 钢轨2：空旧案不挂徽章

**问题**：原逻辑是 ShangshufangPage.tsx 第 1125 行的内联三元：

```tsx
...(result.archive_hints?.length ? [{ label: `引用旧案 ${result.archive_hints.length} 条`, tone: 'blue' as const }] : [])
```

内联在 JSX 中，无法纯测。

**解决**：抽取为 `src/features/shangshufang/lib/recall-badge.ts` 中的纯函数：

```ts
export function recallBadgeLabel(count: number): string | null {
  return count > 0 ? `引用旧案 ${count} 条` : null;
}
```

ShangshufangPage.tsx 改用此函数，行为完全不变，仅解耦逻辑。

测试断言：
- `recallBadgeLabel(0) === null`（防空集合挂徽章冒充先例）
- `recallBadgeLabel(-1) === null`（防御性）
- `recallBadgeLabel(1) === '引用旧案 1 条'`
- `recallBadgeLabel(2) === '引用旧案 2 条'`

---

## 验证结果

| 门 | 结果 |
|---|---|
| `npm run test:node` | **439 pass, 0 fail** |
| `pnpm exec tsc --noEmit` | **exit 0** |
| `NEXT_PUBLIC_API_MODE=real npm run build` | **✓ Compiled** |

新增 5 个 test case（ok 32–ok 36 在全套 439 之中）：
- `ok 32` 铁律4·钢轨1: 无 retrospective 的旧案，映射后 retrospectiveStatus 绝不能是"达成"
- `ok 33` 铁律4·钢轨2: recallBadgeLabel(0) 返回 null
- `ok 34` 铁律4·钢轨2: recallBadgeLabel(1) 返回正确标签
- `ok 35` 铁律4·钢轨2: recallBadgeLabel(2) 返回正确标签
- `ok 36` 铁律4·钢轨2: recallBadgeLabel 负数返回 null

---

## 约束遵守

- ShangshufangPage.tsx 行为不变，只是内联三元换成调纯函数。
- 不新增版面、不改 API 路由、不改 globals.css/design-tokens。
- 不 push 到远程（等用户指令）。
