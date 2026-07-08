# 三省设计 ·「合并收敛:一旨·一笔·两闸·一裁·一路由」（5 大神一致 → 合并）

> 2026-06-25 由三省会审（张小龙/Jobs/Bezos/Munger/Karpathy 完全收敛=合并）沉淀。
> 核心矛盾:朝堂存在两套平行治理模型功能重叠(铁律3 僵尸风险)。

## 0. 判决（5 大神一致）
> **合并收敛为一条 courtos Loop，不分层并存。** 中书并入丞相、尚书降为分派路由器（均删独立版面/独立 agent）；**唯门下的「独立否决=制衡」以确定性入口质门形态存活**——做成现有御史出口闸（gate.ts）的对称双生，而非第二个判 agent 的 agent。
> 一句话：删两套平行状态机，留一条单链，制衡从「多养一个官」压成「一道不可绕过的确定性闸 + 用户驳回键」。

## 1. 统一设计「一旨·一笔·两闸·一裁·一路由」
一道不可变 Edict 流过 courtos 单状态机（TaskStatus），沿途盖印、过闸、留痕：
1. **丞相=笔（拟）**：吸收中书，把上书房问题拟成可执行初稿+自陈顾虑；零票、只起草不裁决。
2. **军机处=领域闸（评·可行性轴）**：被召六部蜂群陪审团确定性聚合打分，答「这事**做得成吗**」（技术/商业/交付），不投价值票、不让 agent 判 agent。
3. **门下=入口质门（卡·合规安全轴，与军机处正交）**：答「我们**被允许吗/安全吗**」。**形态=确定性，不是 LLM**：祖训编译硬约束 + 缺证检查 + 史馆旧案检索 + L0-L4 blast-radius 人工门。接口锁成二元封驳 `verdict:'pass'|'veto'|'reback' + reason`，**禁 score、禁 draft**。这是御史出口闸的对称双生（门下守入口·执行前，御史守出口·执行后）。
4. **御座/用户=裁**：一票驳回/补证/复核；制衡的最终权握在人手里，不在任何 agent。
5. **尚书=路由器（派）**：裁决通过后确定性投递到对口庄园/六部；触真实产线资产 HTTP 转 jiqun:8081（铁律#9）；非省非版面，是一个机制。

**三省作为「并立机构/版面」消失**，化为单链上三个动作标签（拟段·门下闸·尚书路由）。用户全程只面对「丞相这道旨走到哪一步」。

## 2. 逐省落点
- **中书（起草/拆解）** → 无独立内核，与丞相拟旨字字重叠。降为丞相的 draft pass，删中书 agent。
- **门下（审议/否决）** → 三省里**唯一不可替代**的内核=「与起草者结构性分离的独立否决权」（制衡）。但落地形态必须从「魏徵 LLM 驳诸葛亮 LLM」（踩"不让 agent 判 agent"红线）换成**确定性入口质门 menxia-gate**。门下的「魂」（说不）活，门下的「身」（判稿 agent + 版面）删。
- **尚书（分派）** → 无审议内核，是裁决后纯路由投递。降为 dispatch 路由器/执行臂（落 core/courtos/executors），守 jiqun 产线边界。

## 3. 边界（按动词/坐标轴切，每个动词只一个主体）
| 动词 | 主体 | 判据（产出物互斥） |
|---|---|---|
| 拟（写旨文） | 丞相 | 谁产出 Edict 草案 |
| 评·可行性轴（打分） | 军机处 | 谁产出确定性聚合的「分」 |
| 卡·合规安全轴（放行/封还） | **门下闸** | 谁产出 pass/veto/reback + reason |
| 裁（最终否决） | 用户/御座 | 制衡握在人手里 |
| 派（投递执行） | 尚书路由器 | — |
| 出口质门（奏折→史馆） | 御史 gate.ts | 与门下入口闸对称不重叠 |
> 军机处问「做得成吗」、门下闸问「被允许吗/安全吗」=两条正交坐标轴，确定性、互不替代、都非 LLM 互判。

## 4. 迁移路径（⚠️ resolve 严格先于 simplify，顺序不可颠倒）
> three-chamber-engine / bill-fsm **被 10+ 文件接着线**（lesson-extractor/audit-chain/court-pipeline/bills-board/throne-decision-desk/transition route/gate.ts/actor-context/deliberate route/bill-store）——**不是死代码，删它是高危大迁移**。
1. **resolve（先补后删，严禁先删后补）**：新建确定性 `menxia-gate.ts`，把 three-chamber-engine 门下省「祖训→硬约束编译」+「史馆旧案检索」整段移植进来。验证 L0-L4 人工门真拦得住高危。
2. bills 全量改走 courtos `TaskStatus`，删 `bill-fsm.ts` 平行 FSM；验证 briefing+史馆同 taskId 闭环不丢任务。
3. 删 `three-chamber-engine.ts` 三 LLM agent：中书并入丞相拟旨、尚书落 executors dispatch、门下 LLM 驳议彻底删（魂以 menxia-gate 存活）。
4. IA/导航/URL 删三省版面；glossary 三省词条保留为历史别名。
5. 跑通类型双门（root tsc + next build）+ e2e 才算合并完成。

## 5. 本轮已落地（grounded，只补不删，零破坏）
- `src/features/governance/lib/menxia-gate.ts`：**门下封驳闸**（迁移第 1 步 resolve 的基石）——确定性 `menxiaGate(input): {verdict:'pass'|'veto'|'reback', reason}`，**type 层锁死禁 score 禁 draft**；违祖训→veto 不可绕过、高风险无人工签→veto 强制人工门、缺证→reback。纯函数。
- `menxia-gate.nodetest.ts`：回归断言（输出不含 score/draft 字段 / 违祖训必 veto / 高风险无签必 veto）。
- **不碰**：three-chamber-engine、bill-fsm 及其 10+ 接线方（删除是单独高危 PR，须 resolve-first 迁移 + 独立会审 + e2e，见 §4）。

## 6. 顶级风险
1. **收敛顺序倒置（最致命）**：先删 three-chamber-engine 再补 menxia-gate=拆掉唯一拦橡皮图章式自我放行的制衡闸 → resolve 严格先于 simplify。
2. **"舍不得删"伪装"做制衡"**：把门下留成独立 LLM agent/版面=既造第二个判 agent 的 agent 又留两套 FSM 腐烂 → 制衡靠用户驳回键+人工门+确定性闸，删官留"驳回"动作。
3. **门下退化成"再打一次分/再拟一版"** → 接口 type 层锁成 verdict+reason，禁 score 禁 draft，CI 永久守它只是一枚印。
4. **删 bill-fsm 但 bills 未完整迁 TaskStatus** → 验证同 taskId 闭环不丢任务。
5. **尚书路由触产线未转 jiqun** → dispatch 切分判据=是否碰真实产线资产，触碰必转后端。
