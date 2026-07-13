import { fileURLToPath } from 'node:url'

export const meta = {
  name: 'pack-rd-cost-split',
  description: 'pack_rd 成本拆分: 确定性真闸+真值锚+归因+串行重启屏障 (会审 v3)',
  phases: [
    { title: 'Baseline', detail: '确认recon事实 + 历史run取基线 + blind_rate基线' },
    { title: 'Falsify', detail: '证伪成本假边, 定 move-vs-add' },
    { title: 'Implement', detail: '结构化精算 + Python真闸(复用pack_rd_check.py)' },
    { title: 'Static', detail: 'import冒烟 + DAG无断边 + validator单测(含3.2V/投毒标定)' },
    { title: 'Restart', detail: '串行重启后端一次 + 健康门(收回重启权)' },
    { title: 'Validate', detail: '多规格×采样 POOL=2分批 + 真值锚 + 归因' },
    { title: 'Fix', detail: '按 upstreamClean 分流, 价错不喂回' },
    { title: 'Review', detail: 'code-reviewer 读真 diff (铁律4)' },
    { title: 'Synthesize', detail: '摘要 + commit + 单向门切割' },
  ],
}

// Resolve from this workflow file, never from the caller cwd or a sibling checkout.
const REPO = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')

// ── 已由 Recon 地基探测查实并写死 (GO), 不再重探 ──
const RUN_CMD = `python scripts/run_flow.py config/flow_pack_rd.yaml "<工单文本>"` // CLI; 产物落 data/default/runs/<run_id>/
const PRODUCT_DIR = `${REPO}/data/default/runs`                                   // step_N_*.json / final_output.json / run_meta.json(quality_score)
const PRICE_SRC = `${REPO}/knowledge/battery_prices.yaml`                          // cell_price_benchmark.by_chemistry.price_per_ah(¥/Ah) + bom_components.items; 按化学体系 join cell_library.json
const PHYS_LIB = `${REPO}/config/eval/cell_library.json`                          // 197芯物理真值(含 voltage_v, 无价)
const EXISTING_JUDGE = `${REPO}/scripts/pack_rd_check.py`                          // 已存在的代码真尺(三态 PASS/FAIL/UNKNOWN), 复用别重写
const SERVE = `bash scripts/serve-dev.sh`                                         // 后端 :8081 经 LiteLLM :4444; 改后端须重启

// 验收: 锚 spec 字符串真值(非 agent 自填). cellCount 不写死(随化学体系变), 由能量等式用真电压兜
const SPECS = [
  { id: '12V/1100Wh 低温(-20℃)', nominalV: 12, targetWh: 1100 },
  { id: '24V/2200Wh 常温',       nominalV: 24, targetWh: 2200 },
  { id: '48V/5000Wh 低温(-20℃)', nominalV: 48, targetWh: 5000 },
]
const SAMPLES = 2
const POOL = 2 // 并发上限(Charity: 削 6×150 洪峰)

phase('Baseline')
const baseline = await agent(
  `仓库 ${REPO}. 只读. 确认 Recon 已查实的事实仍成立 + 取改前基线(用历史 run, 别新跑蜂群):\n` +
  `1) 确认 ${PRICE_SRC} 含 cell_price_benchmark.by_chemistry.price_per_ah 与 bom_components; ${PHYS_LIB} 含 voltage_v 无 price; ${EXISTING_JUDGE} 存在.\n` +
  `2) 在 ${PRODUCT_DIR} 选最近一个完整 pack_rd run 作改前基线, 读其 run_meta.json/step_14 QA, 报告 baselineC1(预期FAIL)/baselineQuality(预期<=3)/baselineRunId.\n` +
  `3) blind_rate 基线(Charity): 对 ${PRODUCT_DIR} 下历史 pack_rd run 批量跑"抽取器", 统计 cell_engineer 速查表抽不到串并数 / cross_module 抽不到⚠️ 的比例. 这是和 quality 同级的一等指标, 解析失败=红灯非空值.`,
  { phase: 'Baseline', schema: { type:'object', additionalProperties:false,
    required:['factsOk','baselineC1','baselineQuality','baselineRunId','blindRate','notes'],
    properties:{ factsOk:{type:'boolean'}, baselineC1:{type:'string'}, baselineQuality:{type:'number'},
      baselineRunId:{type:'string'}, blindRate:{type:'string'}, notes:{type:'string'} } } },
)

