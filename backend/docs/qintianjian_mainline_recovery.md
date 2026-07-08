# 钦天监主线纠偏与迁移记录

> **现状（2026-07-04 补标）**：本文宣布的"主线目标"（用户目标→钦天监参谋→SEALED_BRIEF→蜂群执行→
> 史馆归档）目前是**治理意图**，不是已经强制执行的代码路径。已验证过的上书房蜂群链路
> （`/api/shangshufang/draft-edict`→`confirm-edict`→`decision`）并没有先经过钦天监这道关再执行——
> 全仓没有代码检查"正线/红线任务必须先有 SEALED_BRIEF"。这份文档本身就是"最像官方定论、离代码现实
> 最远"的一个实例，读的时候按"方向对、未落地"对待。协议本体见已合并的 [`docs/qintianjian.md`](qintianjian.md)。

## 结论

本轮确认：主线不是 Web 页面体验，而是 `jiqun_ai` 的钦天监、蜂群、flow、harness、质量门禁和史馆证据链。

偏移期间产生的 Web/UI 原型想法不直接迁入主线代码。只迁移可复用的主线能力：

- 钦天监前置参谋
- workflow 路由
- 快线 / 正线 / 红线
- 三省控制边界
- 蜂群按需召唤
- 验收证据
- 史馆反哺
- 用户分层但以钦天监能力为入口
- 御史偏移监控

## 主线目标

```text
用户目标
-> 钦天监参谋
-> 1-3 个关键选择
-> SEALED_BRIEF
-> 蜂群按边界执行
-> 独立评分 / 熔断 / 人类签字
-> 史馆归档
-> 下一轮改进
```

## 从偏移产物迁回主线的设计

### 1. 案卷令牌 -> 钦天监简报 ID

Web 原型里的 `CourtWorkflow token` 在主线中应表达为 `SEALED_BRIEF.id`。

每次重大任务必须能追踪：

- 原始目标
- 关键选择
- 大神建议摘要
- 执行边界
- 目标蜂群
- 验证方式
- 人类签字点
- 史馆归档 ID

### 2. 自动快慢线 -> 钦天监路由

```text
快线：小修 / 可逆 / 低风险
正线：多蜂群 / 预算 / 生产 / 战略
红线：不可逆 / 客户承诺 / 用户数据 / 花钱 / 自动执行
```

快线可以直接做，但仍需收口。正线和红线必须先形成钦天监简报。

### 3. 三省控制 -> 简报质量门

三省不作为 UI 仪式，而作为简报质量门：

```text
中书：任务说清楚了吗？
门下：风险和反证列出来了吗？
尚书：执行边界、验收、负责人明确了吗？
```

### 4. 蜂群黑匣子 -> run/eval 审计

每次蜂群执行都要留下：

- swarm_id
- input brief
- provider / model
- cost / latency
- evidence
- score
- failure mode
- archive link

没有审计记录的蜂群输出不能进入主线质量基线。

### 5. 史馆反哺 -> must_not / capability manifest

史馆不只是记录成功，也要记录失败和偏移：

- 成功能力写入 `docs/shiguan/capability_manifest.md`
- 失败教训写入对应史馆文档或 `must_not`
- 偏移教训写入本文件和御史脚本测试

## 用户分层在主线里的正确表达

主线不做四套 Web 操作皮肤。主线只定义能力层级：

| 用户 | 主线体验 | 输出 |
|---|---|---|
| 小白 | 钦天监给 1-3 个选项，可回复“按推荐来” | SEALED_BRIEF |
| 玩家 | 使用任务协议和 harness 跑完整闭环 | run report |
| 资深玩家 | 调整蜂群、质量门、红线、人签策略 | policy / config |
| 极客 | 编写/扩展 harness、eval、路由脚本 | tested automation |

## 御史偏移监控

新增脚本：

```bash
python scripts/yushi_drift_monitor.py
python scripts/yushi_drift_monitor.py --staged-only
```

它负责发现：

- Web/UI 支线文件混入主线
- 运行产物/环境漂移混入提交
- 重大/不可逆/生产/多蜂群事项没有提到钦天监
- 新增内容出现支线 Web 信号

## 后续执行顺序

1. 先跑御史偏移监控。
2. 再跑提交收口检查。
3. 如果任务触发红线，先形成钦天监简报。
4. 蜂群执行必须带简报边界。
5. 验证通过后归档史馆。

推荐命令：

```bash
python scripts/yushi_drift_monitor.py
python scripts/commit_closeout_check.py
pytest tests/test_yushi_drift_monitor.py
```

## 禁止事项

- 不把 Web 页面、组件、样式、Next.js build 产物迁入 `jiqun_ai` 主线。
- 不用 Web 原型替代钦天监简报。
- 不把偏移期间的运行产物当主线成果。
- 不绕过人类签字执行红线任务。
