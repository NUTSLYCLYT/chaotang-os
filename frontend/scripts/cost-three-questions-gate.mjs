#!/usr/bin/env node
/**
 * 桩③ · "成本三问"确定性 CI 门(MASTER_PLAN Phase 1 出口闸 / 运营会审天才建议)
 *
 * 像后端 fail-secure 门一样焊死。上线前必须回答 —— 一个付费用户最坏能让我:
 *   ① 花多少钱   (maxSpendPerTenantUSD —— 预付配额 + 请求前硬熔断)
 *   ② 跑什么命令 (untrustedExecSandboxed —— 沙箱化执行不可信 agent 输出)
 *   ③ 看到谁的数据 (tenantHardIsolation —— 每租户加密隔离)
 *
 * 三个都有硬上限 → 绿;任一缺失 → 红牌,挡上线。
 * 当前【故意红】:先逼出三个硬上限,Phase 3 焊死后此门转绿。
 *
 * 配置来源:cost-limits.json(仓根)。用法:node scripts/cost-three-questions-gate.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function load() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'cost-limits.json'), 'utf8'));
  } catch {
    return null;
  }
}

const cfg = load();

/** 三问的硬性断言 */
const CHECKS = [
  {
    q: '① 一个付费用户最坏能让我花多少钱?',
    pass: cfg && Number.isFinite(cfg.maxSpendPerTenantUSD) && cfg.maxSpendPerTenantUSD > 0,
    need: 'cost-limits.json: maxSpendPerTenantUSD = <每租户每周期硬上限,预付配额 + fail-closed 熔断>',
  },
  {
    q: '② 一个付费用户最坏能跑什么命令?',
    pass: cfg && cfg.untrustedExecSandboxed === true,
    need: 'cost-limits.json: untrustedExecSandboxed = true(沙箱化执行不可信 agent 输出,堵 prompt-injection→RCE)',
  },
  {
    q: '③ 一个付费用户最坏能看到谁的数据?',
    pass: cfg && cfg.tenantHardIsolation === true,
    need: 'cost-limits.json: tenantHardIsolation = true(每租户加密隔离,硬隔离非软隔离)',
  },
];

let red = false;
console.log('\n=== 成本三问 · 上线资格门 ===\n');
for (const c of CHECKS) {
  if (c.pass) {
    console.log(`  ✅ ${c.q}`);
  } else {
    red = true;
    console.log(`  ❌ ${c.q}`);
    console.log(`     需要: ${c.need}`);
  }
}

if (red) {
  console.error('\n🔴 红牌:成本三问未全部焊死,挡上线。(Phase 3 焊死后转绿)\n');
  process.exit(1);
}
console.log('\n🟢 三问皆有硬上限,放行。\n');
process.exit(0);
