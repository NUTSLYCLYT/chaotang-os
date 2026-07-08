# 朝堂蜂群测试套件 · 运行手册

> 目标系统：`/home/ubuntu/workspace/chaotang-web-lyt`（Next.js 16）。
> 后端 `jiqun_ai` 在 `http://127.0.0.1:8081`，前端 dev 在 `http://localhost:3002`。
> 本套件评测的是**蜂群（11 部 Tier-0 agent）的真实能力**，不是 UI。

---

## 0. 一句话目的

给"陛下"一个可复现、可解释、抗污染的判断：**这套蜂群现在到底好不好用、可不可信、稳不稳、值不值**——并把已知的管路缺陷标清楚，避免把"假数据/卡死/旁路"误读成"能力强/弱"。

---

## 1. 组成（每个脚本是什么）

所有中间产物都落在本目录 `tests/swarm-eval/` 下，脚本间通过**统一的 JSON 文件格式**串联（见 §6 契约）。

| 文件 / 脚本 | 角色 | 输入 → 输出 |
|---|---|---|
| `battery.json` | **题库**。11 部 × 2 模式（single 快档 / deep 三院议事）= 22 条任务，每条带 `command`、`expectDims`、`deptCode` | 静态数据，被 `run-eval` 读取 |
| `run-eval.mjs` | **执行器**。逐条打真实端点，落 `results/<id>__<mode>.json` | `battery.json` → `results/*.json` |
| `judge.mjs` | **评分器**。用 LLM judge（或人工）按 5 维给分，落 `scores/<id>__<mode>.json` | `results/*.json` → `scores/*.json` |
| `scorecard.mjs` | **汇总**。按部门均分 / 协作增益 / 门下误准误驳 / 时延成本 / 卡死率 / 安全结论 | `scores/*.json` + `results/*.json` → `scorecard.md` |
| `load-probe.mjs` | **压测**。并发打 `agents/run` + 轮询 `agents/status`，量吞吐 / 时延分布 / **卡死率** | 网络 → 控制台 + 可选 json |
| `security-e2e/*.spec.ts` | **Playwright 安全 E2E**。鉴权门、越权、预算硬限、注入面 | 浏览器 → playwright 报告 |

> 脚本均为纯 Node ESM（`.mjs`），用全局 `fetch`（Node 18+），无第三方依赖。每个支持 `--dry-run`（不打网络，用内置样例走通流程）。环境不可达/缺 token → 打印清晰指引并**非 0 退出**（绝不假装成功）。

---

## 2. 真实 agent 代号（不要臆造）

SoT 是 `src/lib/contracts/agent.ts` 的 `AGENT_META`。11 个 Tier-0 `AgentCode`：

| `agentCode` | 部门 | 层级 | 已接真实数据 |
|---|---|---|---|
| `prime_minister` | 丞相 · 中枢编排 | core | ✅ |
| `scribe` | 史官 · 记忆审计 | core | ✅ |
| `li_bu` | 吏部 · 人力组织 | ministry | ❌ |
| `hu_bu` | 户部 · 金融投资 | ministry | ✅ |
| `li_bu_rites` | 礼部 · 品牌营销 | ministry | ✅ |
| `bing_bu` | 兵部 · 竞品战略 | ministry | ❌ |
| `xing_bu` | 刑部 · 制度风控 | ministry | ❌ |
| `gong_bu` | 工部 · 产品技术 | ministry | ✅ |
| `qin_tian_jian` | 钦天监 · 未来推演 | special_bureau | ✅ |
| `jin_yi_wei` | 锦衣卫 · 全球情报 | special_bureau | ✅ |
| `tai_yi_yuan` | 太医院 · 健康管理 | special_bureau | ❌ |

`realDataConnected:false` 的部（吏部/兵部/刑部/太医院）评测时**别用 accuracy/traceability 苛求外部事实**——它们本就跑 baseline 置信度。

---

## 3. 能力端点（真实契约，已核实）

