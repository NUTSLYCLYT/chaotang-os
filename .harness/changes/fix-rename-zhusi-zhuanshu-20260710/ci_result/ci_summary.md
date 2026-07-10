# CI 摘要：fix-rename-zhusi-zhuanshu-20260710

## 命令

- `frontend`: `tsc --noEmit`
- `frontend`: Node 路由与模块配置测试
- `frontend`: `NEXT_PUBLIC_API_MODE=real pnpm build`
- `frontend`: Playwright 核验 `/liubu` 与 `/zhuanshu`
- `backend`: `pytest tests/test_chaotang_department_protocol.py`
- 根、前端、后端 harness doctor

## 结果

- 前端类型检查通过；10 条路由与模块配置断言通过。
- Next.js 16.2.6 生产构建通过，只生成 `/zhuanshu`、`/zhuanshu/jinyiwei` 与信号详情，不生成 `/zhusi`。
- 专署页面显示“专署”，背景图加载完成，锦衣卫入口指向 `/chaotang/zhuanshu/jinyiwei`，无版本或产品边界占位文案。
- 后端部门协议 13 条测试通过。
- 根、前端、后端 harness doctor 均为 0 errors / 0 warnings。
