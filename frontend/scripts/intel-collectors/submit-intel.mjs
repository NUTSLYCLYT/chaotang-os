#!/usr/bin/env node
/**
 * 户部电芯价采集器(雏形) · 核查+入库两步自动化。
 * 联网搜索这一步不在本脚本内(见 README.md 说明)——由 agent/人先用 web-access 找到真实
 * 情报和真实来源 URL，再调本脚本做 vet_intel 核查 + POST /api/court/intel/signals 入库。
 *
 * 用法见 README.md。
 */
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { sources: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--source') {
      args.sources.push(argv[++i]);
      continue;
    }
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[++i];
    }
  }
  return args;
}

function vetIntel(claim, sourceNames) {
  const py = `
import sys
sys.path.insert(0, ${JSON.stringify(`${process.env.HOME}/.claude/skills/锦衣卫/scripts`)})
from intel import vet_intel
import json
print(json.dumps(vet_intel(${JSON.stringify(claim)}, ${JSON.stringify(sourceNames)})))
`;
  const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { claim, title, category = 'neutral', level = 'info', token, baseUrl = 'http://127.0.0.1:3002' } = args;

  if (!claim || !title || args.sources.length === 0 || !token) {
    console.error('缺少必填参数：--claim --title --source(至少1个) --token');
    process.exit(1);
  }

  const parsedSources = args.sources.map((s) => {
    const [name, url] = s.split('|');
    if (!name || !url) throw new Error(`--source 格式应为 "名称|URL"，收到: ${s}`);
    return { name, url, sourceType: 'news', credibility: 'medium', capturedAt: new Date().toISOString() };
  });

  const verdict = vetIntel(claim, parsedSources.map((s) => s.name));
  console.log('锦衣卫核查结果:', verdict);

  if (verdict.decision !== '入库') {
    console.log(`⚠️ 核查判定"${verdict.decision}"（${verdict.reason}），不入库。需要人工核实或补充信源后重跑。`);
    process.exit(0);
  }

  const id = `intel_${Date.now()}_${title.replace(/[^\w一-龥]/g, '').slice(0, 12)}`;
  const body = {
    id,
    title,
    summary: claim,
    category,
    level,
    sourceLabel: 'MIXED', // 二手多源印证，不是官方一手申报数据，如实标 MIXED 不冒充 LIVE
    sources: parsedSources,
  };

  const res = await fetch(`${baseUrl}/chaotang/api/court/intel/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `courtos.access_token=${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    console.error('入库失败:', res.status, json);
    process.exit(1);
  }
  console.log('✓ 已入库:', id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