phase('Falsify')
const falsify = await agent(
  `仓库 ${REPO}. 证伪"成本依赖"假边再定 move-vs-add (张小龙/Bezos).\n` +
  `静态读 runtime_prompts/{supply_chain_feasibility,cell_engineer,bms_hw_engineer}/*.md + yaml required_sections, 判断它们是否真消费 presale 的"具体BOM数字"(而非只消费"成本量级感觉").\n` +
  `静态不确定就 git 临时把 presale 改"只出¥/Wh量级不出BOM"(不加节点)跑一次 12V/1100Wh, 比对 cell/supply/bms 的 C2-C6 是否退化, 跑完 git checkout 还原(还原失败要明确报警, 别留脏区).\n` +
  `产出 edgeReal + recommendedShape(move/add) + 证据.`,
  { phase: 'Falsify', schema: { type:'object', additionalProperties:false, required:['edgeReal','recommendedShape','evidence'],
    properties:{ edgeReal:{type:'boolean'}, recommendedShape:{type:'string',enum:['move','add']}, evidence:{type:'string'} } } },
)

const CHANGESET = `
仓库 ${REPO} (后端 jiqun). 动手前读该仓 AGENTS.md+CLAUDE.md. 只改 pack_rd, 禁碰其它蜂群.
架构形态(Falsify): ${falsify?.recommendedShape} — ${falsify?.evidence}

== 铁律(会审): 算术不许 LLM 自评. 精算只"选数", Python "验数". 电压不许硬编. 真值锚 spec 不锚 agent. ==

== A. 精算职责 (按形态 move 或 add) ==
- move: presale 从 step_1 挪到 process_test_summary 后做精算, 删早期成本边, 复用同 id/prompt_key/QA白名单, 净负行数(铁律3).
- add: presale 留前改粗估(只¥/Wh量级不进C1), 新增 final_cost_reconciliation(depends cell_engineer/bms_summary/process_test_summary, 排结构后).
- 两形态精算都额外输出 fenced JSON: { cell_model, chemistry, cell_capacity_ah, cell_nominal_v(填库真值), series_S, parallel_P,
  cell_weight_g, cell_unit_price, price_source, bms_price, structure_price, c_rate, bom_total }.

== B. src/pack_rd_cost_validator.py 已建并测过(pytest 5/5 green, 见 git diff) — Implement 禁重写覆盖, 只需复用它 + 接进 flow_engine business_step. 已有契约(精算 fenced JSON 必须吐齐这些字段才能喂闸): ==
validate_bom(d, phys_lib, price_data, spec_truth) -> {c1,c7,priceTruth,specTruth,deviations,notes} (已实现, 真电压/真值锚spec/化学体系join价 全部就位)
  cell = phys_lib[d.cell_model]                          # KeyError→FAIL, 禁静默回退(铁律2)
  v = cell["voltage_v"]                                   # 真电压, 不许 ×3.7 硬编
  assert abs(d.cell_nominal_v - v) <= 0.05               # JSON↔库化学一致, 防JSON/散文双套数
  energy = d.cell_capacity_ah * d.series_S * d.parallel_P * v
  # 锚 spec 真值(Deming): 不信 agent 自填 target_wh
  specTruth = (abs(energy - spec_truth.targetWh)/spec_truth.targetWh <= 0.05)
            and (abs(d.series_S * v - spec_truth.nominalV)/spec_truth.nominalV <= 0.08)
  current = d.c_rate * d.parallel_P * d.cell_capacity_ah  # BMS阈值须引用
  weight_ok = d.cell_weight_g*d.series_S*d.parallel_P <= (整包上限)*0.80
  # 价真值: 按 chemistry join ${PRICE_SRC}, cell_unit_price ≈ cell_capacity_ah × by_chemistry[chem].price_per_ah
  priceTruth = cell_model 在库 and |cell_unit_price - cap×price_per_ah|/真值 <= 0.10
  bomΣ = series_S*parallel_P*cell_unit_price + bms_price + structure_price ≈ bom_total (<=5%)
  c1 = energy/current/weight 三等式 + bomΣ 全过; c7 = 电芯总数=S×P 与需求一致
  抽不出字段 → 标 UNKNOWN 不假装 PASS(抄 pack_rd_check.py 纪律)
配 pytest tests/test_pack_rd_cost_validator.py 回归(铁律4):
  - 3.2V LFP 自洽样本(4S18P 5Ah=1152Wh) → c1 PASS (现状 ×3.7 会假FAIL)
  - LFP型号但 JSON 标 3.7V 凑能量 → c1 FAIL
  - 投毒标定: 12V规格喂 target_wh=1500(内部自洽但违 spec) → specTruth FAIL (Deming校尺)
  - 单价砍半凑Σ → priceTruth FAIL

== C. 三处 ×3.7 一起改(铁律2 一张表) ==
src/prompts_qa_domain.py C1(line~24) 能量等式 + C7(line~56) + change-set 里的电压, 全改"查 cell_library voltage_v 真值", 不留任一处硬编 3.7.

== D. flow_engine business_step 接闸 ==
精算后插 no-LLM business_step 解析 fenced JSON 调 validate_bom, verdict 写 run_meta + final_output["系统BOM汇总"]末尾. expert_review_gate维度④/qa C1 读机器 verdict.

== E. prompts ==
精算 prompt 要求先选真器件(化学体系)+真单价(注来源)+填库真电压再算; pack_summary 系统BOM汇总原样引用精算禁重算;
价来源缺[来源:]即 output_rules 硬阻断回退 supply_chain(非软封顶). add 形态白名单 += final_cost_reconciliation.
`.trim()

