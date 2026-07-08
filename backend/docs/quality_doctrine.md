# 蜂群质量铁律（7 轮大神会审沉淀 · 2026-06-04）

> 这不是建议，是用整场会话血换来的纪律。每条都来自代码级核验过的失败路径。
> 一句话总纲（Deming）：**一套只量自己的系统，最终收敛到自我感觉良好，不是收敛到真。**

## 第一性原则

**"完美" ≠ 全绿 / 全 4.5。"完美" = 一个诚实接到现实、且裁判权不在被告手里的最小系统。**
宁可 1 个蜂群有真实物理 golden + 真实结局回填，也不要 14 个蜂群对着占位符自评。

## 五条铁律（违反即"绿色仪表盘没接传感器"）

1. **裁判权归代码，不归 LLM**：凡可证伪的检查（勾稽/约束/数值/合规阈值），由确定性 Python 裁决并强制改判；LLM 只许抽取数字，不许做算术、不许给自己封顶。
   - ✅ 已落地：`flow_engine.py` _parse_qa_output 末段——读 `hard_checks`，C1/C2/C3 任一 FAIL → 强制 fail + 总分封顶≤3（不再靠 prompt 自觉）。
   - 待扩：把 C1 全量勾稽、C2 约束移进 `finance_validators.py`/`opc_constraint_check.py` 同款确定性核心。

2. **回归门不许挂自评分**：判断"这次改动有没有让蜂群变差"，必须用**独立判官（score_swarm + 真 golden）**的分，不能用蜂群自己打的 `qa_score`（= 让被告宣判自己没退化）。
   - 待修：`tests/golden/run_golden.py` 的门从 `qa_score>=qa_min` 改挂 `quality_eval_log.jsonl` 的独立分。前提：score_swarm 必须真跑过一次。

3. **尺子必须先刻上真刻度**：golden 的 `reference` 必须是**领域专家手填的物理/财务真值**（-30℃ 实测容量保持率、报价勾稽底线…），不是 `【需领域专家核填真值】` 占位、更不是 AI 代填（AI 代填=没填）。每种失败模式 ≥10 例，整体 30-50 起步（2 例是抽样噪声）。**这一步人替不了，AI 替不了。**

4. **闭环必须有外部真值锚**：真实业务结局（成交/退货/现场实测/复购）必须自动 settle 进 `param_ledger`，由 cron 跑、不靠人手敲 `--actual`。**"证伪率下降"在 actual 全 None 时分母为 0、算不出**——没有外部回填，飞轮是空转的壳。

5. **质量信号必须可观测、可校准**：每条 C1-C5 的 PASS/FAIL 连同 dept/command/输入指纹/chars/latency 作为**宽事件**落盘，能 `group by swarm where C3=FAIL`。否则某蜂群三个月后把"规格当实测"判 PASS（C3 漂移），你收不到任何信号，直到客户拿错误选型上门。
   - 🟡 半步：`hard_checks` 已随 qa_result 持久化；完整宽事件落盘待做。

## 治理纪律（防系统自我恭维）

- **考核分 ≠ 学习分**（Deming）：`gate_block_rates` 这类看板**绝不可拿去给 14 个蜂群排名**——一旦用于考核，下游会学"写得像过硬核查"而非"真过"，所有内部指标会一起朝"好看"漂移。
- **冻结扩张**：在第 1 个蜂群跑通"真 golden → 独立判官 → 真血回填"整圈之前，不新增蜂群、不批量刷分。
- **唯一可信的成功指标**：被真实结局证伪并改对的裁定条数（随时间上升）+ 独立判官分与人类专家分的相关性 ρ≥0.6。其余（QA 自评分、覆盖率、阻断率）一律是过程指标，不作结论。

## 当前状态（诚实台账）

| 铁律 | 状态 |
|---|---|
| 1 裁判权归代码 | ✅ 主路径已强制（C1/C2/C3）；待扩到全量 |
| 2 回归门挂独立判官 | ✅ run_golden 回归门改读 pack_rd_check 硬核查，qa_score 降级仅参考（2026-06-05）|
| 3 真 golden 刻度 | 🟡 pack_rd 1 个真的；12 个仍占位符——**等领域专家填** |
| 4 外部真血回填 | 🟡 truth_ledger 接住确定性判定；param_ledger actual 仍等真实结局 |
| 5 可观测宽事件 | 🟡 truth_ledger.health()=flywheel_health 已落地，宽事件待扩 |
| — deterministic-core | ✅ 唯一一致表扬处，已扩到 4 把真尺子 + 真值台账 |

