#!/usr/bin/env node
/**
 * verify-study-edict.mjs — REAL-backend Study Edict 契约门（anti-假闭合发布门）
 * ============================================================================
 *
 * 这个脚本直击**真实后端** `http://127.0.0.1:8081/api/chaotang/study/run`，
 * 绕过前端 Next BFF 代理（/api/court/chaotang/...）和任何 HTTP(S)_PROXY。
 *
 *   ⚠️ 直连真后端，不走任何代理：
 *   Node 18+/22 的全局 `fetch`（undici）默认**不读** HTTP_PROXY / HTTPS_PROXY 环境变量，
 *   只有显式 `setGlobalDispatcher(new ProxyAgent(...))` 才会走代理。本脚本**绝不**设置
 *   ProxyAgent，因此 `fetch(url)` 必然直连 127.0.0.1:8081，不会被路由到 127.0.0.1:7880。
 *   （即便环境里设了 http_proxy=http://127.0.0.1:7880，本脚本也不受影响。）
 *
 * 纯 JS（ESM），无任何 TS / zod import，可独立 `node scripts/verify-study-edict.mjs` 运行。
 * 契约形状的真相源是 `src/lib/contracts/study-edict.ts`（zod SoT，keystone 所建）——
 * 本脚本手写镜像同一形状做断言，地面真相对照：
 *   - dev/reference/artifacts/alignment-2026-06-08/real_dry_edict.json   (source_mode=MIXED, 无 run_adapter)
 *   - dev/reference/artifacts/alignment-2026-06-08/real_live_edict.json  (source_mode=LIVE_SWARM, 含 run_adapter)
 *
 * 退出码：全部通过 exit(0)；任一断言失败或网络错误 exit(1)。
 * 用法：
 *   JIQUN_ADMIN_TOKEN=... node scripts/verify-study-edict.mjs         # 仅 dry_run（30s 超时）
 *   COURT_TOKEN=... node scripts/verify-study-edict.mjs --live        # 额外跑 live（120s 超时）+ LIVE_SWARM 断言
 */

// ---------------------------------------------------------------------------
// 常量（与契约 SoT 镜像）
// ---------------------------------------------------------------------------

const BACKEND_URL = 'http://127.0.0.1:8081/api/chaotang/study/run';
const COMMAND = '判断 100MWh 冷库储能项目是否推进';

/** STUDY_SOURCE_MODES —— 镜像 study-edict.ts 的 z.enum，未知值必须判失败 */
const STUDY_SOURCE_MODES = ['LIVE', 'MIXED', 'FALLBACK', 'DEMO', 'LIVE_SWARM'];

/** edict 顶层必备 key（镜像 ZStudyEdict 的必填字段，run_adapter 为 live-only 可选） */
const REQUIRED_EDICT_KEYS = [
  'run_id',
  'source_mode',
  'title',
  'verdict',
  'summary',
  'departments',
  'evidence',
  'risks',
  'next_actions',
  'quality_gate',
  'created_at',
];

/** LaunchLoopCase 顶层必备 key（镜像 ZLaunchLoopCase） */
const REQUIRED_LAUNCH_LOOP_KEYS = [
  'case_id',
  'schemaVersion',
  'source',
  'sourceId',
  'title',
  'command',
  'owner',
  'targetDept',
  'evidenceIds',
  'evidence',
  'runId',
  'status',
  'sourceMode',
  'qualityGate',
  'nextAction',
  'archive',
  'learning',
  'createdAt',
  'updatedAt',
];

const DRY_TIMEOUT_MS = 30_000;
const LIVE_TIMEOUT_MS = 120_000;
const BACKEND_TOKEN = (process.env.JIQUN_ADMIN_TOKEN || process.env.COURT_TOKEN || '').trim();

// ---------------------------------------------------------------------------
// 断言收集器（不抛异常，攒一份完整清单，最后统一判 PASS/FAIL）
// ---------------------------------------------------------------------------

/** @typedef {{ name: string, ok: boolean, detail?: string }} Check */

