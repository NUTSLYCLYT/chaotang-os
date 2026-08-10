#!/usr/bin/env node
/**
 * guard:tenant (2026-06-25 · 把"读本地用户数据必须按租户过滤"变可见 · Schneier 根治跨租户泄露)。
 *
 * 盲区:连续多个安全审查抓出同一族——端点读/聚合本地用户数据(决策/档案/judgment)却不按 userId/tenant
 * 过滤 → 跨租户泄露。逐个补是打地鼠;本 guard 扫整族,把"无租户过滤的本地用户数据读端点"列成数字,
 * 驱动收敛到 0,并防新端点忘加。
 *
 * 启发式(会有少量误报,故默认 warn-only):端点 READ 本地用户数据存储,但文件内**无** userId/tenant 过滤痕迹。
 * 默认 warn-only(exit 0);TENANT_STRICT=1 → 有命中即 exit 1。与 guard:auth/realdata 同套路。
 *
 * 假阴性修复(2026-07-04 · 团队级模式排查连带发现)：此前只扫 route.ts 自身文本，"薄route→
 * 胖loader→更胖lib"的两层委托(如 departments/[code]/page-view/route.ts →
 * department-page-view-loader.ts → department-task-insights.ts 才真正调 listPrimaryTasks)
 * 会被漏判——这正是 department-task-insights.ts 里 listPrimaryTasks({ limit }) 从未传
 * tenantId、导致任意登录用户能读到其它人真实任务command原文这个真实HIGH漏洞，两轮
 * guard:auth假阴性教训后仍然复现的同一个根因。现在向下递归追 import(深度上限3层，防环)，
 * 把被引用链上所有 lib 文件的文本也纳入扫描。
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const API = join(ROOT, 'src', 'app', 'api');
const SRC = join(ROOT, 'src');

if (!existsSync(API)) {
  console.log('ℹ️ guard:tenant — 当前前端架构没有 src/app/api，跳过旧 BFF 路由扫描。');
  process.exit(0);
}

// 读本地用户数据(决策/任务/档案/judgment)的调用。
const READ_USER_DATA = /listPrimaryTasks|getPrimaryTaskFull|getArchive\b|getArchives|findSimilarCourtArchives|listArchives|decision-judgments\.local|courtos-decision-store/;
// 租户过滤痕迹(任一即认为有意识做了隔离)。
const TENANT_FILTER = /\buserId\b|tenant_id|tenant_slug|\.tenantId|WHERE[^;]*tenant|filter\([^)]*userId|=== *userId|j\.userId/;
// 已核实豁免(by-id 读且 id 本身是隔离边界 / 或纯系统读)。加入前须人工核实。
// '/api/registry/departments' 已退役进 dev/_attic(2026-07-03·阶段4归档集群，客户端0引用死码)，移除豁免项。
const ALLOWLIST = new Set([]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

/** 递归追 route.ts 的 `@/...`/相对路径 import 链(深度上限3层、visited防环)，把整条委托链上
 *  的 lib 文件文本都纳入扫描——"薄route→胖loader→更胖lib"这种两层委托，一层追踪追不到。 */
function resolveImportedText(entryFile, entryTxt, maxDepth = 3) {
  const visited = new Set([entryFile]);
  const texts = [];
  let frontier = [{ file: entryFile, txt: entryTxt }];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next = [];
    for (const { file, txt } of frontier) {
      const importRe = /from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;
      let m;
      while ((m = importRe.exec(txt))) {
        const spec = m[1];
        const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : join(dirname(file), spec);
        for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
          if (existsSync(candidate) && !visited.has(candidate)) {
            visited.add(candidate);
            try {
              const candidateTxt = readFileSync(candidate, 'utf8');
              texts.push(candidateTxt);
              next.push({ file: candidate, txt: candidateTxt });
            } catch {
              // 忽略读取失败(不影响主检测，宁可漏报也不让guard自身崩)。
            }
            break;
          }
        }
      }
    }
    frontier = next;
  }
  return texts.join('\n');
}

const hits = [];
for (const f of walk(API)) {
  const rel = '/' + relative(join(ROOT, 'src', 'app'), f).replace(/\/route\.ts$/, '').replace(/\\/g, '/');
  if (ALLOWLIST.has(rel)) continue;
  const txt = readFileSync(f, 'utf8');
  const combinedTxt = txt + '\n' + resolveImportedText(f, txt);
  if (!READ_USER_DATA.test(combinedTxt)) continue;
  if (TENANT_FILTER.test(combinedTxt)) continue; // 有租户过滤痕迹 → 放过
  hits.push(rel);
}

const strict = process.env.TENANT_STRICT === '1';
if (hits.length === 0) {
  console.log('✅ guard:tenant — 无无租户过滤的本地用户数据读端点(跨租户泄露面已清)。');
  process.exit(0);
}
console.log(`${strict ? '❌' : '⚠️ '} guard:tenant — ${hits.length} 个端点读本地用户数据但无可见租户过滤(疑跨租户泄露·人工核):`);
for (const h of hits) console.log(`  ⚠️ ${h}  → 读后按 userId/tenant 过滤(见 1aacd09 court_archives / decision-judgment 范式)`);
console.log('（启发式·会有误报:by-id 读且 id 即隔离边界的可加 ALLOWLIST。根治跨租户泄露族,非逐个打地鼠。）');
process.exit(strict ? 1 : 0);