## 真值台账 truth_ledger（2026-06-05 · 飞轮三问的统一答案）

> 一个 append-only 台账（`eval/truth_ledger.jsonl`）同时焊死飞轮三问，回归门只信它、不信自评分。

- **会复利**：4 把真尺子（pack_rd/quotation/sourcing/cell_library）判定 `record()` 进台账 → `gate()` 读它放行 → 回路闭合，非写入即丢。
- **燃料干净**：`record()` 用内容哈希幂等，同一判定只记一次，杜绝枚举/重放投毒。
- **能看见转**：`health()` 给 `flywheel_health`（确定性占比 / 通过率 / 各 swarm 明细），账面区分"在转/空转"。
- **铁律**：任何蜂群要宣称"质量达标"，必须在台账有**确定性 PASS** 判定；`gate()` 默认拒（无记录=不放行）。

### 台账通电实录（2026-06-05 · 第一组真血）

`scripts/seed_ledger.py` 用确定性检查器评判 `data/default/runs/` 里 30 个**历史真实蜂群输出**（非灌参考值、非自评分），首张诚实 flywheel_health：

| 指标 | 值 | 含义 |
|---|---|---|
| pass_rate | **0.261** | 判得动的里只 1/4 通过——真问题，不是优化对象 |
| blind_rate | **0.233** | 检查器抽不出的占比（指向 #8 LLM 抽取器） |
| pack_rd | 1✅ / 16❌ / 2❓ | PACK 历史输出大量违反硬约束 C1-C5 |
| sourcing | 0 / 0 / 5❓ | 输出全未引用库内型号（疑似臆造，全盲） |
| shiguan_archive | 5✅ / 1❌ | archive_check 抓到 1 个"全篇 0 来源标记"的不可追溯归档 |

**通电三处自我欺骗已挡**（dry-run 在写入前暴露）：① Stage Gate 被 PACK 检查器张冠李戴→剔除；
② 全 UNKNOWN 曾被判 PASS→三态收紧，抽不出绝不当通过；③ 靠"没提加热"被动翻 PASS→PASS 须实质正向验证。

### #8 extract/judge 分离（攻 blind_rate）

`src/llm_extract.py`：LLM **只抽数字**（电量/软包并联/总重），**判定永远归确定性代码**（935≤电量≤1265 这种比较绝不交给 LLM）。
`tests/test_llm_extract.py` 用 mock 注入证明：**LLM 喊"完美达标"+给超标数字，代码照判 FAIL**；中文数字"一千零五十瓦时"正则盲、LLM 不盲。`--llm` 开关在 pack_rd_check/seed_ledger，模型链路一通即生效降盲率。

### 检查器名册（确定性白名单 `_DETERMINISTIC`）

| 检查器 | 蜂群 | 可证伪锚 |
|---|---|---|
| `pack_rd_check` | PACK研发 | 硬约束 C1-C5（电量/软包并联/比能量勾稽…）|
| `quotation_real_score` | 报价 | 对照真实成交价 |
| `sourcing_check` | 电芯采购 | 对照真实电芯库 197 颗 |
| `archive_check` | 史馆归档 | 来源标注/结构/自检（无源条目=不可追溯）|
| `intel_check` | 锦衣卫情报 | 可信度分级/信源（**情报无源=谣言**）|
| `recruit_check` | 吏部招聘 | 硬性要求锚定（**淘汰不挂红线=黑箱**）|
| `forecast_check` | 钦天监预测 | **情景概率和≠100%=逻辑硬错** + 量化区间 |
| `forecast_backtest` | 钦天监预测 | 对照 realized 真实结局（数据门，回填即评分）|

新增检查器**必须**加入白名单，否则判定不计入 flywheel_health（2026-06-05 踩过此坑）。

### 源头鉴权 provenance（2026-06-05 · 飞轮第二问'燃料干净'在源头）

`seed_ledger` 查每个 run_id 是否在 `data/fengqun.db` 的 `tasks` 表里：
- `authenticated`🔒：数据库 + 文件系统两处都有 → 不可随意伪造的真血
- `orphan`⚠️：只在 runs/ 目录、数据库查不到 → 疑似投毒/测试残留
- health 输出 `authenticated_ratio`。**首次通电照出 authenticated_ratio=0.0（40 条全 orphan）**——
  当前真血全来自绕过 decree→task 管道的直跑测试。要让真血可信，蜂群须走正式管道留痕。