phase('Implement')
const IMPL_SCHEMA = { type:'object', additionalProperties:false, required:['shape','filesChanged','validatorPath','diffStat','selfCheck'],
  properties:{ shape:{type:'string'}, filesChanged:{type:'array',items:{type:'string'}}, validatorPath:{type:'string'}, diffStat:{type:'string'}, selfCheck:{type:'string'} } }
const implBrief = (extra) => `你是后端实现工程师, 严格按 change-set 改, 不自由发挥.\n${CHANGESET}\n\n${extra||''}\n返回 shape/改了哪些文件/validator路径/git diff --stat/自检(python导入无错, yaml可加载, validator pytest 全过含3.2V与投毒标定).`
let impl = await agent(implBrief(), { phase:'Implement', schema:IMPL_SCHEMA })

const VAL_SCHEMA = { type:'object', additionalProperties:false,
  required:['spec','c1Pass','c7Pass','priceTruthPass','specTruthPass','quality','cellCount','chemistry','bomTotal','cellSeriesParallel','finalReconSP','upstreamClean','blindHit','crossCheckerFlags','restartEpoch','hardCheckNotes','runRef'],
  properties:{ spec:{type:'string'}, c1Pass:{type:'boolean'}, c7Pass:{type:'boolean'}, priceTruthPass:{type:'boolean'}, specTruthPass:{type:'boolean'},
    quality:{type:'number'}, cellCount:{type:'number'}, chemistry:{type:'string'}, bomTotal:{type:'string'},
    cellSeriesParallel:{type:'string'}, finalReconSP:{type:'string'}, upstreamClean:{type:'boolean'}, blindHit:{type:'boolean'},
    crossCheckerFlags:{type:'string'}, restartEpoch:{type:'number'}, hardCheckNotes:{type:'string'}, runRef:{type:'string'} } }

