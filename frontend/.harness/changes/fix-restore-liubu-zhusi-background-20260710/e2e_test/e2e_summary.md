# E2E 摘要

结论：PASSED

## 结果

- 六部背景 `/assets/zhuangyuan/04-zhuangyuan-new.webp` 加载完成，naturalWidth=1672，六个现行入口 href 均存在。
- 专署主页展示独立门户背景与锦衣卫入口卡，不直接渲染锦衣卫情报工作台，也不出现庄园标题或庄园节点。
- 两页全局 header 均为 1440×64、可见且位于内容区上方；截图人工核验通过。
- `/zhuanshu` 加载专署门户背景 `/assets/jinyiwei.webp`；锦衣卫入口 href 为 `/chaotang/zhuanshu/jinyiwei`。
- 专署门户保留 `CHAOTANG OS · IMPERIAL DIRECTORATES` 英文眉题与“朝堂外廷专署各守专责。”说明，锦衣卫入口展示功能职责。
- `/zhuanshu` 页面不再包含 `1.0`、`已纳入`、`未开放` 或 `产品边界` 文案。
- 锦衣卫 GET 接口返回 404 时页面以 `FALLBACK` 展示 12 条明确标注的兜底样例，完整工作台不再被错误态遮住。
- 本机后端现有 `intel/signals`、`zhuangyuan/ministry-metrics` 返回 404，未登录 `chaotang/tasks` 返回 401；背景与页面骨架仍正常展示。

