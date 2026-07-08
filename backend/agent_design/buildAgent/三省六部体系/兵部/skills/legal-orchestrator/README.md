# Legal Swarm — 企业法律决策 Agent 蜂群

一个即插即用的 Hermes Agent 技能包：模拟顶级律所管委会，由 6 个协作 skill 组成，把任意企业法律情境拆解成一份 CEO 可直接照做的《决策备忘录》。

## 成员

| Skill | 角色 | 作用 |
|---|---|---|
| `legal-orchestrator` | 管委会主席 | 拆情境、并行调度、汇总备忘录 |
| `legal-offense` | 进攻律师 | 找对手漏洞 + 最狠三招 |
| `legal-defense` | 防守律师 | 找己方漏洞 + 堵漏 + 反击 |
| `legal-judge` | 法官视角 | 中立裁判、胜负手、胜率预测 |
| `legal-prosecutor` | 检察/公安视角 | 刑事风险扫描、罪名矩阵 |
| `legal-compliance` | 政法委/监管/舆情 | 监管红线、披露义务、沟通路线图 |

## 安装（到任意 Hermes 实例）

```bash
# 方式 A：整包复制
cp -r legal-orchestrator legal-offense legal-defense legal-judge legal-prosecutor legal-compliance ~/.hermes/skills/

# 方式 B：git
git clone <your-repo> /tmp/legal-swarm
cp -r /tmp/legal-swarm/legal-* ~/.hermes/skills/

# 验证
hermes skills list | grep legal
```

应看到 6 行 legal-*。

## 使用方式

### 单角色
```
/legal-offense 帮我分析这份股权回购协议对方的漏洞
/legal-prosecutor 我们现在和供应商的返点安排有没有刑事风险
```

### 完整蜂群（推荐）
```
/legal-orchestrator 情境：我司是一家 B 轮消费电子公司，深圳前员工带走客户名单去新公司，对方已上线相似产品，我们是原告，目标是阻断他们卖货 + 索赔，管辖大陆
```

Orchestrator 会先问你缺的事实（立场、目标、证据、管辖），然后拉齐五位专家并行会诊、对抗推演，最后产出一份固定格式的决策备忘录。

## 推荐模型

| 场景 | 模型建议 |
|---|---|
| 日常咨询 / 拆解 | `openrouter/anthropic/claude-sonnet-4.6` 或 `nous/hermes-*` |
| 高难度诉讼推演 | `claude-opus-4-6`（深度对抗推理） |
| 批量文件初筛 | `claude-haiku-4-5` 成本优 |

切换方式：`hermes model` 或在 orchestrator 里用 `/model <provider:id>`。

## 硬性纪律（所有 skill 共通）

1. **不编法条**——引用必须具体条文号，不确定写"待查证"
2. **不代替真实律师**——所有对外动作必须持牌律师签字
3. **不给单边意见**——每条建议都必须配对"对方会怎么反应"
4. **不出违法馊主意**——销毁证据、串供、行贿、以刑逼民一律拒绝
5. **致命风险必须第一页高亮**——哪怕 CEO 不想听
6. **刑事风险必升级**——出现刑事苗头立即拉 `legal-prosecutor` 联审
7. **上市公司披露一票否决**

## 调试与迭代

- 每次用完后运行 `hermes insights --days 7` 查看调用情况
- 对输出不满意？直接 `/skills edit legal-offense` 微调 prompt
- 让 Hermes 自己学：在会话里说"把刚才那个应对思路沉淀成 legal-defense 的一条补充规则"，Hermes 会自动把它写回 SKILL.md

## 跨蜂群复制

整个目录都是纯 Markdown + frontmatter，无任何二进制依赖。要复制到其他 Hermes 实例：

```bash
tar czf legal-swarm.tgz legal-orchestrator legal-offense legal-defense legal-judge legal-prosecutor legal-compliance
scp legal-swarm.tgz other-host:~/
ssh other-host 'mkdir -p ~/.hermes/skills && tar xzf ~/legal-swarm.tgz -C ~/.hermes/skills/'
```

也可以上传到 [agentskills.io](https://agentskills.io) 共享。

## 免责声明

本技能包为内部决策辅助工具，**不构成法律意见**。所有对外法律动作、合同签署、诉讼文书、监管沟通须由持牌律师复核并签字。