const isPass = (r) => r && r.c1Pass && r.c7Pass && r.priceTruthPass && r.specTruthPass && r.quality >= 3.8
const runOne = (spec, i, epoch) => agent(
  `仓库 ${REPO}. 后端已由 Restart 屏障重启就绪(epoch=${epoch}); 禁重启/禁改源码, 只读跑.\n` +
  `跑 pack_rd "${spec.id}" 采样#${i} (命令 ${RUN_CMD}; 产物 ${PRODUCT_DIR}/<run_id>/). spec 真值锚: nominalV=${spec.nominalV}, targetWh=${spec.targetWh}.\n` +
  `真闸: c1Pass/c7Pass/priceTruthPass/specTruthPass 一律读 Python validator 机器 verdict(电压取库真值非3.7; 价按化学体系 join ${PRICE_SRC}), 不信 LLM 自评. chemistry 报实际化学体系.\n` +
  `归因(Charity): 从落盘抽 cell_engineer 速查表"串×并"(cellSeriesParallel) 与精算实际"串×并"(finalReconSP), 逐位核对+C7总数; 不一致 upstreamClean=false 且 hardCheckNotes 首行写 DRIFT@cell_engineer→final_recon. 抽 cross_module ⚠️(crossCheckerFlags). 任一抽取器空返回 blindHit=true(非静默空值). restartEpoch 回填 ${epoch}.`,
  { phase:'Validate', label:`val:${spec.nominalV}V#${i}`, schema:VAL_SCHEMA })

const restartBarrier = (epoch) => agent(
  `仓库 ${REPO}. 串行重启后端恰好一次(收回重启权, Charity): 只读取受管 runtime identity 中经 start_ticks/cwd/PGID 核验的后端进程并精确 TERM→超时 KILL，禁止按进程名批量杀进程; ` +
  `nohup ${SERVE} > /tmp/jiqun-dev-${epoch}.log 2>&1 & disown; 轮询 http://127.0.0.1:8081/health 直到 200(<=60s)且 :4444 可达, 再 ready:true. 不 ready 不得进 Validate.`,
  { phase:'Restart', label:`restart:e${epoch}`, schema:{ type:'object', additionalProperties:false, required:['ready'], properties:{ ready:{type:'boolean'} } } })

