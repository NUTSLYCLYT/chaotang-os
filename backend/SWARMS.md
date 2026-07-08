# 蜂群系统 · 开发与扩建指南 (SWARMS.md)

> 一个"蜂群"= 一条声明式 `flow_*.yaml`。引擎(`src/flow_engine.py`)是解释器,
> **加蜂群是加数据(YAML + prompts),不改引擎**。本文是给人和 AI 的标准作业流程。

---

## 1. 架构速览

```
需求 → 治理层(三省六部 11 大臣,调度/定调)
        → 业务蜂群(flow_*.yaml,实际干活)
        → 史官归档 · 锦衣卫情报 · 钦天监预测 · 太医体检(横切支撑)
```

- **蜂群注册表**:`config/swarm_orchestrator.yaml`(每个蜂群一行:`id / name / config / qa_version`)
- **蜂群定义**:`config/flow_<id>.yaml`(steps = 成员 agent;模型走 LiteLLM `:4000`)
- **蜂群提示词**:`src/prompts_<id>.py`(每个 step 的 system prompt + `PROMPT_MAP_<ID>`)
- **庄园编组**:`config/manor_groups.yaml`(11 大臣 → 5 组 → OpenClaw 网关)
- **复用包**:`config/presets.yaml`(工具 + 知识 bundle)

**prompt 解析顺序**(`flow_engine`):`runtime_prompts/<key>/` 4 文件 → 全局 `src.prompts.PROMPT_MAP`
→ step 的 `prompt_module` 里的任意 `PROMPT_MAP_*`(`_load_prompt_from_module` 自动发现,**无需中央注册**)。
`qa_tech_support` 是引擎特殊 QA step,无需 prompt_module。

---

## 2. 加一个蜂群(3 步)

### 方式 A:脚手架生成器(推荐)

```bash
python scripts/new_swarm.py \
  --id <swarm_id> --name "<中文名>" \
  --steps "sid1:成员名1:职责1;sid2:成员名2:职责2;..."
# 自动产出 flow_<id>.yaml + prompts_<id>.py(起步提示词)+ 注册一行(幂等防覆盖)
# 加 --no-qa 可不追加 qa_tech_support 收尾步
```

然后:**精修 `src/prompts_<id>.py` 的提示词**(生成器只接线,提示词内容由人写)。

### 方式 B:手写(参考 `config/flow_sourcing.yaml` + `src/prompts_sourcing.py`)

1. 写 `config/flow_<id>.yaml`:`flow_name / default_model / steps[] / output_fields`。
2. 写 `src/prompts_<id>.py`:每个 step 一个 `PROMPT_X` 常量 + `register_prompt(...)` + `PROMPT_MAP_<ID> = {step_id: PROMPT_X}`。
3. 在 `config/swarm_orchestrator.yaml` 的 `swarms:` 加一行。
4. 在 `config/advisor_protocols.yaml` 的 `swarms:` 加一行,声明 `profile / level / owner / genius_design`。

---

## 3. 验证(三层,分工明确)

| 层级 | 工具 | 性质 | 何时跑 | 费用 |
|------|------|------|--------|------|
| L1 结构 | `python scripts/validate_flows.py` | 静态确定性:YAML/注册/preset/prompt 可解析 + **大神协议门控** + **质量基线门控** | **每次改蜂群后必跑**(CI 强制,退出码 0=绿) | 零成本 |
| L1a 协议 | `python scripts/validate_advisor_protocols.py` | 只校验大神视角/天才建议/天才设计覆盖和签字边界 | 改顾问协议或新增 flow 时先跑 | 零成本 |
| L2 质量 | `python scripts/eval_ci.py` | LLM-as-judge:golden cases 评分 → 写 quality_baseline.json | **每周/发布前定期**,或修改 prompts 后主动触发 | 低成本(每蜂群约 5-10 次 LLM 调用) |
| L3 端到端 | `python scripts/test_swarms.py` | 真跑蜂群看输出/质量分 | 上线前人工验收 | 较贵 |

> 顺序:L1(秒级) → L2(分钟级) → L3(小时级)。L1 不绿不进 L2。

### quality_baseline.json 工作原理

```
eval_ci.py 定期跑 → scripts/golden_cases/<swarm>.json golden cases
                   → LLM 裁判打分(1-10分制)
                   → 写 scripts/golden_cases/quality_baseline.json

validate_flows.py 每次 CI 读 quality_baseline.json
  → 任意蜂群 quality_score < 7.0 → 退出码 1(红灯)
  → 全部 ≥ 7.0 → 绿灯
```

新增蜂群后必须同时建 `scripts/golden_cases/<swarm>.json`(至少 2 个案例),
并在发布前运行 `python scripts/eval_ci.py --swarm <id>` 生成初始基线。

### 大神协议工作原理

`config/advisor_protocols.yaml` 是所有蜂群的顾问和签核契约。每个 `flow_*.yaml`
必须有对应协议,并定义:

- `profile`:使用哪组顾问镜片,如销售售后、工程、财务、法务风险、治理。
- `level`:routine / substantial / design / irreversible,决定至少需要多少顾问。
- `owner`:朝堂部门归属,用于下一步派发和问责。
- `genius_design`:可执行的系统设计约束,不能只是口号。

全局输出契约要求每次实质判断至少给出 `warning / genius_advice / failure_path /
evidence_gap / confidence`;设计级任务还要给出 `genius_design`。大神意见只能作为
 advisory lens,不能替代证据、harness、golden cases 或人类签字。

触发报价、交期承诺、安全/性能承诺、合同/法务承诺、生产发布、客户外发、外部系统写入、
不可逆动作时,蜂群输出必须停在建议态,交由对应部门或真人签核。

---

## 4. YAML 层内建能力(无需改引擎)

### 4a. step 级别重试(retry)

```yaml
steps:
  - id: opc_leader
    retry:
      max_retries: 2      # 失败时最多重试 2 次
      delay: 3.0          # 首次重试等待秒数
      backoff: 2.0        # 指数退避倍数
      retry_on:           # 触发重试的条件
        - error           # 调用出错
        - linter_fail     # OutputLinter 校验失败
```

flow 级别可用 `default_retry:` 设置全局默认值,step 级别覆盖。

### 4b. step 级别断言(step_assertions)

```yaml
steps:
  - id: opc_leader
    assertions:
      post:
        - type: output_not_empty               # 输出不为空
        - type: contains_all                   # 必须包含这些词
          values: ["客户画像", "核心需求"]
          on_fail: hard_fail                   # hard_fail / retry / warn
        - type: min_word_count                 # 最少字数
          count: 100
          on_fail: retry                       # 字数不足时自动重试
        - type: no_forbidden_phrases           # 不能包含这些词
          values: ["抱歉我无法", "我不知道"]
          on_fail: warn
```

`on_fail` 三种策略:
- `hard_fail` — 中止整条 flow,抛异常(默认)
- `retry` — 触发该 step 的重试逻辑
- `warn` — 仅记录警告,继续执行

### 4c. 差异化模型 tier(providers.yaml)

```yaml
# config/providers.yaml
model_tiers:
  director:          # 推理/规划用高能模型
    model: deepseek-reasoner
    api_base: http://127.0.0.1:4000/v1
    api_key_env: LITELLM_PROXY_KEY
  worker:            # 执行/生成用快速模型
    model: deepseek-chat
    api_base: http://127.0.0.1:4000/v1
    api_key_env: LITELLM_PROXY_KEY
```

在 flow YAML 中引用:

```yaml
steps:
  - id: plan_step
    tier: director   # 用 director 模型，不硬编码 model 名
  - id: exec_step
    tier: worker     # 用 worker 模型
```

provider 切换(如换成 ollama)时,所有 tier 自动跟随,无需逐 step 修改。

---

## 5. 节拍时间(Takt Time)

```bash
python scripts/takt_time.py          # 最近 7 天各蜂群的真实采纳情况
python scripts/takt_time.py --days 30
```

**只有一个数字重要**:今天有多少个蜂群产出了被真实用户采纳的输出。
这个数字是扩建新蜂群的前提条件,而不是蜂群总数。

---

## 6. 当前蜂群清单(29 个)

**业务主线**:voice_sales · haolong · opc · product · quotation · storage_aftercare · sourcing · pack_rd · battery_stage_gate · finance · legal · xiaohongshu · ima · sdlc · requirements

**治理与质量**:court · evaluate · gongbu_review · shiguan_archive · ai_ops · medical · appointment

**演示与测试**:demo · demo_spawn · demo_spawn_bailian · kb_test · product_test · opc_multi_model_example · opc_no_knowledge

---

## 7. 引擎扩展指南(需要新 step 类型时)

`src/flow_engine.py` 当前架构为 6 层模块化设计,各层有对应独立模块:

| 层 | 职责 | 独立模块 |
|----|------|---------|
| L1 | 上下文预算 | `src/context_budget.py` |
| L3 | 步间断言 | `src/step_assertions.py` |
| L4 | 运行状态 | `src/run_state.py` |
| L5 | 差异化模型 | `src/model_tiering.py` |
| L6a | 输出校验 | `src/output_linter.py` |
| L6b | 安全拦截 | `src/guard_rails.py` |

**何时应该改引擎**:需要全新 step 类型(如并行 step、条件分支 step、人工审核 step)时。
**改引擎前必须**:先阅读各层独立模块的文档,评估是否能在 YAML 层解决;确认改动范围,补充对应模块的单元测试。

---

## 8. 工程规范

- 提示词遵循既有信条:**有依据才下结论、逐条标来源、输出结构化**(参考 `prompts_sourcing.py`)。
- 模型统一走 LiteLLM `http://127.0.0.1:4000/v1`(`default_api_key_env: LITELLM_PROXY_KEY`),不硬编码 key。
- 每个新蜂群上线前:**validate_flows 绿 + eval_ci 质量分 ≥ 7.0**,缺一不可。
- 先数节拍(takt_time.py),再谈扩建新蜂群。