/** @param {Check[]} checks @param {string} name @param {boolean} ok @param {string=} detail */
function record(checks, name, ok, detail) {
  checks.push({ name, ok, detail });
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// ---------------------------------------------------------------------------
// 网络：POST 真后端（直连，无代理）
// ---------------------------------------------------------------------------

/**
 * @param {string} mode 'dry_run' | 'live'
 * @param {number} timeoutMs
 * @returns {Promise<{ status: number, body: unknown }>}
 */
async function postStudyRun(mode, timeoutMs) {
  const headers = { 'content-type': 'application/json' };
  if (BACKEND_TOKEN) headers.authorization = `Bearer ${BACKEND_TOKEN}`;

  // AbortSignal.timeout: Node 18+ 内置；fetch 全局可用且默认不读 HTTP_PROXY。
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command: COMMAND, mode }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body;
  try {
    body = await res.json();
  } catch (err) {
    body = { __parse_error__: err instanceof Error ? err.message : String(err) };
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// 契约断言 —— 镜像 ZStudyEnvelope / ZStudyEdict 的形状
// ---------------------------------------------------------------------------

/**
 * 校验封套 { success:true, data:{ edict } } 与 edict 的全部必备形状。
 * @param {Check[]} checks
 * @param {string} label 阶段标签（dry_run / live）
 * @param {number} status HTTP 状态码
 * @param {unknown} body 解析后的 JSON
 * @param {{ requireLiveSwarm?: boolean }} [opts]
 * @returns {Record<string, unknown> | null} 通过基本形状时返回 edict，否则 null
 */
function assertEnvelopeAndEdict(checks, label, status, body, opts = {}) {
  const p = (s) => `[${label}] ${s}`;

  record(checks, p('HTTP 200'), status === 200, `实际状态码 = ${status}`);

  if (!isPlainObject(body)) {
    record(checks, p('响应体为 JSON 对象'), false, `实际类型 = ${typeOf(body)}`);
    return null;
  }

  record(checks, p('success === true'), body.success === true, `实际 success = ${JSON.stringify(body.success)}`);

  const data = body.data;
  if (!isPlainObject(data)) {
    record(checks, p('data 为对象'), false, `实际 data 类型 = ${typeOf(data)}`);
    return null;
  }
  record(checks, p('data 为对象'), true);

  const edict = data.edict;
  if (!isPlainObject(edict)) {
    record(checks, p('data.edict 为对象'), false, `实际 edict 类型 = ${typeOf(edict)}`);
    return null;
  }
  record(checks, p('data.edict 为对象'), true);

  // --- edict 顶层必备 key ---
  for (const key of REQUIRED_EDICT_KEYS) {
    record(checks, p(`edict.${key} 存在`), key in edict, key in edict ? undefined : '缺失');
  }

  // --- source_mode ∈ 枚举 ---
  const sm = edict.source_mode;
  record(
    checks,
    p('source_mode ∈ {LIVE,MIXED,FALLBACK,DEMO,LIVE_SWARM}'),
    STUDY_SOURCE_MODES.includes(sm),
    `实际 source_mode = ${JSON.stringify(sm)}`,
  );

  // --- 数组类字段类型 ---
  record(checks, p('departments 为数组'), Array.isArray(edict.departments), `类型 = ${typeOf(edict.departments)}`);
  record(checks, p('evidence 为数组'), Array.isArray(edict.evidence), `类型 = ${typeOf(edict.evidence)}`);
  record(checks, p('risks 为数组'), Array.isArray(edict.risks), `类型 = ${typeOf(edict.risks)}`);
  record(checks, p('next_actions 为数组'), Array.isArray(edict.next_actions), `类型 = ${typeOf(edict.next_actions)}`);

  // --- quality_gate 形状 ---
  const qg = edict.quality_gate;
  if (!isPlainObject(qg)) {
    record(checks, p('quality_gate 为对象'), false, `类型 = ${typeOf(qg)}`);
  } else {
    record(checks, p('quality_gate 为对象'), true);
    record(checks, p('quality_gate.status 存在'), 'status' in qg, 'status' in qg ? undefined : '缺失');
    record(checks, p('quality_gate.score 存在'), 'score' in qg, 'score' in qg ? undefined : '缺失');
    record(
      checks,
      p('quality_gate.reasons 为数组'),
      Array.isArray(qg.reasons),
      `类型 = ${typeOf(qg.reasons)}`,
    );
    record(
      checks,
      p('quality_gate.human_signoff_required 为布尔'),
      typeof qg.human_signoff_required === 'boolean',
      `类型 = ${typeOf(qg.human_signoff_required)}`,
    );
  }

  // --- 每条 evidence 必须有 label/value/source ---
  if (Array.isArray(edict.evidence)) {
    const bad = [];
    edict.evidence.forEach((e, i) => {
      if (!isPlainObject(e) || !('label' in e) || !('value' in e) || !('source' in e)) {
        bad.push(i);
      }
    });
    record(
      checks,
      p('每条 evidence 含 label/value/source'),
      bad.length === 0,
      bad.length ? `不合格索引 = [${bad.join(', ')}]（共 ${edict.evidence.length} 条）` : `共 ${edict.evidence.length} 条`,
    );
  }

  // --- 每条 next_action 必须有 type/label/target ---
  if (Array.isArray(edict.next_actions)) {
    const bad = [];
    edict.next_actions.forEach((a, i) => {
      if (!isPlainObject(a) || !('type' in a) || !('label' in a) || !('target' in a)) {
        bad.push(i);
      }
    });
    record(
      checks,
      p('每条 next_action 含 type/label/target'),
      bad.length === 0,
      bad.length ? `不合格索引 = [${bad.join(', ')}]（共 ${edict.next_actions.length} 条）` : `共 ${edict.next_actions.length} 条`,
    );
  }

  // --- live-only：LIVE_SWARM + run_adapter 真蜂群证据链 ---
  if (opts.requireLiveSwarm) {
    record(
      checks,
      p('source_mode === LIVE_SWARM'),
      sm === 'LIVE_SWARM',
      `实际 source_mode = ${JSON.stringify(sm)}`,
    );

    const ra = edict.run_adapter;
    if (!isPlainObject(ra)) {
      record(checks, p('run_adapter 为对象'), false, `类型 = ${typeOf(ra)}`);
    } else {
      record(checks, p('run_adapter 为对象'), true);
      record(
        checks,
        p("run_adapter.name === 'swarm_orchestrator'"),
        ra.name === 'swarm_orchestrator',
        `实际 name = ${JSON.stringify(ra.name)}`,
      );
      const rep = ra.replay_artifact;
      if (!isPlainObject(rep)) {
        record(checks, p('run_adapter.replay_artifact 为对象'), false, `类型 = ${typeOf(rep)}`);
      } else {
        record(checks, p('run_adapter.replay_artifact 为对象'), true);
        record(
          checks,
          p("run_adapter.replay_artifact.owner === 'shiguan'"),
          rep.owner === 'shiguan',
          `实际 owner = ${JSON.stringify(rep.owner)}`,
        );
      }
    }
  }

  return edict;
}

/**
 * 校验 data.launchLoopCase / launchLoopGate / launchLoopArchive 闭环案卷。
 * @param {Check[]} checks
 * @param {string} label
 * @param {Record<string, unknown>} data
 */
function assertLaunchLoopContract(checks, label, data) {
  const p = (s) => `[${label}] ${s}`;

  const launchLoopCase = data.launchLoopCase;
  if (!isPlainObject(launchLoopCase)) {
    record(checks, p('data.launchLoopCase 为对象'), false, `类型 = ${typeOf(launchLoopCase)}`);
    return;
  }
  record(checks, p('data.launchLoopCase 为对象'), true);

  for (const key of REQUIRED_LAUNCH_LOOP_KEYS) {
    record(checks, p(`launchLoopCase.${key} 存在`), key in launchLoopCase, key in launchLoopCase ? undefined : '缺失');
  }

  record(
    checks,
    p("launchLoopCase.schemaVersion === 'launch_loop_case.v1'"),
    launchLoopCase.schemaVersion === 'launch_loop_case.v1',
    `实际 schemaVersion = ${JSON.stringify(launchLoopCase.schemaVersion)}`,
  );
  record(
    checks,
    p("launchLoopCase.source === 'shangshufang'"),
    launchLoopCase.source === 'shangshufang',
    `实际 source = ${JSON.stringify(launchLoopCase.source)}`,
  );
  record(
    checks,
    p('launchLoopCase.evidenceIds 为数组'),
    Array.isArray(launchLoopCase.evidenceIds),
    `类型 = ${typeOf(launchLoopCase.evidenceIds)}`,
  );
  record(
    checks,
    p('launchLoopCase.evidence 为数组'),
    Array.isArray(launchLoopCase.evidence),
    `类型 = ${typeOf(launchLoopCase.evidence)}`,
  );
  record(
    checks,
    p('launchLoopCase.sourceMode ∈ {LIVE,MIXED,FALLBACK,DEMO,LIVE_SWARM}'),
    STUDY_SOURCE_MODES.includes(launchLoopCase.sourceMode),
    `实际 sourceMode = ${JSON.stringify(launchLoopCase.sourceMode)}`,
  );

  const caseQG = launchLoopCase.qualityGate;
  if (!isPlainObject(caseQG)) {
    record(checks, p('launchLoopCase.qualityGate 为对象'), false, `类型 = ${typeOf(caseQG)}`);
  } else {
    record(checks, p('launchLoopCase.qualityGate 为对象'), true);
    record(checks, p('launchLoopCase.qualityGate.reasons 为数组'), Array.isArray(caseQG.reasons), `类型 = ${typeOf(caseQG.reasons)}`);
    record(
      checks,
      p('launchLoopCase.qualityGate.humanSignoffRequired 为布尔'),
      typeof caseQG.humanSignoffRequired === 'boolean',
      `类型 = ${typeOf(caseQG.humanSignoffRequired)}`,
    );
  }

  const archive = launchLoopCase.archive;
  if (!isPlainObject(archive)) {
    record(checks, p('launchLoopCase.archive 为对象'), false, `类型 = ${typeOf(archive)}`);
  } else {
    record(checks, p('launchLoopCase.archive 为对象'), true);
    record(
      checks,
      p("launchLoopCase.archive.owner === 'shiguan'"),
      archive.owner === 'shiguan',
      `实际 owner = ${JSON.stringify(archive.owner)}`,
    );
    record(
      checks,
      p('launchLoopCase.archive.store 为 JSONL 边界'),
      typeof archive.store === 'string' && archive.store.endsWith('launch_loop_cases.jsonl'),
      `实际 store = ${JSON.stringify(archive.store)}`,
    );
    record(
      checks,
      p('launchLoopCase.archive.replayApiPath 存在'),
      typeof archive.replayApiPath === 'string' && archive.replayApiPath.length > 0,
      `实际 replayApiPath = ${JSON.stringify(archive.replayApiPath)}`,
    );
  }

  const learning = launchLoopCase.learning;
  if (!isPlainObject(learning)) {
    record(checks, p('launchLoopCase.learning 为对象'), false, `类型 = ${typeOf(learning)}`);
  } else {
    record(checks, p('launchLoopCase.learning 为对象'), true);
    record(
      checks,
      p("launchLoopCase.learning.owner === 'shiguan'"),
      learning.owner === 'shiguan',
      `实际 owner = ${JSON.stringify(learning.owner)}`,
    );
  }

  const launchLoopGate = data.launchLoopGate;
  if (!isPlainObject(launchLoopGate)) {
    record(checks, p('data.launchLoopGate 为对象'), false, `类型 = ${typeOf(launchLoopGate)}`);
  } else {
    record(checks, p('data.launchLoopGate 为对象'), true);
    record(checks, p('launchLoopGate.passed 为布尔'), typeof launchLoopGate.passed === 'boolean', `类型 = ${typeOf(launchLoopGate.passed)}`);
    record(checks, p('launchLoopGate.reasons 为数组'), Array.isArray(launchLoopGate.reasons), `类型 = ${typeOf(launchLoopGate.reasons)}`);
    record(
      checks,
      p('launchLoopGate.case_id 与案卷一致'),
      launchLoopGate.case_id === launchLoopCase.case_id,
      `gate=${JSON.stringify(launchLoopGate.case_id)} case=${JSON.stringify(launchLoopCase.case_id)}`,
    );
  }

  const launchLoopArchive = data.launchLoopArchive;
  if (!isPlainObject(launchLoopArchive)) {
    record(checks, p('data.launchLoopArchive 为对象'), false, `类型 = ${typeOf(launchLoopArchive)}`);
  } else {
    record(checks, p('data.launchLoopArchive 为对象'), true);
    record(
      checks,
      p('launchLoopArchive.case_id 与案卷一致'),
      launchLoopArchive.case_id === launchLoopCase.case_id,
      `archive=${JSON.stringify(launchLoopArchive.case_id)} case=${JSON.stringify(launchLoopCase.case_id)}`,
    );
    record(
      checks,
      p('launchLoopArchive.archivePath 指向 JSONL'),
      typeof launchLoopArchive.archivePath === 'string' && launchLoopArchive.archivePath.endsWith('launch_loop_cases.jsonl'),
      `实际 archivePath = ${JSON.stringify(launchLoopArchive.archivePath)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 报告输出
// ---------------------------------------------------------------------------

/** @param {Check[]} checks @returns {boolean} 全过为 true */
function printReport(checks) {
  const failed = checks.filter((c) => !c.ok);
  const passed = checks.length - failed.length;

  console.log('');
  console.log('================ Study Edict 契约门 · REAL backend ================');
  console.log(`后端: ${BACKEND_URL}  (直连, 无代理)`);
  console.log(`断言总数: ${checks.length}   通过: ${passed}   失败: ${failed.length}`);
  console.log('------------------------------------------------------------------');

  if (failed.length === 0) {
    for (const c of checks) console.log(`  PASS  ${c.name}`);
    console.log('------------------------------------------------------------------');
    console.log('结果: PASS ✅  (真闭合，未发现假数据/契约漂移)');
    console.log('==================================================================');
    return true;
  }

  console.log('失败断言清单:');
  for (const c of failed) {
    console.log(`  FAIL  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
  }
  console.log('------------------------------------------------------------------');
  console.log('结果: FAIL ❌  (契约门未通过，禁止发布)');
  console.log('==================================================================');
  return false;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const live = process.argv.slice(2).includes('--live');

  /** @type {Check[]} */
  const checks = [];

  if (!BACKEND_TOKEN) {
    record(
      checks,
      '认证令牌已配置（JIQUN_ADMIN_TOKEN 或 COURT_TOKEN）',
      false,
      '后端 strict auth 已启用；请传入只读/管理员后端 token 后再跑契约门',
    );
    const allPass = printReport(checks);
    process.exit(allPass ? 0 : 1);
  }

  // ---- 阶段 1：dry_run（永远跑）----
  try {
    const { status, body } = await postStudyRun('dry_run', DRY_TIMEOUT_MS);
    assertEnvelopeAndEdict(checks, 'dry_run', status, body);
    if (isPlainObject(body) && isPlainObject(body.data)) {
      assertLaunchLoopContract(checks, 'dry_run', body.data);
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    record(checks, '[dry_run] 网络请求成功（无超时/无连接错误）', false, msg);
  }

  // ---- 阶段 2：live（仅 --live）----
  if (live) {
    try {
      const { status, body } = await postStudyRun('live', LIVE_TIMEOUT_MS);
      assertEnvelopeAndEdict(checks, 'live', status, body, { requireLiveSwarm: true });
      if (isPlainObject(body) && isPlainObject(body.data)) {
        assertLaunchLoopContract(checks, 'live', body.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      record(checks, '[live] 网络请求成功（无超时/无连接错误）', false, msg);
    }
  } else {
    console.log('(提示: 未带 --live，仅校验 dry_run；加 --live 可额外校验真蜂群 LIVE_SWARM 闭合)');
  }

  const allPass = printReport(checks);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  // 兜底：任何未预期错误也算 FAIL，绝不让脚本静默成功（anti-假闭合）。
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error('');
  console.error('FATAL  契约门脚本自身异常（视为 FAIL）:', msg);
  process.exit(1);
});