let results = []
for (let attempt = 1; attempt <= 2; attempt++) {
  phase('Static')
  const statics = await parallel([
    () => agent(`仓库 ${REPO}. python 导入 src.prompts_pack_rd + yaml.safe_load config/flow_pack_rd.yaml 无错; pytest tests/test_pack_rd_cost_validator.py 全过(必须含 3.2V LFP→PASS、JSON标3.7V→FAIL、投毒target_wh=1500→specTruth FAIL、砍价→priceTruth FAIL 四条). 返回 pass+细节.`,
      { phase:'Static', label:'static:import', schema:{ type:'object', additionalProperties:false, required:['pass','detail'], properties:{ pass:{type:'boolean'}, detail:{type:'string'} } } }),
    () => agent(`仓库 ${REPO}. 校验 config/flow_pack_rd.yaml DAG 无断边; 精算 step 与 business_step 闸接对; final_output 仍 11 字段(C4); grep 确认全仓无残留硬编 ×3.7(三处都改了). 返回 pass+清单.`,
      { phase:'Static', label:'static:dag', schema:{ type:'object', additionalProperties:false, required:['pass','detail'], properties:{ pass:{type:'boolean'}, detail:{type:'string'} } } }),
  ])
  const sFail = statics.filter(Boolean).filter(s => !s.pass)
  if (sFail.length) { log(`Static第${attempt}轮失败回修`); impl = await agent(implBrief(`静态失败:\n${sFail.map(s=>s.detail).join('\n')}`), { phase:'Implement', schema:IMPL_SCHEMA }); continue }

  phase('Restart')
  const rb = await restartBarrier(attempt)
  if (!rb || !rb.ready) { log('后端未就绪, 中止本轮'); if (attempt === 2) break; continue }

  phase('Validate')
  const jobs = []
  for (const spec of SPECS) for (let i = 1; i <= SAMPLES; i++) jobs.push({ spec, i })
  results = []
  for (let k = 0; k < jobs.length; k += POOL) { // POOL=2 分批, 不一次全发
    const batch = jobs.slice(k, k + POOL).map(j => () => runOne(j.spec, j.i, attempt))
    results.push(...(await parallel(batch)).filter(Boolean))
  }
  // 按规格独立断言(Deming): 每个规格至少 1 采样过, 禁单一门槛汇总掩盖难规格
  const bySpec = SPECS.every(s => results.filter(r => r.spec === s.id).some(isPass))
  const passN = results.filter(isPass).length
  log(`Validate第${attempt}轮: ${passN}/${results.length} 过, 每规格都过=${bySpec}`)
  if (bySpec && passN >= results.length - 1) break
  if (attempt === 2) { log('两轮未达分布门槛, 进 Review 让人判'); break }

  phase('Fix')
  const fails = results.filter(r => !isPass(r))
  const drift = fails.filter(r => r.upstreamClean === false)
  const priceFail = fails.filter(r => r.priceTruthPass === false)
  const specFail = fails.filter(r => r.specTruthPass === false)
  const blind = fails.filter(r => r.blindHit === true)
  log(`回修: ${fails.length}失败 (DRIFT${drift.length}/价${priceFail.length}/spec${specFail.length}/盲${blind.length})`)
  impl = await agent(implBrief(
    `Validate未达门槛.\n` +
    (drift.length ? `上游串并漂移→改 cell_engineer 速查表SSOT(别逼精算圆错输入):\n${drift.map(r=>r.hardCheckNotes).join('\n')}\n` : '') +
    (priceFail.length ? `价真值FAIL→精算改选真器件/真单价(注来源), 禁改数字凑Σ(不喂回具体残差防过拟合).\n` : '') +
    (specFail.length ? `spec真值FAIL→精算偏离需求(targetWh/电压), 重新按 spec 选串并与化学体系.\n` : '') +
    (blind.length ? `抽取器空返回→cell_engineer/cross_module 输出格式漂移, 修 prompt 锁表格格式(blind_rate 是红灯).\n` : '')),
    { phase:'Implement', schema:IMPL_SCHEMA })
}

phase('Review')
const review = await agent(
  `读 ${REPO} 真实 git diff. 高危(铁律4独立会审): 改冻结产线flow + 加确定性闸 + 改裁决数字.\n` +
  `重点: (1)算术真由 validator 判, 没退回 LLM自评; (2)电压取库真值, 全仓无残留×3.7(三处都改); (3)真值锚 spec 非 agent自填 target_wh; (4)价真值闸独立于被测 agent 且按化学体系 join 对文件; (5)重启权收归串行屏障, runOne无重启; (6)move/add 与 Falsify 证据一致无僵尸旁路(铁律3); (7)C4仍11字段; (8)DRIFT分流改对对象无静默回退(铁律2). 给 CRITICAL/HIGH.`,
  { phase:'Review', agentType:'code-reviewer', schema:{ type:'object', additionalProperties:false, required:['verdict','critical','high','notes'],
    properties:{ verdict:{type:'string'}, critical:{type:'array',items:{type:'string'}}, high:{type:'array',items:{type:'string'}}, notes:{type:'string'} } } })

phase('Synthesize')
const passNf = results.filter(isPass).length
const report = await agent(
  `综合最终交付报告(中文). 形态:${impl?.shape} 过:${passNf}/${results.length} 会审:${JSON.stringify(review)} ` +
  `基线:C1=${baseline?.baselineC1}/q=${baseline?.baselineQuality}/blind_rate=${baseline?.blindRate}\n样本:${JSON.stringify(results)}\n` +
  `给: (1)改动摘要 (2)before/after 分布实测(C1/价真值/spec真值/quality/blind_rate, 系统性修好非单点) (3)CRITICAL是否清零 ` +
  `(4)conventional commit (5)单向门切割: 本 PR 只到"C1主库稳定回归", 工部解冻+前端接 LiveFeasibilityPanel 必须另开 PR, 列解冻前置.`,
  { phase:'Synthesize' })
log(report)

return { baseline, falsify, impl, results, review, report }
