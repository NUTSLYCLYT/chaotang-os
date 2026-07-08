#!/usr/bin/env node
/**
 * H 盘宣传资料导入(2026-06-24 · 礼部对外宣传 / 史馆归档接真)。
 *
 * 只编目**民用公开 promo** 的文件元数据(标题/类型/分类/目录),**不解析二进制内容**(零泄密)。
 * 双层过滤:① BLOCK 硬 veto(军用/部队/合同/保密/测试报告/电台/项目编号/报价/开票)——任一命中即弃;
 *          ② ALLOW 白名单(宣传册/画册/产品介绍/公司介绍/双创/展会/新能源民品…)——须命中才收。
 * 输出 data/dept-promo.local.json(gitignored·真数据不入库)。来源标 'h-drive-promo'。
 *
 * 用法:node scripts/import-promo-materials.mjs   (H 盘挂 /mnt/h)
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const H = '/mnt/h';
const SCAN_DIRS = [
  '各部门备份/人事/宣传资料',
  '旧文件/公司图片',
  '旧文件/铭硕市场资料',
];

// 硬 veto:任一命中(路径或文件名)即弃。军方/合同/保密/项目编号/财务票据。
const BLOCK = /军|部队|导弹|靶|雷达|武器|装备|保密|机密|涉密|合同|标书|投标|报价|开票|协议|电台|测试报告|检测报告|项目-|项目编号|销售合同|发票/;
// 白名单:须命中之一才收(民用公开 promo)。
const ALLOW = /宣传|画册|产品册|产品介绍|公司介绍|公司及产品|双创|展板|展会|四折页|品牌|新能源产品|京东|前台|封面|图片/;

const IMG = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VID = new Set(['.mp4', '.mov', '.avi']);
const DOC = new Set(['.pdf', '.pptx', '.ppt', '.docx', '.doc']);

function kind(ext) {
  if (IMG.has(ext)) return 'image';
  if (VID.has(ext)) return 'video';
  if (DOC.has(ext)) return 'doc';
  return 'other';
}
function category(name) {
  if (/宣传册|画册|双创|展板|四折页|品牌/.test(name)) return '品牌宣传';
  if (/产品册|产品介绍|公司及产品|新能源产品|京东/.test(name)) return '产品介绍';
  if (/公司介绍|前台|封面/.test(name)) return '公司形象';
  if (/展会|图片/.test(name)) return '活动/展会';
  return '其它宣传';
}
// 天才建议(Deming):按"对外复用价值"分级——产品册/公司介绍/宣传册=high(可直接对外),
// 展会/活动照片=low(内部留档)。让 629 件里真正能对外用的浮上来,不被照片堆淹没。
function tier(cat) {
  return cat === '活动/展会' ? 'low' : 'high';
}

function walk(dir, depth = 0) {
  const out = [];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory() && depth < 3) out.push(...walk(p, depth + 1));
    else if (s.isFile()) out.push({ p, size: s.size });
  }
  return out;
}

const items = [];
const dropped = [];
for (const rel of SCAN_DIRS) {
  for (const { p, size } of walk(join(H, rel))) {
    const name = basename(p);
    const ext = extname(p).toLowerCase();
    if (kind(ext) === 'other') continue;
    if (BLOCK.test(p)) { dropped.push({ name, why: 'BLOCK(军/合同/保密/项目)' }); continue; }
    if (!ALLOW.test(name) && !ALLOW.test(rel)) { dropped.push({ name, why: '非白名单' }); continue; }
    const cat = category(name + rel);
    items.push({
      title: name.replace(ext, ''),
      kind: kind(ext),
      category: cat,
      tier: tier(cat),
      ext: ext.slice(1),
      sizeKB: Math.round(size / 1024),
      sourceDir: rel,
    });
  }
}

// 去重(同名取一) + 按分类/标题排序
const seen = new Set();
const unique = items.filter((it) => { const k = it.title + it.ext; if (seen.has(k)) return false; seen.add(k); return true; });
// high 价值优先(产品册/公司介绍/宣传册置顶,展会照片沉底)。
unique.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'high' ? -1 : 1) || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

const highCount = unique.filter((it) => it.tier === 'high').length;
const out = {
  source: 'h-drive-promo',
  importedFrom: SCAN_DIRS,
  count: unique.length,
  highValueCount: highCount,
  byCategory: unique.reduce((m, it) => ((m[it.category] = (m[it.category] || 0) + 1), m), {}),
  items: unique,
};

const dir = join(process.cwd(), 'data');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'dept-promo.local.json'), JSON.stringify(out, null, 2));

console.log(`✅ 收录民用公开宣传 ${unique.length} 件 → data/dept-promo.local.json`);
console.log('   分类:', JSON.stringify(out.byCategory), '| high价值(可对外):', highCount);
console.log(`   过滤掉 ${dropped.length} 件(军用/合同/保密/非promo)`);
console.log('   样例:', unique.slice(0, 6).map((i) => `${i.category}/${i.title}`).join(' · '));
