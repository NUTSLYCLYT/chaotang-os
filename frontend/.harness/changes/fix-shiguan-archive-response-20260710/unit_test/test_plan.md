# 单测计划

## 覆盖范围

- 当前 `{ success, data: { memorials, decisions } }` 信封被扁平化，奏折与裁决分类正确。
- 旧 `{ success, data: ArchiveRecord[] }` 响应保持兼容。
- 异常对象产生安全空数组，保证页面数组操作不抛错。

## 命令

- `node --experimental-strip-types --test src/features/shiguan/lib/archive-adapter.nodetest.ts`

## 未覆盖风险

- 未模拟完整浏览器 SWR 刷新周期；风险由 adapter 纯函数覆盖与 TypeScript 检查降低。

