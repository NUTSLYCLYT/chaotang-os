#!/usr/bin/env -S npx tsx
/**
 * 户部成本数据管道 · 文件夹适配层（2026-07-01）
 *
 * "指一个文件夹 → 批量真成本 + 御史巡查 + 剥一次性费"的 IO 薄壳。
 * 纯逻辑在 src/features/hubu/lib/cost-portfolio.ts（可单测）；本文件只负责 fs + xlsx 读取。
 *
 * 用法：pnpm ingest:boms "/mnt/h/郭/采购供应链/项目成本核算" [out.json]
 */
import * as XLSX from 'xlsx';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { buildCostPortfolio } from '../src/features/hubu/lib/cost-portfolio';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(xls|xlsx)$/i.test(name)) out.push(p);
    } catch {
      /* 跳过不可读 */
    }
  }
  return out;
}

/** 一个工作簿里选"能核出最高成本"的那张 sheet 的 rows（多 sheet 版本时取主表）。 */
function bestSheetRows(path: string): unknown[][] | null {
  try {
    const wb = XLSX.readFile(path);
    let best: unknown[][] | null = null;
    let bestTotal = -1;
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true }) as unknown[][];
      const t = buildCostPortfolio([{ file: path, product: 'x', rows }]).entries[0]?.totalCost ?? -1;
      if (t > bestTotal) {
        bestTotal = t;
        best = rows;
      }
    }
    return best;
  } catch {
    return null;
  }
}

const dir = process.argv[2];
if (!dir) {
  console.error('用法：pnpm ingest:boms <文件夹> [out.json]');
  process.exit(1);
}
const boms = walk(dir)
  .map((f) => ({ file: basename(f), product: basename(f).replace(/\.[^.]+$/, ''), rows: bestSheetRows(f) }))
  .filter((b): b is { file: string; product: string; rows: unknown[][] } => b.rows != null);

const port = buildCostPortfolio(boms);
console.log('— 户部成本数据管道 · 真文件夹 —');
console.log(`目录：${dir}`);
console.log(`汇总：${JSON.stringify(port.summary)}`);
console.log('\n可信（电芯命脉·可作报价底座）TOP5：');
port.clean.slice(0, 5).forEach((e) => console.log(`  ¥${e.totalCost} · ${e.topDriver}${e.driverPct}% · ${e.product.slice(0, 36)}`));
console.log('\n污染（含一次性费/离谱·御史拦）TOP5 —— 剥 NRE 后真单台：');
port.flagged.slice(0, 5).forEach((e) =>
  console.log(
    `  总¥${e.totalCost} → 剥NRE后¥${e.unitCostExNre}${e.nreCost ? `(剥出模具费¥${e.nreCost})` : ''} · ${e.stillSuspect ? '仍疑·需人工核' : '已还原电芯命脉✓'} · ${e.product.slice(0, 30)}`,
  ),
);

const out = process.argv[3];
if (out) {
  writeFileSync(out, JSON.stringify(port, null, 1));
  console.log(`\n完整报告已写：${out}`);
}
