# 单测计划

## 覆盖范围

- 本轮主要为页面视觉恢复，无新增纯函数业务逻辑；使用 TypeScript 与生产构建覆盖导入、类型和静态路由生成。

## 命令

- `pnpm exec tsc --noEmit`
- `$env:CI='true'; $env:NEXT_PUBLIC_API_MODE='real'; pnpm build`

## 未覆盖风险

- 不以单元测试验证像素布局，改由真实浏览器截图和图片 naturalWidth 断言验证。

