# 朝堂OS 上线版本 v1.0.0 · 2026-07-08

用户指令："整理一个上线版本，把架构和精华抽取出来，尽快完成产品运营"。
本轮把散在分支/工作区的精华收敛进 master 打第一个上线 tag。**代码收敛是地基，不是运营终点**（见文末大神战略门）。

## 三门全绿（上线工程判据）

| 门 | 命令 | 结果 |
|---|---|---|
| 类型 | `pnpm exec tsc --noEmit` | EXIT 0 |
| 单测 | `pnpm test:node` | 991 / 991 pass |
| 构建 | `NEXT_DIST_DIR=.next-v1check NEXT_PUBLIC_API_MODE=real pnpm build` | Compiled successfully · 全页生成 |

## 收敛了什么

1. **安全精华落地（本轮核心缺口）**：7-06 会审抓出的 CRITICAL 一直躺在工作区未提交，本轮提交——
   共享守门 `require-court-swarm-auth`（会话 401 + 后端验签 fail-closed + per-user 限流），
   4 个 dept 蜂群派发 route 首行装锁，堵住"匿名 curl 即可无限触发真蜂群烧钱 + admin 提权"。
   回归门：`require-court-swarm-auth.nodetest`（源码 tripwire）+ `court-pipeline.nodetest`（门下 fail-closed）。
2. **吸收 master 4 条真成果**：SSR loader 转发 cookie 点亮六部、户部右栏参谋席、军机处 stat 认 merge 快照、军机处接后端 result.merge。
3. **小修复机器判定（git cherry，非猜）**：
   - `dispatch-proxy-timeout`（20s→100s）→ 已在 master，跳过
   - `swarm-overview-auth`（服务 token 401）→ 已在 master，跳过
   - `visual-proxy-ssrf`（SSRF）→ 目标 route 已被 master 删除，**漏洞面消失，补丁作废**，不折入

## 白名单策略（半成品面处置）

保留 `launch-whitelist.ts` 运行时 redirect，**不删码**。生产 `NODE_ENV=production` 下，
非首发面自动 redirect→上书房；翻林/东宫/治理/原型等半成品代码留在仓里可逆，日后解冻即用。

## 回滚地雷（记录，不 merge）

以下老分支 base 是旧 master、`git diff master..分支` 显示上万行删除——**误 merge 会把 master 成果反删**：
- `p0-swarm-feedback-p2-taiyi`、`junjichu-phase0-realcards-spine`：`git cherry` 证内容已全在 master，可删。
- `court-surfaces-real-business`：仅 docs 共识，已被 CLAUDE.md 铁律取代，可删。
- `jinyiwei-real-intel`：有 1 条未合的"导航 guard 重定向真情报"意图 + 10 万行分叉，**不 merge**，留删待定。

## 下一步：运营门（大神战略 · 用户问"大神会怎么做"）

工程三门全绿 ≠ 有人付费。上线真正的门在运营，不在代码：

- **张小龙（做减法）**：白名单现放行约 25 页 + 6 部门，那是"没舍得删的全部"不是精华。
  上线第一周应再砍到**只剩一条杀手 loop**（储能合同上传→六部审→准奏→史馆归档），一个入口一个 CTA。
- **Bezos（倒推）**：先写"某储能老板为什么付 5 万"的一句话，写不出别上线；只有服务这句话的面才是精华。
- **Taleb（不可逆）**：上线可回滚，但第一个真实付费客户撞见 FALLBACK 冒充 LIVE 的印象不可逆——
  宁晚一周，别让首客尝到假的（7-06 会审刚修的"空蜂群冒充绿灯"就是这类雷）。

**运营第一步建议**：v1.0.0 tag 后，把白名单砍到一条 loop + 拉一个真实储能老板走爆它，拿到第一条真实反馈。
