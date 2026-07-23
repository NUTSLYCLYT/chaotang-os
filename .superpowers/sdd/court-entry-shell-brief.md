# 第一批：受保护朝堂视觉入口

## 目标

为当前工程缺失的 dev 朝堂页面创建受保护的纯视觉入口，并建立可复用的共享朝堂页面壳；不迁入 dev 旧业务。

## 允许修改

- `frontend/src/lib/requireUser.ts` 及其测试
- `frontend/src/components/chaotang/**`
- `frontend/src/app/dadian/**`
- `frontend/src/app/junjichu/**`
- `frontend/src/app/command-center/**`
- `frontend/src/app/liubu/**`
- `frontend/src/app/zhuanshu/**`
- 相应前端测试

## 必须满足

1. 新增页面 `/dadian`、`/junjichu`、`/command-center`、`/liubu`、`/liubu/[code]`、`/liubu/[code]/[office]`、`/zhuanshu`、`/zhuanshu/jinyiwei`、`/zhuanshu/jinyiwei/[signalId]` 均在服务器端调用现有 `requireUser()`；扩展其受保护路径联合类型和测试，不改变 `/study`、`/shiguan` 行为。
2. 新建纯视觉 `CourtShell` 和可复用 `CourtPlaceholderPage`，仅使用 React、Next Link 和 CSS Modules；不得引入 Tailwind、lucide、dev hooks/store/API client 或新增 npm 依赖。
3. 壳采用 dev 的深蓝黑金层级：64px Header、背景场景/渐变、内容区独立滚动、标题/说明/筹备状态卡。Header 的真实链接只能指向当前路由：`/dadian`、`/study`、`/junjichu`、`/liubu`、`/zhuanshu`、`/shiguan`；`/study` 继续作为上书房入口。
4. 每个新增页必须展示对应名称和“功能筹备中”；动态参数页可以展示已安全解码的路由片段，但不得伪造部门/信号数据或发起任何请求。
5. 页面布局在窄屏可滚动，不遮挡 Header；所有显示文案为中文；不得添加浏览器后端直连、会话读写或模型调用。
6. 先添加能证明受保护路由、共享壳和筹备态存在的测试并确认 RED；再实现并验证 GREEN。运行 lint、typecheck、test、build。不得提交或推送。

## 报告

写入 `.superpowers/sdd/court-entry-shell-report.md`，包含修改文件、测试、未解决项。
