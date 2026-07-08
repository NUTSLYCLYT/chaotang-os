# PR: feat/department-flywheel → master

**开 PR 链接（点开→登录 Gitee→提交）：**
https://gitee.com/msxn/chaotang-web-lyt/compare/master...feat/department-flywheel

---

## 标题
feat: 六部决策平台真化（户/兵/工/刑/吏/礼）+ 部门学习飞轮 + WIP上限编排（94 commits）

## 正文（复制到 Gitee PR 描述框）

> 🛑 **合并人必读 · 上线级单向门**：C3 租户隔离未闭（脊柱无 tenant 字段，多租户数据可越界）+ C1 alg:none 未验签。
> **本 PR 合入 master ≠ 可放公网多租户**。仅限单租户 / 可控 demo。放公网自助前，C1+C3 必须先修，否则一次越权=不可逆信任崩塌（box-delivery-security 台账）。

### 这条分支干了什么
把朝堂从"3 真部门"推进到**六部全部成决策办公厅 + 学习飞轮可见**。94 commits / 485 files / +13849 −150。
排雷：无 WIP/broken（"WIP上限"是大野耐一单件流并发上限功能名，非半成品）。

### 主要能力（按板块，63 feat）
**户部（14）** 决策办公厅 M0–M4 + 录入真决策表单 + 三轮卡多部门盖章会审（stamp-pipeline 原语）
**吏部（10）** 6司17引擎（辞退/招人/转正/薪酬/期权/猎头/可信度）+ 杀手引擎接军机处会审流
**刑部（9）** 5引擎+8司+合规页（铁律4会审过）+ 法务链
**礼部 lifu（5）** 对外增长部 8引擎4真司（关系台账RFM/流量ROI归因/SCCT危机/BATNA谈判）+ 防失真门 + /departments/market
**兵部（5）** 销售指挥部复用 stamp-pipeline（充电器定价会审）
**工部（4）** PACK 真接通 jiqun（融合方案样板，经唯一 adapter）+ H盘规格脱敏洞见
**编排/飞轮** 通用"任意部门→jiqun蜂群"派发骨架 + WIP上限（单决策最多召N部）+ 部门学习飞轮可见性（周报内嵌，只读）+ 下旨分流（开创=立项/处置=裁决）
**钦天监（2）** 死法地图否决嵌决策卡 + 学习路径
**安全** 租户隔离迁移打孔清单（15洞→3读函数）+ 御史验签姿态纠察 + guard:tenant 剔误报

### 架构主线（去重铁律6/9）
- 决策OS通用原语 `stamp-pipeline` 被户/兵/吏 3 部复用 = 平台成立（朝堂是决策平台，非六部堆叠）
- 产线全转后端 jiqun，前端只咨询（经唯一 `live-swarm-adapter` 桥）
- 部门飞轮：sign-off/史馆回填 → confirmed/refuted → advisor-signal（喂路由经 env 闸默认关）

### 测试与验证
- [x] root tsc 0 错（排除 .next-buildcheck 缓存）
- [x] 各部 nodetest（兵/户/刑/吏/礼/钦天监/飞轮 回归断言）
- [x] `NEXT_PUBLIC_API_MODE=real pnpm build` 绿
- [ ] 合并后 `pnpm harness:chaotang:gates` 全门禁 + prod doctor

### 已知留白 / 风险（不在本 PR 或需跟进）
- **C1(alg:none未验签) / C3(租户隔离)** 安全门未全闭 → 多租户公网上线前必修（box-delivery-security 台账）
- 兵部第4步「今日外联作战清单」故意留白（demo 反馈倒逼）
- 行为反馈 `DEPARTMENT_LEARNING_FEED_DECISIONS` 默认关（安全）
- 拍板闭环/大殿御座/vitrine 在另一分支 `feat/v1-3live-vitrine` 的 stash@{1}（本 PR 不含）

### 合并前确认
- [ ] `git diff origin/master...HEAD --stat` 已扫，无半成品执行臂混入
- [ ] 生产 env：FENGQUN_AUTH=true / NEXT_PUBLIC_API_MODE=real / JWT_SECRET 两侧一致
