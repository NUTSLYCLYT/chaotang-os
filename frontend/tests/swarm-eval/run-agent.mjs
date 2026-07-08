#!/usr/bin/env node
/**
 * run-agent.mjs —— 路线 B 通用单 agent 运行器 + 确定性数字 verifier(大神会审 #2/#3)。
 *
 * 一个运行器 × N 个部门配置(agents/<deptCode>.config.mjs)。
 * #2 确定性 verifier：answer/reasoning 里每个有意义数字必须能在 context 逐字 grep 到；
 *   找不到 → 打回重写一次；仍找不到的留痕成 hallucinations/ 数据集(护城河)。
 * #3 conflicts 字段：每个 agent 声明"我这结论会被哪个部门什么数据推翻"(共享 context，不裁决他人)。
 *
 * 用法：DEEPSEEK_API_KEY=sk-... node run-agent.mjs --all | --dept hu_bu
 */
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyNumbers } from './lib/number-verifier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
function key() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  try {
    const pid = execSync("ss -tlnp 2>/dev/null | grep ':8081' | grep -oP 'pid=\\K[0-9]+' | head -1").toString().trim();
    const env = execSync(`tr '\\0' '\\n' < /proc/${pid}/environ`).toString();
    const m = env.split('\n').find((l) => l.startsWith('DEEPSEEK_API_KEY='));
    return m ? m.slice('DEEPSEEK_API_KEY='.length) : null;
  } catch { return null; }
}

// 对答案负责输出契约（+#3 conflicts：声明会被谁的什么数据推翻，绝不裁决他人）
const SCHEMA = `产出【可直接拍板的真内容】，不是任务分解、不是分类框架。硬性要求（缺一不可）：
1) 引用给定事实里的具体内容/数字下结论；2) reasoning 推理链；3) evidence 逐字引用你用到的事实/数据；
4) assumptions 假设（仅数据真缺时标注；已给的不得说"缺失"，不得编造）；5) confidence 0-1+不确定来源；
6) conflicts：声明"我这结论会被哪个部门/哪类数据推翻或需要其复核"（没有写"无"，**不要替别的部门下结论**）；
7) 2-3 条带量化目标的可执行动作。
**每个数字必须能在给定数据/已核算指标里逐字找到，绝不自己心算或脑补衍生数。**
严格输出 JSON：{"answer":"...","reasoning":"...","evidence":["..."],"assumptions":["..."],"conflicts":"...","confidence":0-1}`;

const K = key();
if (!K) { console.error('✗ 无 DEEPSEEK_API_KEY'); process.exit(1); }

async function callModel(messages) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.2, messages }),
    signal: AbortSignal.timeout(90000),
  });
  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content ?? '';
  let parsed; try { parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content); } catch { parsed = { answer: content }; }
  return { ok: res.ok, status: res.status, content, parsed };
}
const checkText = (p) => [p.answer, p.reasoning].filter(Boolean).join('\n');

let depts = process.argv.includes('--all')
  ? (await readdir(join(HERE, 'agents'))).filter((f) => f.endsWith('.config.mjs')).map((f) => f.replace('.config.mjs', ''))
  : [arg('--dept', 'hu_bu')];
await mkdir(join(HERE, 'results'), { recursive: true });
await mkdir(join(HERE, 'hallucinations'), { recursive: true });

for (const dept of depts) {
  const cfg = (await import(join(HERE, 'agents', `${dept}.config.mjs`))).default;
  const ctx = await cfg.buildContext();
  const sys = `${cfg.role}\n${SCHEMA}`;
  console.log(`\n[${cfg.deptName} ${cfg.deptCode}] 单 agent + 数字 verifier · ${cfg.questions.length} 问`);
  let ok = 0;
  for (const t of cfg.questions) {
    const t0 = Date.now();
    let rec = { id: t.id, dept: cfg.deptName, deptCode: cfg.deptCode, mode: 'deep', command: t.q, ranAt: new Date().toISOString() };
    try {
      const userMsg = `${ctx}\n\n问题：${t.q}`;
      let r = await callModel([{ role: 'system', content: sys }, { role: 'user', content: userMsg }]);
      let v = verifyNumbers(checkText(r.parsed), ctx);
      const before = v.ungrounded;
      let reprompted = false;
      // #2 verifier：有无依据数字 → 打回重写一次
      if (r.ok && before.length) {
        reprompted = true;
        const bad = before.map((n) => n.raw).join('、');
        r = await callModel([
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
          { role: 'assistant', content: r.content },
          { role: 'user', content: `下列数字在给定数据/已核算指标里【找不到逐字依据】，很可能是你自己心算或脑补的衍生数：${bad}。请只用给定数据与已核算指标重写，删除或修正这些无依据数字，evidence 逐字引用你真正用到的原文。仍按同一 JSON 契约输出。` },
        ]);
        v = verifyNumbers(checkText(r.parsed), ctx);
      }
      rec = { ...rec, ok: r.ok, httpStatus: r.status, source: 'llm', latencyMs: Date.now() - t0,
        output: r.parsed, context: ctx, grounding: { total: v.total, grounded: v.grounded, rate: +v.rate.toFixed(3), ungrounded: v.ungrounded }, reprompted };
      if (r.ok) ok++;
      // 护城河：仍无依据的数字留痕成数据集
      if (before.length) {
        await writeFile(join(HERE, 'hallucinations', `${t.id}.json`), JSON.stringify({ id: t.id, dept: cfg.deptName, question: t.q, ungroundedBefore: before, ungroundedAfter: v.ungrounded, reprompted, fixed: before.length - v.ungrounded.length }, null, 2));
      }
    } catch (e) {
      rec = { ...rec, ok: false, httpStatus: 0, latencyMs: Date.now() - t0, error: String(e.message || e), output: null };
    }
    await writeFile(join(HERE, 'results', `${t.id}__deep.json`), JSON.stringify(rec, null, 2));
    const g = rec.grounding;
    console.log(`  ${rec.ok ? '✓' : '✗'} ${t.id.padEnd(20)} ${rec.latencyMs}ms  数字接地 ${g ? g.grounded + '/' + g.total + (rec.reprompted ? '(已重写)' : '') : '-'}`);
  }
  console.log(`  汇总 ${cfg.deptName}: ok=${ok}/${cfg.questions.length}`);
}
