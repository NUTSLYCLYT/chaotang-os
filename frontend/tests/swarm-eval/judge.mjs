#!/usr/bin/env node
/**
 * judge.mjs — 朝堂蜂群测试套件 · LLM-judge 评分器
 * =============================================================================
 * 读 tests/swarm-eval/results/*.json，对每条 output 用 LLM-judge 按 5 维
 * (relevance / accuracy / completeness / actionability / traceability) 1-5 打分，
 * 写 tests/swarm-eval/scores/<id>__<mode>.json。
 *
 * 用法:
 *   # 真实 LLM 评分（OpenAI 兼容 /chat/completions）
 *   JUDGE_API_URL=https://api.openai.com/v1/chat/completions \
 *   JUDGE_API_KEY=sk-... \
 *   JUDGE_MODEL=gpt-4o-mini \
 *     node tests/swarm-eval/judge.mjs
 *
 *   # 干跑（规则桩，不调 LLM，给每条中庸分，走通写文件流程）
 *   node tests/swarm-eval/judge.mjs --dry-run
 *
 *   # 仅评分指定 id（可多次）
 *   node tests/swarm-eval/judge.mjs --only hu_bu__deep --only gong_bu__single
 *
 *   # 覆盖已存在的 scores（默认跳过已评分的）
 *   node tests/swarm-eval/judge.mjs --force
 *
 * 退出码: 0 全部成功; 1 环境/参数错误(缺 LLM 配置且非 dry-run); 2 部分条目评分失败。
 *
 * -----------------------------------------------------------------------------
 * 跨脚本契约假设（与 battery.json / run 脚本 / scorecard 对齐）:
 *  - 输入 results/<id>__<mode>.json 形如:
 *      { id, dept, mode:'single'|'deep', command, ok, httpStatus,
 *        output:string|object, verdict?, latencyMs, error? }
 *    本脚本只强依赖 { id, mode, command, output }；其余字段缺失会容错。
 *  - 文件名即 "<id>__<mode>.json"；id 取自 JSON 的 .id，mode 取自 .mode，
 *    若 JSON 缺这两字段则回退到从文件名解析（split '__'）。
 *  - 输出 scores/<id>__<mode>.json 形如:
 *      { id, mode, dims:{relevance,accuracy,completeness,actionability,traceability},
 *        weightedAvg, notes, judge:'llm'|'human' }
 *    （dry-run 时 judge 标 'llm' 但 notes 注明 stub；见 STUB_NOTE）
 *  - weightedAvg: 默认等权(各 0.2)。如需调权改 WEIGHTS。
 *  - 不合格门槛由 scorecard 脚本判定（accuracy 或 traceability ≤2 → 不合格）；
 *    本脚本只产出原始维度分，不做合格/不合格裁决，保持职责单一。
 *  - 绝不硬编码密钥；LLM 配置全部来自 env。
 * =============================================================================
 */

import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');
const SCORES_DIR = path.join(__dirname, 'scores');

/** 5 维评分权重（等权；改这里即可调权，必须和为 1） */
const WEIGHTS = {
  relevance: 0.2,
  accuracy: 0.2,
  completeness: 0.2,
  actionability: 0.2,
  traceability: 0.2,
};
const DIM_KEYS = Object.keys(WEIGHTS);

const STUB_NOTE = '[dry-run stub] 规则桩中庸分，未调用 LLM，仅用于打通写文件流程，不代表真实质量。';

/* ----------------------------------------------------------------------------
 * 参数解析
 * -------------------------------------------------------------------------- */
function parseArgs(argv) {
  const args = { dryRun: false, force: false, only: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--only') {
      const v = argv[++i];
      if (!v) fail(`--only 需要一个值（如 --only hu_bu__deep）`);
      args.only.push(v);
    } else if (a === '-h' || a === '--help') {
      printHelpAndExit();
    } else {
      fail(`未知参数: ${a}（用 --help 查看用法）`);
    }
  }
  return args;
}

function printHelpAndExit() {
  // 用法注释在文件顶部；这里给一行指引。
  process.stdout.write(
    'judge.mjs — LLM-judge 评分器\n' +
      '  真实评分: JUDGE_API_URL JUDGE_API_KEY JUDGE_MODEL 三者必填\n' +
      '  干跑:     node tests/swarm-eval/judge.mjs --dry-run\n' +
      '  详见文件顶部用法注释。\n',
  );
  process.exit(0);
}

function fail(msg, code = 1) {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(code);
}

/* ----------------------------------------------------------------------------
 * Judge prompt（严格 · 强约束 JSON · accuracy=幻觉、traceability=来源/推理）
 * -------------------------------------------------------------------------- */