| 端点 | 方法 | body | 说明 |
|---|---|---|---|
| `/api/governance/deliberate` | POST | `{ command:string(≥5字), constitutions? }` | **推荐主路径**。三院议事 JSON。返回 `{ zhongshu, menxia:{verdict:'准'\|'驳'\|'再议'}, shangshu?:{steps} }`。`menxia.verdict` 是关键判定信号 |
| `/api/orchestration/run` | POST | `{ command, constitutions?, sessionId?, taskId?, petitionId? }` | 三院议事 SSE 流。事件序列：`retrieve → zhongshu → menxia → shangshu → persist → pipeline_done` |
| `/api/agents/run` | POST | `{ taskId, agentCode:<ZAgentCode>, goal? }` | 单 agent 快档。**立即返回 201** `{success,data:{runId}}`，真实执行 fire-and-forget。⚠️ 依赖 TURSO DB；dev 无 `TURSO_DB_URL` 时返 **503 `db_insert_failed`**（脚本必须容错） |
| `/api/agents/status` | GET | — | 每 agent 最新 run 状态 |
| `/api/agents/events` | GET | — | SSE，2s 轮询 |

所有端点需会话 cookie `courtos.access_token`（缺 → 401）。

---

## 4. 前置条件

### ① 真实会话 token（评测的硬前置）

会话来自 cookie `courtos.access_token`，是一个 JWT（后端仅解码、不验签）。payload 形状：
`{ user_id, username, tenant_slug, role:'user'|'admin', exp:<ISO字符串> }`。

两种取法（脚本都支持）：

```bash
# 方式一（推荐 · 真实用户）：浏览器登录 http://localhost:3002 后，
# DevTools → Application → Cookies → 复制 courtos.access_token 的值
export COURTOS_TOKEN='eyJ...'

# 方式二（仅冒烟 · 合成 dev token）：脚本加 --dev-token 自合成
#   header {alg:none} . payload {user_id:'eval-user',role:'admin',tenant_slug:'eval',exp:<未来ISO>} . sig
#   仅用于打通链路，不代表真实用户、不要用于能力结论
node run-eval.mjs --dev-token --dry-run
```

> 绝不硬编码密钥。`COURTOS_TOKEN` 优先；未设且未加 `--dev-token` → 脚本报错退出并给指引。

### ② 真实能力评测的额外依赖

- 后端 `jiqun_ai` 的 `/consult`（或 deliberate→consult）链路必须**真的通**（LLM 可达）。
- **LLM judge key**：`judge.mjs` 需要评审模型的 key，例如 `export JUDGE_API_KEY=...`（无 key 时退化为 `--judge human`，留空 `dims` 待人工填）。

### ③ `agents/run` / `load-probe` 的额外依赖

- 这条路依赖 **TURSO**。dev server 未配 `TURSO_DB_URL`（+ 可能的 `TURSO_AUTH_TOKEN`）时，`agents/run` 返 503 `db_insert_failed`。
- 没有 TURSO 就**别跑 `load-probe`**（除非只想看 503 容错），它的"卡死率"指标需要 run 真的写库才有意义。

---

## 5. 一步步命令

> 全部从本目录执行：`cd /home/ubuntu/workspace/chaotang-web-lyt/tests/swarm-eval`

```bash
# ── A. dry-run 冒烟（不打网络，验证脚本与文件契约串得通）──
node run-eval.mjs --dry-run          # 用内置样例写 results/*.json
node judge.mjs   --dry-run           # 用样例 results 写 scores/*.json
node scorecard.mjs --dry-run         # 汇总成 scorecard.md

# ── B. 真实评测（需 §4① + §4②）──
export COURTOS_TOKEN='eyJ...'        # 真实会话
node run-eval.mjs                    # 默认走 /api/governance/deliberate（deep）+ agents/run（single）
#   只跑某模式： --mode deep | --mode single
#   只跑某部：   --only hu_bu,gong_bu
export JUDGE_API_KEY='...'
node judge.mjs                       # LLM 评 5 维 → scores/*.json
#   人工评：   node judge.mjs --judge human
node scorecard.mjs                   # → scorecard.md（最终交付物）

# ── C. 压测（需 §4③ TURSO）──
node load-probe.mjs --concurrency 10 --total 100 --agent prime_minister
#   产出：吞吐 / P50/P95 时延 / 卡死率（status 永久 running 的占比）

# ── D. Playwright 安全 E2E ──
#   在仓根跑（双门鉴权：cookie courtos.access_token + localStorage courtos.auth）
cd /home/ubuntu/workspace/chaotang-web-lyt
npx playwright test tests/swarm-eval/security-e2e/
```

---

## 6. 中间产物文件格式（跨脚本契约 · 务必统一）

