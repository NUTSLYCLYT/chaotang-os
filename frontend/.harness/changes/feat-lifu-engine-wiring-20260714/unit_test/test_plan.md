# 单测计划

## 覆盖范围

`src/features/lifu/api/lifu-compliance.nodetest.ts` 覆盖三个边界行为：

1. 成功响应：断言 canonical path、请求 body、硬灯和三路后端 `source_label` 原样保留。
2. transport 抛错：断言返回 `status:'fallback'`、`sourceLabel:'FALLBACK'` 和真实错误原因。
3. 非 2xx：断言认证/HTTP 失败不能被包装成成功报告。

`src/features/lifu/lib/lifu-roster.nodetest.ts` 继续锁定礼部 8 司，并校正为只有 `commitment_gate` 具备真实后端 engine。

## 命令

```bash
cd frontend
npx --yes tsx --test src/features/lifu/api/lifu-compliance.nodetest.ts
```

## 未覆盖风险

- 不在 node test 中调用真实 LLM，避免非确定、耗时和外部 provider 依赖；后端指定 pytest 覆盖硬闸所有权。
- 本任务没有要求组件 DOM 测试；UI 依靠 TypeScript、现有组件约定和 adapter 判别联合限制错误态。
