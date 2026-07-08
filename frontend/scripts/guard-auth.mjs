#!/usr/bin/env node
/**
 * guard:auth (2026-06-25 · 把"court/* 本地写必须 own-auth"纪律变 CI · Schneier 纵深防御棘轮)。
 *
 * 盲区:/api/court/* 在中间件层是"公开 + 后端 FENGQUN_AUTH 兜底"。但**直写本地库**的 court 路由
 * 不经后端 → FENGQUN_AUTH=false 时裸奔。手补的 own-auth 会被下一个新端点忘掉,又长出裸奔洞。
 * 本 guard 扫:**暴露(court/* 或公开白名单) + 状态变更 + 写本地 + 无 own-auth** = 裸奔本地写,报。
 *
 * 默认 warn-only(exit 0);AUTH_STRICT=1 → 有命中即 exit 1(升阻断门)。与 guard:realdata/honesty 同套路。
 *
 * 假阴性修复(2026-07-03 · 两轮会审揪出的根因)：此前只扫 route.ts 文件自身文本，"薄route转发到
 * 胖lib模块"的写操作(如 real-source/route.ts 调 applyDepartmentLearningRealSource，真正的
 * INSERT/saveLearningRecord 藏在被 import 的 lib 文件里)会被漏判"无本地写"而放行——这正是
 * court/learning/real-source、court/learning/advisor-signal 两处鉴权缺口两轮会审都没被
 * 这个guard抓到的原因。现在向下追一层 `@/lib/...`/相对路径 import，把被引用的 lib 文件文本
 * 也纳入扫描。同时新增对 GET 端点读取敏感部门学习数据的检测(此前 STATE_CHANGE 只看
 * POST/PUT/DELETE/PATCH，GET 泄露天然是盲区)。
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const API = join(ROOT, 'src', 'app', 'api');
const SRC = join(ROOT, 'src');

// 暴露面:court/* 全公开(FENGQUN_AUTH兜底) + 这些公开白名单前缀(中间件无 cookie 门)。
// '/^api\/registry\//' 移除(2026-07-03)：唯一子路由 registry/departments 已退役进 dev/_attic，
// api/registry/ 下不再有任何路由文件，此正则不会再匹配到任何东西。
const EXPOSED = [/^api\/court\//, /^api\/shangshufang\//, /^api\/shiguan\//];
const STATE_CHANGE = /export\s+async\s+function\s+(POST|PUT|DELETE|PATCH)/;
const HAS_GET = /export\s+async\s+function\s+GET/;
const WRITE_LOCAL = /upsertPrimaryTask|saveCourtArchive|updateArchive|writeFileSync|appendFile|INTO tasks|primaryStore|primary-store|courtos-decision-store|decision-store|saveLearningRecord|applyDepartmentLearningRealSource/;
// GET 端点读取内部敏感数据的已知类别(部门学习信号/记录)。窄口径，避免误伤设计上就公开
// 的共享展示端点(如intel/signals)——只覆盖两轮会审实测抓到的这一类。
const READ_SENSITIVE = /loadLearningRecords|loadAdvisorSignals/;
const OWN_AUTH = /requireSession|requireTenantScope|getUserIdFromSession|isAdminAccount|Bearer |getSession|readSession/;

// 已核实诚实/豁免(读回写但本质安全/或读端点)。加入前须人工核实。
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

/** 解析 route.ts 里的 `@/...`/相对路径 import，向下追一层，把被引用 lib 文件的文本也纳入扫描
 *  (只追一层，不做完整依赖图遍历——足以堵住"薄route转发到胖lib"这个已实测的盲区)。 */
function resolveImportedText(routeFile, routeTxt) {
  const importRe = /from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;
  const texts = [];
  let m;
  while ((m = importRe.exec(routeTxt))) {
    const spec = m[1];
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : join(dirname(routeFile), spec);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(candidate)) {
        try {
          texts.push(readFileSync(candidate, 'utf8'));
        } catch {
          // 忽略读取失败(不影响主检测，宁可漏报也不让guard自身崩)。
        }
        break;
      }
    }
  }
  return texts.join('\n');
}

const hits = [];
for (const f of walk(API)) {
  const rel = relative(join(ROOT, 'src', 'app'), f).replace(/\/route\.ts$/, '').replace(/\\/g, '/');
  if (!EXPOSED.some((re) => re.test(rel))) continue;
  if (ALLOWLIST.has(rel)) continue;
  const txt = readFileSync(f, 'utf8');
  const combinedTxt = txt + '\n' + resolveImportedText(f, txt);

  const isWrite = STATE_CHANGE.test(txt) && WRITE_LOCAL.test(combinedTxt);
  const isSensitiveRead = HAS_GET.test(txt) && READ_SENSITIVE.test(combinedTxt);
  if (!isWrite && !isSensitiveRead) continue;
  if (OWN_AUTH.test(combinedTxt)) continue;
  hits.push('/' + rel + (isSensitiveRead && !isWrite ? '  [GET 敏感读]' : ''));
}

const strict = process.env.AUTH_STRICT === '1';
if (hits.length === 0) {
  console.log('✅ guard:auth — 无裸奔本地写:所有暴露面下的本地写状态变更端点都有 own-auth(纵深防御齐)。');
  process.exit(0);
}
console.log(`${strict ? '❌' : '⚠️ '} guard:auth — ${hits.length} 个暴露面本地写端点缺 own-auth(FENGQUN_AUTH=false 时裸奔):`);
for (const h of hits) console.log(`  ❗ ${h}  → 补 requireSession 或 requireTenantScope(见 src/lib/auth/)`);
console.log('（court/* 中间件只靠 FENGQUN_AUTH 单点;本地写须第二道门。这是盒子交付给国防客户的底线。）');
process.exit(strict ? 1 : 0);
