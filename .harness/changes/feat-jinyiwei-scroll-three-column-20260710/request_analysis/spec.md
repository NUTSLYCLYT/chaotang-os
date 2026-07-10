# 规格说明：feat-jinyiwei-scroll-three-column-20260710

## 背景

现有锦衣卫页面虽有三栏外形，但中心默认是产业看板，页面未围绕后端“检索→确定性核验→裁决→归档”形成一份可追溯密报。用户要求按 `frontend/docs/jinyiwei-scroll-three-column-implementation-plan.md` 100% 实现。

## 范围

- 左栏真实采证、真实数据状态、待核任务和后端能力。
- 中栏默认密报卷轴，并保留产业、地图、队列为辅助视图。
- 右栏展示一手、多源、硬声明、入库裁决、归档和四色建议流向。
- 补齐后端 court_doc 的结构化来源及 vet 字段，禁止前端猜测。
- 完成桌面、平板、手机响应式和自动化验证。

## 非目标

- 不新增无事实源的指标或成功动作。
- 不把兼容派发或 fixture 包装为真实能力。
- 不在前端复制可信度算法。

## 验收标准

- 默认中栏为卷轴，采证成功、空态和错误均有明确表现。
- LIVE_SEARCH / CALLER_FINDINGS / FALLBACK 清晰区分。
- 结构化来源、来源类型、发布日期、硬声明和核验原因可见。
- 绿黄红黑分别建议钦天监、御史、继续补证和刑部。
- 390、1024、1366、1440 宽度无横向溢出，移动端顺序符合文档。
- 前后端测试、构建和三层 doctor 通过。

## 验证计划

运行前端 TypeScript、hook/contract 测试、Playwright、多视口核验和 production build；运行后端锦衣卫 focused pytest；运行根、前端、后端 harness doctor 与 diff check。
