# Feature 规格

## 适用范围

`src/features/**` 下的产品能力切片、UI 工作流和 feature-local helper。

## 规则

- feature 不直接引用另一个 feature 的内部文件。
- 跨 feature 共享能力放到 `src/core`、`src/lib`、`src/shared` 或公共入口。
- feature 可以编排 UI 状态，但不能伪造外部运行执行结果。
- 涉及真实外部运行能力时必须标明 source label。

## 验证

- 聚焦单测或 node 测试。
- 用户可见流程用 Playwright。
