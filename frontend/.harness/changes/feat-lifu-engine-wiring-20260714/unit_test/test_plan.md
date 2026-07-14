# 单测计划

## 覆盖范围

`src/features/lifu/api/lifu-compliance.nodetest.ts` 覆盖五个边界行为：

1. 成功响应：断言 canonical path、请求 body、硬灯、派生 `result.sourceLabel`、UI 实际读取的 `result.report.source_label` 及两路意见标签。
2. 未知 `source_label`：断言后端未定义标签不能解析成功，只能诚实 `FALLBACK`。
3. transport 抛错：断言返回 `status:'fallback'`、`sourceLabel:'FALLBACK'` 和真实错误原因。
4. 非 2xx：断言认证/HTTP 失败不能被包装成成功报告。
5. transport 永不返回：用 10ms adapter timeout 与 100ms 测试看门狗证明请求会在超时后进入 `FALLBACK`，而非永久停留在运行态。

`src/features/lifu/lib/lifu-roster.nodetest.ts` 继续锁定礼部 8 司，并校正为只有 `commitment_gate` 具备真实后端 engine。

`src/app/(dashboard)/liubu/page.nodetest.tsx` 使用 `renderToStaticMarkup` 挂载六部 hub 页面，断言真实渲染的 markup 含 `<a href="/liubu/libu_rites">`；移除页面的 card `markHref` wiring 会直接使测试失败。

## 命令

```bash
cd frontend
node --import tsx --input-type=module --eval "await Promise.all([import('./src/features/lifu/api/lifu-compliance.nodetest.ts'), import('./src/features/lifu/lib/lifu-roster.nodetest.ts'), import('./src/app/(dashboard)/liubu/page.nodetest.tsx')])"
```

## 未覆盖风险

- 不在 node test 中调用真实 LLM，避免非确定、耗时和外部 provider 依赖；后端指定 pytest 覆盖硬闸所有权。
- 页面测试是服务端静态挂载，不模拟点击后的客户端状态；本轮只要求并断言可达 anchor，同时保留既有主体选中面板行为。
