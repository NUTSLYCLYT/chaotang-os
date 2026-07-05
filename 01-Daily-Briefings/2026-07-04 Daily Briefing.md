# 2026-07-04 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群评审全线瘫痪** — 今日 7 个 swarm review 中 7 个 agent 全部 `exit 141`（SIGPIPE），涵盖 pre-market、close-alert、HF papers、evolution 四个核心管线。根因一致：`openclaw` CLI 文件缺失（evolution log 直接报 "No such file or directory: 'openclaw'"）。这意味着从 7/3 至今，所有多 agent 评审产出为零 — 盘前分析、尾盘决策、论文筛选、每日 lesson 提炼全部空跑数据但不产出结论。影响面：用户收到的 stock alert 只有原始行情数字，无分析建议。

2. **蜂群进化系统冻结 13.5 小时** — MOC 显示 `⏳ 等待评分中 (自 2026-07-04 08:00)`，且 "晨报暂停,直到你评分完今天"。上一次复盘是 5/18（47 天前），能力评分跌至提问质量 30/100、记忆深度 10/100。连续打卡仅 1 天。**这个阻塞会连锁导致明天的 morning-brief 继续空跑**（今天 morning-brief exit=1 可能与此有关）。

3. **Daily Briefing 模板完全空白** — `2026-07-04 Daily Briefing.md` 的 Three things / Risks / Opportunities / Decisions 全部空置。morning-brief cron exit=1，意味着今天无结构化的战略摘要生成。6 条 session log 有记录但无 transcript summary，说明会话数据进了 vault 但未被加工。

## Risks


- **`openclaw` CLI 缺失** — 所有依赖 `openclaw` 子进程调用的 cron（stock pre-market、close-alert、HF papers、evolution、self-diagnose）产出的是空壳文件。影响面：用户本周的股票决策无 agent 辅助分析，论文筛选无人工摘要，进化系统无 lesson 积累。**缓解动作：今晚检查 `/home/ubuntu/.openclaw/` 下 `openclaw` 二进制是否存在，或检查 PATH/cron 环境中 `which openclaw` 是否返回空。** 修复后重跑 today 的 stock-close-alert 和 hf-papers。

- **evolve 评分阻塞会传递到明天** — MOC 明确写 "晨报暂停,直到你评分完今天"。如果今晚 24:00 前不手动评分（在 MOC 或 evolve sync 中触发），明天 08:00 的 morning-brief 会继续 exit 1。**缓解动作：定位评分入口（可能是 CourtOS-Brain 的某个 endpoint 或 cron 参数），今晚完成评分。**

- **vault-index 的 embed 404** — 多个 `✗ embed: HTTP Error 404`，说明 embedding 服务端点不可达。这会降级 super-brain 的语义搜索能力，但不会阻塞 cron 产出。**缓解动作：检查 embedding 服务（可能是 litellm 路由或本地 ollama）的 endpoints 配置。**

## Opportunities


- **修复 openclaw CLI 后 batch 重跑今日所有失败评审** — 今日市场数据是完整的（A 股 +0.37%、港股科技普涨、拼多多 ADR +8.01%、蔚来 -5.34%），只是缺分析。修复 CLI 后，依次重跑 stock-pre-market → stock-close-alert → hf-papers → daily-lesson，可以在 30 分钟内补齐今日所有缺失产出。**触发条件：`which openclaw` 返回有效路径。**

- **ta-deep-brief 只产出了 284 字节**（正常应 2-7KB），但 ta-premarket 和 ta-postmarket 正常产出。说明 deep 分析管线能跑但中途中断（超时或模型调用失败）。**验证动作：读 `/home/ubuntu/.openclaw/state/ta-briefs/2026-07-04-deep.md` 看中断在哪一步，针对性修复后重跑。**

## What changed

-

## Decisions needed


- **明天 12:00 前：是否降级 swarm review 到单 agent 模式** — 当前 `openclaw` CLI 作为多 agent 调度器不可用。选项 A：修复 CLI 路径后恢复多 agent。选项 B：临时改为单 agent direct call（绕过 openclaw，直接用 hermes 调单个 agent），产出会降质（无多视角辩论）但不会空跑。取舍：质量 vs 可靠性。**建议先 B 后 A，确保明天至少有一份可用的盘前分析。**

- **evolve 评分：手动触发还是等自动恢复** — MOC 要求用户评分，但 cron 没有自动评分逻辑（评分是人工环节）。选项 A：今晚手动在 CourtOS 界面评分，解锁明天晨报。选项 B：修改 evolve-sync cron 加入自动评分 fallback（用上次分数默认值）。取舍：人工判断精度 vs 系统不中断。**如果 5/18 之后从未评过分（47 天），选 A 没有意义（已失去连续性）— 建议 B，设 auto-score=5/10 默认值恢复流转。**

---


---
_自动智能填充 @ 21:35 · source: 2026-07-04_21-31-14.md_


### Session log 23:53 — chaotang-web-lyt
  - [no transcript summary]
