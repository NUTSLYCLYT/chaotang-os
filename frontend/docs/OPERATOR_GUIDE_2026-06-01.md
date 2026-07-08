# 操作指南 · 亲手验证第一个"帮我了"（2026-06-01）

> 给老板（陛下）的手把手指南。窗口 A 已把后端准备好，剩下浏览器里这几步只能你做。

---

## 现状（我已替你做好的）
- ✅ dev server 已重启在 `http://localhost:3002/`，加载了 DeepSeek 真 LLM env。
- ✅ `/api/chat` 路由实测存活（401＝活着，待登录）。
- ✅ 修复了一个并发窗口留下的破损 `pnpm-workspace.yaml`（sharp 占位符 → false）。
- ✅ 实证：真 DeepSeek 对"厦门AI决策"已能出专业奏折（见 REAL_LOOP_VALIDATION）。

---

## 第一步：打开 + 登录（2 分钟）
```text
1. 浏览器开  http://localhost:3002/      （会自动跳启动动画 /intro）
2. 走 /register 或 /enter 注册一个试用账号（trial 即可）
3. 进入主界面（御座 /throne 或 上书房）
```

## 第二步：把真决策丢给丞相（核心 · "帮我了"时刻）
```text
4. 找到「丞相对话 / 军机处下旨 / 上书房经营建议」任一入口
5. 粘贴这句真决策：

   召集户部、刑部、礼部、锦衣卫、钦天监，评估厦门 AI 公司合作方案，
   重点审查商业模式、股权风险、招商话术和 90 天执行路径。

6. 发送，看丞相流式回答
```

## 第三步：怎么判断"真"成功（关键）
| 看到 | 含义 |
|---|---|
| ✅ 具体数字/法条/话术，每次问结果**不一样**（像"投入1200-2000万、创始≥67%控制权…"） | **真 DeepSeek 在干活 → 这就是"帮我了"** |
| ❌ 固定模板"先命礼部整理同类历史定稿3份…"，每次**一模一样** | 还在 scripted 假响应 → env 没加载（见排错） |

**真验收**：你读完真奏折，问自己一句——**"这帮我把决策结构化了吗？"** 是 → 北极星 AC5 达成。

---

## 排错：如果还是假的（固定模板）
```bash
# env 没生效，重启 dev（在项目目录）
! cd /home/ubuntu/workspace/chaotang-web-lyt
! kill $(ss -tlnp | grep :3002 | grep -oP 'pid=\K[0-9]+') 2>/dev/null; sleep 2
! nohup node node_modules/next/dist/bin/next dev -p 3002 > /tmp/dev.log 2>&1 & disown
# 等 15 秒，再试。确认 .env.local 里有 OPENAI_API_KEY=sk-...（DeepSeek）
```

---

## 另一件事：Gitee 同步（收束 25 文件分叉，本环境拉不动，你来）
```bash
# 1. 看清差异
! cd /home/ubuntu/workspace/chaotang-web-lyt && git fetch origin
# 2. 各窗口先提交自己边界内文件（别 stash 别人的）。例：
#    工部窗口:  git add src/app/.../gongbu-client.tsx src/features/operating-loop/lib/department-build-workflow.ts
#    户部窗口:  git add src/app/.../hubu-client.tsx src/features/operating-loop/lib/build-budget.ts
# 3. 合并远端（冲突文件由该文件 owner 窗口解）
! git merge origin/master         # 或 git rebase origin/master
# 4. 推送
! git push origin master
```
> ⚠️ 我已修好的 `pnpm-workspace.yaml` 是未提交状态，记得 `git add pnpm-workspace.yaml` 一起提交。

---

## 派 Codex 做"3 视角 council"（RL-01，把单丞相升级成参审）
给 Codex 窗口这段：
```text
你是 Codex 工部工程实现。读 src/app/api/chat/route.ts（已是生产级真 LLM 流式样板）
和 docs/REAL_LOOP_VALIDATION_2026-06-01.md（含验证过的 3 视角 prompt）。
新建 src/app/api/court/chaotang/council/route.ts：
- 收 { decision: string }
- 克隆 chat route 的 openaiStream，并行跑 3 个视角 prompt(户部/刑部/礼部)
- 收齐后用丞相 SYSTEM_PROMPT 汇总成一份奏折，SSE 返回
- env 已就位(OPENAI_API_KEY=DeepSeek)
- 前端军机处 BattleStream 接这个 SSE
验收: npm run build 通过；同输入两次结果有别(非mock)；3视角各有侧重。
不改 gongbu/hubu 主体，不改 globals.css。
```

---

> 一句话：后端我已点亮，**你现在去 http://localhost:3002/ 登录，把厦门AI决策问丞相，看它说真话 —— 那一刻就是朝堂 OS 的第一个"帮我了"。**