```jsonc
// battery.json
{ "version": 1, "tasks": [
  { "id":"hu_bu-valuation", "dept":"户部", "deptCode":"hu_bu",
    "mode":"deep", "command":"对英伟达做 DCF 估值并给买/持/卖评级",
    "expectDims":["accuracy","traceability","actionability"], "notes":"..." }
] }  // 11 部 × 2 模式 = 22 条

// results/<id>__<mode>.json
{ "id","dept","mode","command",
  "ok":true, "httpStatus":200,
  "output":"<string|object>",         // deliberate 返 object / agents/run 返 {runId}
  "verdict":"准|驳|再议",              // 仅 deep（门下信号）
  "latencyMs":1234, "error":null }

// scores/<id>__<mode>.json
{ "id","mode",
  "dims":{ "relevance":4,"accuracy":4,"completeness":3,"actionability":4,"traceability":2 }, // 各 1-5
  "weightedAvg":3.4, "notes":"...", "judge":"llm|human" }

// scorecard.md —— 人读汇总
```

**评分门槛**：`accuracy` 或 `traceability` 任一 **≤2 → 该任务"不合格"**；其余 `weightedAvg ≥3.5`="可用"、`≥4.2`="好用"。

---

## 7. ⚠️ 已知管路缺陷（必读 · 不读会污染结论）

这些是**当前代码现实**，会让评分失真。脚本与解读必须把它们隔离开：

1. **`/api/v1/swarms/*` 全是 MOCK** —— 静态假数据，**不要用它评能力**。能力只走 §3 的 governance / agents 端点。
2. **`agents/run` 是 fire-and-forget，会卡 `running`** —— 立即返 201，但真实执行经常**永久卡 running**。single 档的"完成"不可信，必须配 `status` 轮询 + 超时判卡死，别把卡死当"慢"。
3. **`agent_runs` 历史列未写入** —— 没有 per-user 历史。**别测"个性化 / 学习 / 偏好沉淀"**（史官 `scribe` 的这部分能力当前无数据支撑，会假性低分）。
4. **9 态状态机是死代码** —— `AgentState` 的 9 态（idle…archived）当前没有真正驱动流转。别基于"状态机正确性"打分。
5. **门下用 n-gram 子串匹配做判定** —— `menxia.verdict('准/驳/再议')` 是字符串子串匹配，不是语义判断，**误准、误驳都高**。`scorecard` 要单列"门下误准率 / 误驳率"，并人工抽检校准，别把它当 ground truth。
6. **`/api/chat` 旁路预算** —— 预算硬限若想测拦截，`/api/chat` 这条路**绕过预算**，会"拦不住"。安全 E2E 测预算硬限要走会计入预算的端点，别用 `/api/chat` 当反例。

> 结论纪律：凡命中上述缺陷的维度，`scorecard.md` 用脚注标注"受管路缺陷影响，非能力真实水平"。

---

## 8. 用户最关心的 8 维（优先级 · 高 → 低）

陛下视角的取舍顺序，`scorecard.md` 按此排版加权：

| # | 维度 | 含义 | 主要看 |
|---|---|---|---|
| 1 | **质量 / 可信** | 答得对不对、可不可追溯 | `accuracy` + `traceability`（任一 ≤2 直接不合格） |
| 2 | **速度 / 成本** | 多快、多少 token/钱 | `latencyMs` P50/P95、token 计费 |
| 3 | **稳定** | 会不会卡死 / 报错 | 卡死率、503 率、`ok` 比例 |
| 4 | **协作增益** | 三院议事 vs 单 agent 是否更优 | deep 比 single 的 `weightedAvg` 增量 |
| 5 | **安全** | 鉴权 / 越权 / 注入 / 预算 | security-e2e 结论 |
| 6 | **可控** | 门下准驳是否可信、能否复议 | 门下误准/误驳率、`再议` 处理 |

> 口诀：**质量/可信 > 速度/成本 > 稳定 > 协作增益 > 安全 > 可控**。冲突时高位优先：再快再便宜，accuracy/traceability 不达标也是"不合格"。

---

## 9. 故障速查

| 现象 | 原因 | 处置 |
|---|---|---|
| 401 | 缺 / 过期 `COURTOS_TOKEN` | 重取 cookie 或 `--dev-token` 冒烟 |
| 503 `db_insert_failed` | `agents/run` 缺 TURSO | 配 `TURSO_DB_URL`，或只跑 deep 主路径 |
| 单 agent 永久 `running` | fire-and-forget 卡死（§7.2） | 计入卡死率，不当超时 |
| 门下大面积 `准` 但答非所问 | n-gram 误准（§7.5） | 人工抽检校准，标注脚注 |
| judge 维度全空 | 无 `JUDGE_API_KEY` | `--judge human` 人工填 `scores/*.json` |
