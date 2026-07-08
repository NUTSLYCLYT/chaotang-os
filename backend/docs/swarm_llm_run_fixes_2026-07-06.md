# 蜂群 LLM 真跑通修复 + 工部/户部稳定化清单（2026-07-06）

> 背景：验证"上书房下旨 → 蜂群 → 回奏"能否用真 LLM 产高质量回奏。实跑（户部 `flow_finance` + 工部 `flow_pack_rd`，provider=deepseek）暴露并修掉两个真 bug，并落地第一个可靠性杠杆。

## 一、两个真 bug（"户部/工部零产出"真因）

### Bug 1 · litellm × python3.14 async worker 崩 → flow 静默退出【已修】
- **现象**：flow 跑到首个 LLM 调用后进程静默退出，无 step 输出，尾部只有 `Task was destroyed but it is pending / coroutine 'LoggingWorker._worker_loop' was never awaited`。
- **根因**：litellm 的 async `LoggingWorker` 在 py3.14 解释器关闭时抛未捕获异常。`.venv` 与 CLI 都是 py3.14.4，服务器进程同样中招。
- **修复**：`src/model_adapter.py` import litellm 后关掉一切异步日志回调（本仓只用同步 `litellm.completion`，不依赖回调）。`LITELLM_KEEP_CALLBACKS=1` 可恢复。**commit `85ced6b`**。
- **验证**：raw openai 客户端直连 deepseek 一直正常，证明是 litellm 层问题，非 key/网络。修后 `flow_finance` 端到端跑通。

### Bug 2 · 环境不 load .env → key 缺【已缓解，待真修】
- **现象**：`.env` 有 `DEEPSEEK_API_KEY`，但 `provider.py`/`model_adapter` 只读 `os.environ`，全仓无 `load_dotenv` → `get_active_provider` 判 `key就位: False`。
- **缓解**：`scripts/serve-dev.sh:4` 已 `set -a; . ./.env`，故经它启动的 :8081 服务有 key；CLI（`run_flow`）需手动 `export`。
- **待真修**：在启动处（`web/main.py` 或 `src/provider.py` 顶部）加一次 `load_dotenv()`，让所有入口（CLI/服务/测试）自动拿到 key，不再依赖 shell 手动 source。

## 二、效率/可靠性杠杆 ④ 限流退避【已落地】

- **动机**：工部 `flow_pack_rd` 18 步并发把 deepseek 压出多条 `RateLimitError(429)`；旧 retry 只认 502/503/timeout/connection，**不认 429** → 直接判死。
- **落地**（`src/model_adapter.py` retry 块）：可重试集合补 `429 / rate limit / rate_limit / too many requests / overloaded / 504`；退避从线性 5/10s 改**指数 2/4/8s(封顶30s)+抖动**，散开多步并发重试避免二次限流；`max_retries` 默认 4，可用 `LLM_MAX_RETRIES` 覆盖。

## 三、工部/户部：从"能跑"到"稳定高质量"最小改造清单（按性价比）

| # | 杠杆 | 现状 | 落点 | 状态 |
|---|---|---|---|---|
| ④ | 限流退避 | 429 不重试、线性退避 | `model_adapter` retry 块 | **已落地** |
| ① | 部门并行化 | L4 部门串行 for | `swarm_execution_loop._run_departments_cross_referenced`：锦衣卫先串行(喂后续)，其余部门 ThreadPool 并发(copy_context 保 ContextVar，`SWARM_DEPT_MAX_WORKERS` 默认6) | **已落地(实测 3.3×)** |
| ② | 真引擎缓存/幂等 | 无缓存,重跑全量重烧 | `real_department_engines._call_adapter_observed` 套 `direct_cache`；锦衣卫(实时情报)豁免，`SWARM_ENGINE_CACHE=0`/pytest 下自动关 | **已落地(热命中→0ms)** |
| ③ | 模型分档 | L4 立场恒用主力模型 | `_live_department_position` 接 `providers.yaml model_tiers`（仿 L3 strong/cheap） | 待办 |
| ⑤ | 补工部/户部真引擎 | pack_rd/finance 上书房链默认走规则模板；真引擎因输入契约不匹配未接 | 给 `gongbu_review_verdict`/`hubu_cashflow` 写结构化输入抽取器 | 进行中（feat/gongbu-verdict-into-memorial） |

### ①② 实测收益（2026-07-06，真 deepseek 调用）

| 杠杆 | 场景 | 改前 | 改后 | 收益 |
|---|---|---|---|---|
| ① 并行化 | 3 部门各 1 次真 LLM 立场 | 串行 15.3s | 并行 4.7s | **3.3×**（N 部门 ≈ N×，wall-clock≈单部门延迟） |
| ② 缓存 | 同任务重复调（2s 桩引擎） | 冷调 2.01s | 热命中 0ms | **重复命令外呼归零**，`_cache_hit=True` |
| ② 豁免 | 锦衣卫实时情报二次调 | — | 仍 2.00s | ✓ 实时情报不缓存，不返过期 |

组合：① 并行(更快) + ② 缓存(更省) + ④ 退避(更稳，① 加大并发→更多 429 被兜住)。一份被复盘/重跑的下旨，从"每次全量串行重烧"→"首次并行、之后秒回"。

## 四、实跑验证记录（真 LLM，非 mock）

- **户部 `flow_finance`**：deepseek 真调 6 次 + `deepseek-v4-flash` 做 QA 六维评分（total 3.0/B，C1数字勾稽 FAIL → `run_with_repair` 自动重做）。回奏含回收期 5.46 年 / IRR≈14.5% / 毛利率 90.2%（**算式可复算**）、风险分级+对冲、待补证清单（**未编数、诚实标未审计**）、签字闸 PENDING_HUMAN_SIGNOFF + 飞轮记录 + HTML 报告。
- **工部 `flow_pack_rd`**：7 位工程师真成品输出（电芯选型 IFR26650-LT3200 / 8S3P、BMS、结构热、通信 RS485、测试可靠性）+ 确定性闸 + 签字闸。1 步 `APIConnectionError` 靠 retry 恢复（即杠杆④要治的场景）。
- **前端上书房**：UI 对活后端完整加载，真实待裁项 + 诚实源标注（"产出引擎待接入·不冒充定论"）；"下旨→展开新回奏"UI 闭环仍差后端结构化 rows 对接（见 [[chaotang-huizou-chain-status]]）。

## 五、结论

引擎层通了：**修掉 litellm×3.14 + 补 key 后，工部/户部都能用真 LLM 产高质量回奏**；效率杠杆 **①并行化(实测3.3×) + ②缓存(热命中→0ms) + ④限流退避** 已落地。剩余：③模型分档（待办）、⑤补工部真引擎（进行中）、前端上书房"下旨→新回奏"UI 闭环（见 [[chaotang-huizou-chain-status]]）。
