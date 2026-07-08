# 03 Frontend Execution

本文件目的：约束前端上线执行范围，确保前端只围绕 P0 裁决闭环分拣、修补、验证，不继续散开新页面。
优先级：P0。

## 当前已知事实

- 前端主仓分支：`work/shangshufang-live-edit-20260618`。
- 当前存在已修改文件和未跟踪文件，包含文档、API route、组件、测试、资产、VAM 同步和部门学习。
- 朝堂相关线索集中在 `src/app/(dashboard)`、`src/app/api/court`、`src/features/shangshufang`、`src/features/chaotang`、`src/features/dadian`、`src/features/shiguan`、`src/core/courtos`、`src/lib/contracts`。

## 当前缺口

- 脏文件未分拣，不能安全提交。
- 多套路由体系并存，P0 主线页面尚未最终确认。
- 页面级跳转、移动端、fallback/demo 标识和风险门展示尚未做浏览器验收。

## 能做什么

- 盘点前端脏文件并按 P0/P1/P2 分类。
- 修通 P0 页面跳转、按钮、文案、状态和浏览器验收。
- 明确哪些页面只做入口展示，哪些必须支持真实闭环。

## 不能做什么

- 不能混提交无关页面、视觉资产和配置改动。
- 不能为了好看继续新增不服务 P0 的页面。
- 不能把 VAM 工具链实现逻辑搬进前端主仓。

## 当前优先级

前端现在最重要的不是继续美化，而是：

1. 分拣当前未提交改动。
2. 确认主线页面。
3. 确认 P0 链路跳转。
4. 统一角色、按钮、文案。
5. 做浏览器级验收。

## P0 页面范围

| 路由 | 用途 |
|---|---|
| `/chaotang/intro` | 欢迎页 |
| `/chaotang/study` | 上书房 |
| `/chaotang/court` | 大殿 |
| `/chaotang/junjichu` | 军机处 |
| `/chaotang/memorials` | 奏折 |
| `/chaotang/archive` | 史馆 |
| `/chaotang/swarm` | 蜂群/六部调度入口 |
| `/chaotang/settings` | 设置、权限、风险确认 |

## 六部页面策略

六部页面第一版只做可展示入口，不做深：

- 户部：财务、预算、ROI。
- 吏部：组织、人事、任务归属。
- 礼部：品牌、外联、内容。
- 兵部：运维、安全、应急。
- 刑部：法务、合规、风险门。
- 工部：开发、发布、质量。

## 验收标准

- `pnpm exec tsc --noEmit`
- `pnpm build`
- Playwright 桌面截图。
- Playwright 手机截图。
- 无横向溢出。
- fallback/demo 明示。

## 后续 Codex 可执行任务

```text
你是 CourtOS 前端脏文件分拣官。
只读执行 git status 和必要的 git diff --stat。
把所有前端脏文件按页面、组件、API route、样式、文档、资产分类，并标注 P0/P1/P2。
不要修改文件，不要 stash，不要提交，不要启动服务。
```
