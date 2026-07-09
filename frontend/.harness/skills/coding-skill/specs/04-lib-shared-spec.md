# Lib / Shared 规格

## 适用范围

`src/lib/**`、`src/shared/**`、`src/types/**` 下的共享工具、adapter、类型与公共契约。

## 规则

- 共享层不能 import UI 或 route 模块。
- 外部数据 adapter 必须处理错误态和 source label。
- 避免隐式全局状态，除非该文件已有模式且有测试覆盖。
- 类型变更要考虑所有调用方。

## 验证

- TypeScript。
- 相关 adapter/contract 单测。
- 需要时跑 build。
