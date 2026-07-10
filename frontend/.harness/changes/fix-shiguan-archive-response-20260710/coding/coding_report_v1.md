# 实现报告 v1

## 改动

- 新增 `archive-adapter.ts`，把当前 archive 响应中的奏折和裁决映射为稳定的 `ArchiveRecord[]`。
- `useArchiveRecords` 在 SWR 数据边界调用 adapter，页面继续只消费数组。
- 更新 `ArchivePayload` 注释，明确其为前端扁平视图而非后端原始响应。

## 取舍

- 保留旧扁平数组兼容，避免回滚或缓存响应再次触发同类错误。
- 异常结构归一化为空数组，不在页面各个 `.filter()` 调用处散点防御。

## 验证

- `node --experimental-strip-types --test src/features/shiguan/lib/archive-adapter.nodetest.ts`
- `pnpm exec tsc --noEmit`