function buildJudgeMessages(item) {
  const outputText =
    typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2);

  const system = [
    '你是朝堂蜂群（多智能体政务/经营决策系统）的严格质检官（LLM-judge）。',
    '你的职责：对一个智能体/三院议事的产出，按 5 个维度各打 1-5 的整数分（1=很差，5=优秀）。',
    '评分必须严格、保守、可辩护，宁低勿高。不要被华丽辞藻或自信语气迷惑。',
    '',
    '5 个维度定义（务必逐条对照）：',
    '- relevance（相关性）：产出是否切中 command 的真实意图与约束，没有跑题、没有答非所问。',
    '- accuracy（准确性 / 反幻觉，关键维度）：是否存在编造、臆造数据、虚构事实或幻觉。',
    '    任何无依据的具体数字、不存在的来源、自相矛盾、明显违背常识 → 必须显著扣分（≤2）。',
    '    宁可承认不确定，也不能编造；编造比缺漏更严重。',
    '- completeness（完整性）：是否覆盖了任务应有的关键面向，有无重大遗漏或半途而废。',
    '- actionability（可执行性）：结论是否落地、具体、可被陛下/执行方直接采纳（步骤/数值/取舍/下一步）。',
    '- traceability（可追溯性，关键维度）：是否给出推理链、依据、来源或假设。',
    '    只有结论没有理由、无任何依据/假设说明、黑箱断言 → 必须显著扣分（≤2）。',
    '',
    '输出要求：只输出一个 JSON 对象，禁止任何额外文字、禁止 markdown 代码围栏。',
    '形如：{"dims":{"relevance":int,"accuracy":int,"completeness":int,"actionability":int,"traceability":int},"notes":"一句中文，指出主要扣分点或亮点"}',
    '所有维度分必须是 1 到 5 的整数。notes 用中文，简洁，直指要害。',
  ].join('\n');

  const user = [
    `【任务 command】\n${item.command ?? '(缺失)'}`,
    '',
    item.dept ? `【目标部门】${item.dept}` : null,
    item.mode ? `【模式】${item.mode}` : null,
    item.verdict ? `【门下 verdict】${item.verdict}` : null,
    item.ok === false ? `【注意】该条 ok=false（请求失败/异常），output 可能是错误信息；据实低分。` : null,
    '',
    '【待评产出 output】',
    outputText,
    '',
    '现在只输出评分 JSON。',
  ]
    .filter((x) => x !== null)
    .join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/* ----------------------------------------------------------------------------
 * 校验与归一化 LLM 返回的分数
 * -------------------------------------------------------------------------- */
function clampInt(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(5, Math.max(1, v));
}

function normalizeScore(raw) {
  // 容错: 模型可能裹 ```json fence 或带前后缀文字 → 抽第一个 {...}
  let obj = raw;
  if (typeof raw === 'string') {
    let s = raw.trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (m) s = m[0];
    obj = JSON.parse(s);
  }
  const dimsIn = obj?.dims ?? obj;
  const dims = {};
  for (const k of DIM_KEYS) {
    const v = clampInt(dimsIn?.[k]);
    if (v === null) throw new Error(`维度 ${k} 缺失或非法: ${JSON.stringify(dimsIn?.[k])}`);
    dims[k] = v;
  }
  const notes = typeof obj?.notes === 'string' ? obj.notes : '';
  return { dims, notes };
}

function weightedAvg(dims) {
  let sum = 0;
  for (const k of DIM_KEYS) sum += dims[k] * WEIGHTS[k];
  return Math.round(sum * 100) / 100;
}

/* ----------------------------------------------------------------------------
 * LLM 调用（OpenAI 兼容 /chat/completions）
 * -------------------------------------------------------------------------- */
async function callLLM(cfg, messages) {
  const body = {
    model: cfg.model,
    messages,
    temperature: 0,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  };

  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`LLM 网络请求失败: ${e?.message ?? e}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 部分网关不支持 response_format → 退一次不带该字段重试
    if (res.status === 400 && /response_format|json_object/i.test(text)) {
      delete body.response_format;
      const retry = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify(body),
      });
      if (!retry.ok) {
        const t2 = await retry.text().catch(() => '');
        throw new Error(`LLM HTTP ${retry.status}: ${t2.slice(0, 300)}`);
      }
      const j2 = await retry.json();
      return extractContent(j2);
    }
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return extractContent(json);
}

function extractContent(json) {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`LLM 返回为空或无 choices[0].message.content: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return content;
}

/* ----------------------------------------------------------------------------
 * 干跑桩: 中庸分（不调 LLM）
 * -------------------------------------------------------------------------- */
function stubScore(item) {
  // 失败条目据实低分；正常条目给中庸 3 分。
  const failed = item.ok === false || (item.httpStatus && item.httpStatus >= 400);
  const base = failed ? 2 : 3;
  const dims = {};
  for (const k of DIM_KEYS) dims[k] = base;
  return { dims, notes: STUB_NOTE };
}

/* ----------------------------------------------------------------------------
 * 主流程
 * -------------------------------------------------------------------------- */
