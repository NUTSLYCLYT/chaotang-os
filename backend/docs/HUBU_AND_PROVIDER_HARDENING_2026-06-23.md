# 户部"零产出"真因 + LLM Provider 层加固 · 完整方案(2026-06-23)

> 起因:smoke_all 全蜂群体检报 finance(户部)零产出,疑似蜂群坏。逐层诊断后**证伪**:
> 户部没坏,是测量(并行限流)假阴性。本方案修的不是户部,是「会撒谎的测量 + 脆弱的 provider 层」。

## 一、诊断结论(数据,决定性)

| 证据 | 结论 |
|---|---|
| 户部**单发**测试:completed,6字段产出,quality=2.83 | ✅ **户部蜂群没坏**,能跑能产出 |
| smoke_all(21蜂群**并行**)里 finance 零产出,错误=`deepseek-chat AuthenticationError` | 🔴 假阴性:并行打满 api.deepseek.com 被限流→伪auth错 |
| `DEEPSEEK_API_KEY` 在 .env 设了(len35)、jiqun 启动晚于 .env(已加载) | key 没问题 |
| 本地 `LiteLLM:4444`(理应无限流的兜底代理)**没起**(curl 000) | 🔴 兜底层缺位 |
| `providers.yaml` `active: deepseek`(直连,有限流) | 🔴 生产直挂限流 provider,无本地缓冲 |

**根因:朝堂 LLM 直连 deepseek(有限流),本地 LiteLLM 代理没起,所以一旦并发/突发就有蜂群被限流栽掉;
而 smoke_all 并行跑放大了这个脆弱,误报成"蜂群坏"。**

## 二、真问题(3 个,按紧急度)

1. **🥇 测量会撒谎(最紧急)**:smoke_all 并行打满 provider → 健康蜂群被限流报"零产出"。
   只要它继续撒谎,那张"部门真值表"就不可信——你永远分不清"真坏"和"假阴性"。Deming:先修量具。
2. **🥈 Provider 层脆弱(根治)**:`active: deepseek` 直连有限流 + 本地 `LiteLLM:4444` 兜底没起。
   并发/突发一来就有蜂群栽。这是所有蜂群共担的系统性脆弱,不是某个部门的事。
3. **🥉 户部质量中等(次要,真问题但非"坏")**:单发 quality=2.83(非产品蜂群,本该像 libu/legal 金标 4.6+)。
   这是"提质"不是"修坏",优先级最低。

## 三、修复方案(分优先级)

### 🥇 Fix-1:让 smoke_all 别撒谎(消除假阴性)
- `scripts/smoke_all.py` 现用 `ThreadPoolExecutor` 全并发跑 21 蜂群 → 同时打爆 provider。
- 改:① 限并发(如 `max_workers=3`)或顺序跑;② 单蜂群失败时,若错误是限流/auth,标 `rate_limited` 而非 `error`(区分"真坏"与"被限流")。
- 验收:重跑 smoke_all,finance/product/ai_ops 等"假阴性"应转健康或标 rate_limited,不再误报"零产出"。

### 🥈 Fix-2:Provider 层加固(根治并发脆弱)
- **A(根治)**:拉起本地 `LiteLLM:4444` 代理 + `providers.yaml` `active` 切到 litellm profile。
  本地代理可做限流排队/多 key 轮换/统一 fallback,蜂群不再直挂 deepseek 限流。
  (检查为何 4444 没起:serve 脚本/进程,见 `scripts/` 里的 litellm 启动。)
- **B(兜底)**:deepseek provider 加**限流退避重试**(429/auth-like → 指数退避重试 N 次),
  让偶发限流自愈,而非一次失败=零产出。
- 验收:并发跑 10 个蜂群,无一因限流零产出。

### 🥉 Fix-3:户部质量 2.83→金标(次要)
- 单发跑一次,看 6 字段哪维弱(可执行性?数据勾稽?)、qa hard_checks 哪条 FAIL。
- 大概率与 libu/pack_rd 同类(软分/某硬核查),照已修范式调。**非紧急,排在前两个之后。**

## 四、最优先的一个动作
**先拉起本地 LiteLLM:4444**(Fix-2A 的第一步)——它一起来,deepseek 限流的脆弱立刻被本地代理缓冲,
smoke_all 假阴性大概率自愈。一个动作同时缓解问题 1 和 2。

## 五、顶尖大神判断
**别修户部——它没坏。** 真正要修的是「让你以为它坏了的那个量具」和「让它在并发下会栽的那层 provider」。
这一程最大的价值:差点去修一个健康的部门,被数据拦下了。**先修量具,再加固地基,户部提质排最后。**