### 六蜂群通电全貌（2026-06-05）

`pass_rate 0.406 · blind_rate 0.2 · authenticated_ratio 0.0`（40 判定 / 6 检查器 / 全确定性）。
pack_rd 仍是重灾区（1✅/17❌），sourcing 新运行已引用真库电芯（3✅），其余四蜂群结构达标。
这张表第一次让**全部六个蜂群的质量在账面上可证伪、可对比、可溯源**。

## 大神会审：供应链+HR 顶尖公司重搭（2026-06-05 · 5大神一致裁决）

Bezos/Deming/张小龙/Karpathy/Majors **一致否决"加 agent/拆架构"**，改判核心病根：
**两个蜂群都缺"与现实世界的写回回路"——供应链不知真实成交价/交期/合格率，HR 不知人留没留下。**
账面已证（`authenticated_ratio=0.0`，89/89 orphan）：在回写率从 0 爬起来前，台账度量的是**修辞合规度，不是商业结局**。

**三条裁决（已落地）：**
1. **真值回写管道=唯一单向门**（Bezos）：`eval/sourcing_outcome.jsonl`（成交价/守约/来料合格率）+ `eval/hire_outcome.jsonl`（入职/90天留存/绩效），复用 `forecast_backtest` 的 predict→realize→compare 模具。**供应链真值=下单后现实发生了什么；HR 真值=人留下且绩效达标。**
2. **关掉两个变异源**（Deming/张小龙/Karpathy）：`supply_chain_check` C4 不再采信 virtual_inquirer 编的价（≤上限只判 UNKNOWN，只有真实成交价配 PASS）；`worst_swarm` 顶出局部灾难（pack_rd 0.962）。
3. **失败路径警钟**（Majors）：*flying with a fake horizon 比没仪表更危险*；记错东西的飞轮比没飞轮更危险。

**待续（需用户/流程）**：① 采购单关闭/offer 回填真实结局（飞轮燃料口已建，等灌料）；② inline 接地守卫（每步验真型号，需 flow_engine 改）；③ HR 主动寻才 agent（张小龙：寻才≠评估，正交于评估 flow）；④ 强制 `authenticated_ratio>0` 才放行。

## 第六铁律：检查器的假 FAIL 和假 PASS 一样毒（2026-06-05 · 救 worst_swarm 实录）

去救"最差蜂群 pack_rd（fail_rate 0.962）"，结果发现**那 96% 失败几乎全是裁判自己的 bug**：
- **C4 假阳性 30/30**：正则把"不需加热/取消加热回路/不额外加加热膜"的讨论，误判成"用了加热"。任务明说不需加热，蜂群越认真讨论越被误杀。
- **C1 张冠李戴**：`935-1265Wh` 硬编码自**单一** golden（PACK提示词 1100Wh 任务），却被 seed_ledger 套到 **30 个异构任务**（960Wh/5MWh…）。用一个任务的标准量所有任务。

**修法**：① C4 改三态，强偏 UNKNOWN——只在"集成/采用加热模块"强肯定且全文无否定才判 FAIL，信号矛盾→UNKNOWN 交 `--llm`。② C1 按**每个运行自己的任务**目标±15% 判，且只认带"总电量"标签的数（无标签→UNKNOWN，绝不从裸 Wh 瞎猜众数）。

**结果**：pack_rd 1✅/25❌（假象）→ 4✅/**1 真 FAIL**/23❓，fail_rate 0.962→0.2。`blind_rate` 诚实升至 0.371。

**铁律**：
1. **假 FAIL = 假 PASS**：一个误杀好输出的检查器，和一个放过坏输出的检查器，同样让台账撒谎；且假 FAIL 更阴——它让你去"修"一个本就没坏的蜂群。
2. **正则判长自由文本不可靠**（全步骤 vs final_output 能给出相反 C4 判定即铁证）：自然语言否定开放无穷（不额外加/缺少/若无…），whack-a-mole 修不完。可证伪≠正则；定论走 `--llm`（extract/judge 分离）。
3. **一把尺子只配量它被刻的那个任务**：硬编码阈值（935-1265）必须从任务动态导出，否则套到异构输入上必产假判。
4. **信号矛盾时判 UNKNOWN，不判 FAIL/PASS**：`blind_rate` 升高是诚实，不是退步——它如实说"这块我看不清,需要更强的眼睛"。