async function fileExists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseIdMode(json, filename) {
  let id = typeof json.id === 'string' ? json.id : null;
  let mode = json.mode === 'single' || json.mode === 'deep' ? json.mode : null;
  if (!id || !mode) {
    const base = filename.replace(/\.json$/i, '');
    const idx = base.lastIndexOf('__');
    if (idx > 0) {
      if (!id) id = base.slice(0, idx);
      if (!mode) mode = base.slice(idx + 2);
    }
  }
  return { id, mode };
}

async function main() {
  const args = parseArgs(process.argv);

  // LLM 配置（仅真实评分时强制）
  const cfg = {
    url: process.env.JUDGE_API_URL,
    key: process.env.JUDGE_API_KEY,
    model: process.env.JUDGE_MODEL,
  };

  if (!args.dryRun) {
    const missing = [];
    if (!cfg.url) missing.push('JUDGE_API_URL');
    if (!cfg.key) missing.push('JUDGE_API_KEY');
    if (!cfg.model) missing.push('JUDGE_MODEL');
    if (missing.length) {
      fail(
        `缺少 LLM 配置环境变量: ${missing.join(', ')}\n` +
          `  请设置（OpenAI 兼容 /chat/completions）:\n` +
          `    export JUDGE_API_URL=https://api.openai.com/v1/chat/completions\n` +
          `    export JUDGE_API_KEY=sk-...\n` +
          `    export JUDGE_MODEL=gpt-4o-mini\n` +
          `  或先跑 --dry-run 走通流程: node tests/swarm-eval/judge.mjs --dry-run`,
        1,
      );
    }
  }

  // 读 results
  if (!(await fileExists(RESULTS_DIR))) {
    fail(`results 目录不存在: ${RESULTS_DIR}\n  请先运行 run 脚本生成 results/*.json（或用 --dry-run 前先确认目录）。`, 1);
  }
  let files = (await readdir(RESULTS_DIR)).filter((f) => f.toLowerCase().endsWith('.json'));
  if (files.length === 0) {
    fail(`results 目录为空（无 *.json）: ${RESULTS_DIR}\n  请先运行 run 脚本。`, 1);
  }

  await mkdir(SCORES_DIR, { recursive: true });

  const onlySet = new Set(args.only);
  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const failures = [];

  for (const f of files.sort()) {
    const inPath = path.join(RESULTS_DIR, f);
    let json;
    try {
      json = JSON.parse(await readFile(inPath, 'utf8'));
    } catch (e) {
      failCount++;
      failures.push(`${f}: 无法解析 JSON (${e?.message ?? e})`);
      continue;
    }

    const { id, mode } = parseIdMode(json, f);
    if (!id || !mode) {
      failCount++;
      failures.push(`${f}: 无法确定 id/mode（JSON 与文件名均无法解析）`);
      continue;
    }
    const key = `${id}__${mode}`;

    if (onlySet.size && !onlySet.has(key) && !onlySet.has(id)) {
      continue;
    }

    const outPath = path.join(SCORES_DIR, `${key}.json`);
    if (!args.force && (await fileExists(outPath))) {
      skipCount++;
      process.stdout.write(`· skip ${key}（已评分，--force 可覆盖）\n`);
      continue;
    }

    const item = {
      id,
      mode,
      dept: json.dept,
      command: json.command,
      output: json.output,
      verdict: json.verdict,
      ok: json.ok,
      httpStatus: json.httpStatus,
    };

    let scored;
    try {
      if (args.dryRun) {
        scored = stubScore(item);
      } else {
        const messages = buildJudgeMessages(item);
        const content = await callLLM(cfg, messages);
        scored = normalizeScore(content);
      }
    } catch (e) {
      failCount++;
      failures.push(`${key}: 评分失败 (${e?.message ?? e})`);
      process.stderr.write(`✗ ${key}: ${e?.message ?? e}\n`);
      continue;
    }

    const record = {
      id,
      mode,
      dims: scored.dims,
      weightedAvg: weightedAvg(scored.dims),
      notes: scored.notes,
      judge: 'llm',
    };

    await writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
    okCount++;
    process.stdout.write(
      `✓ ${key}  avg=${record.weightedAvg}  ` +
        DIM_KEYS.map((k) => `${k[0]}${record.dims[k]}`).join(' ') +
        `\n`,
    );
  }

  process.stdout.write(
    `\n— 评分完成${args.dryRun ? '（dry-run 桩）' : ''}: ok=${okCount} skip=${skipCount} fail=${failCount} → ${SCORES_DIR}\n`,
  );
  if (failures.length) {
    process.stderr.write('失败明细:\n' + failures.map((m) => `  - ${m}`).join('\n') + '\n');
    process.exit(2);
  }
  process.exit(0);
}

main().catch((e) => fail(`未捕获异常: ${e?.stack ?? e}`, 2));
