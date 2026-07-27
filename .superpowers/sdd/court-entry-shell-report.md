# 第一批受保护朝堂视觉入口报告

## 完成内容

- 扩展 `requireUser()` 的受保护路径联合类型，覆盖大殿、军机处、指挥中心、六部及其动态详情、专署、锦衣卫及其动态详情；保留 `/study` 与 `/shiguan` 既有行为。
- 新增纯视觉共享壳 `CourtShell`：64px 朝堂 Header、深蓝黑金背景渐变、内容区独立滚动。
- 新增可复用 `CourtPlaceholderPage`：中文标题、说明、`功能筹备中` 卡片；动态页只显示已编码的路由片段，不读取数据也不发起请求。
- 新增 9 个服务端受保护入口：`/dadian`、`/junjichu`、`/command-center`、`/liubu`、`/liubu/[code]`、`/liubu/[code]/[office]`、`/zhuanshu`、`/zhuanshu/jinyiwei`、`/zhuanshu/jinyiwei/[signalId]`。
- 将现有朝堂 Header 的真实导航链接扩展至这批已存在路由；未引入 Tailwind、lucide、旧 API/store/hooks 或新依赖。

## 修改文件

- `frontend/src/lib/requireUser.ts`
- `frontend/src/lib/requireUser.test.ts`
- `frontend/src/components/chaotang/ChaotangHeader.tsx`
- `frontend/src/components/chaotang/ChaotangHeader.test.ts`
- `frontend/src/components/chaotang/CourtShell.tsx`
- `frontend/src/components/chaotang/CourtShell.module.css`
- `frontend/src/components/chaotang/CourtShell.test.ts`
- `frontend/src/components/chaotang/CourtPlaceholderPage.tsx`
- `frontend/src/components/chaotang/CourtPlaceholderPage.module.css`
- `frontend/src/components/chaotang/CourtPlaceholderPage.test.ts`
- `frontend/src/app/court-entry-pages.test.ts`
- `frontend/src/app/{dadian,junjichu,command-center,liubu,zhuanshu}/**/page.tsx`

## TDD 与验证

- RED：新增共享壳、筹备页与 9 个入口的测试后，因目标文件不存在而失败（3 个预期 ENOENT 失败）；受保护路径联合类型测试同时通过，证明新增行为尚未实现。
- GREEN：目标测试 8/8 通过。
- 全量验证通过：`npm run lint`、`npm run typecheck`、`npm test`（113/113）、`npm run build`、`git diff --check`。

## 未解决项 / 关注点

- 这批页面按 brief 仅提供受保护视觉入口与筹备态，未迁入 dev 旧业务、模拟数据、图片资产或任何后端调用。
- 顶导仅链接当前真实存在的页面；详情页不额外生成伪造导航入口。
- 未提交、未推送，也未触发真实下旨。
