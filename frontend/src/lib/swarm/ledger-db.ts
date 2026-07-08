/**
 * ledger-db —— 台账专用库解析器（给飞轮/浓度场/决策台账通电，且不污染生产）。
 *
 * 为什么单独搞：主 getDb() 的 Turso 在 dev 走 fallback 不可写 → 所有台账静默失败、飞轮空转。
 * 台账表(agent_decisions/conflict_field/boss_decisions/boss_preferences)是自包含的、不和别的表 join，
 * 所以可以安全地用一个独立 DB：
 *   - 优先用 LEDGER_DB_URL，否则主 TURSO_DB_URL；探测 `SELECT 1`，能写就用它。
 *   - 探测失败【且非生产】→ 回落本地 file:./.chaotang-ledger.db（dev 立刻可写，飞轮转起来）。
 *   - 生产(NODE_ENV=production)【不回落】：宁可显式失败也不静默写到易失的本地文件（别掩盖 prod DB 故障）。
 *
 * 隔离设计：只有台账模块用它；app 其余部分继续用 getDb()，零影响。
 */

import { createClient, type Client } from '@libsql/client';
import { logger } from '@/lib/logger';

// 按环境分库（dev/prod 各一个文件，互不污染、无并发锁竞争）。本部署是单节点持久磁盘，
// 文件库可安全跨请求/重启持久——故 prod 也兜底（要云级复制/备份再接 LEDGER_DB_URL=真 Turso）。
const ENV = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const FALLBACK_FILE = `file:./.chaotang-ledger-${ENV}.db`;
let cached: Client | null = null;
let usingFallback = false;

function make(url: string): Client {
  return url.startsWith('file:')
    ? createClient({ url })
    : createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

/**
 * 解析台账库：优先 LEDGER_DB_URL / TURSO_DB_URL（探测可写），否则文件兜底。
 * 永不抛错——总返回一个可写库，并把"在用哪个"通过 ledgerUsingFallback() 暴露（绝不静默）。
 */
export async function ledgerDb(): Promise<Client> {
  if (cached) return cached;
  const primary = process.env.LEDGER_DB_URL || process.env.TURSO_DB_URL || '';

  if (primary) {
    try {
      const c = make(primary);
      await c.execute('SELECT 1'); // 可写探测
      cached = c;
      usingFallback = false;
      return cached;
    } catch (e) {
      logger.warn('[ledger-db] 主库不可达 → 文件兜底', { file: FALLBACK_FILE, env: ENV, reason: String(e) });
    }
  }

  cached = createClient({ url: FALLBACK_FILE });
  usingFallback = true;
  logger.warn('[ledger-db] 使用文件兜底库（非云 Turso，单节点持久）', { file: FALLBACK_FILE, env: ENV });
  return cached;
}

/** 当前是否在用文件兜底（健康端点用，让"在用哪个库"可见）。 */
export function ledgerUsingFallback(): boolean {
  return usingFallback;
}

/** 当前实际在用的库标识（turso vs 具体文件），给健康端点显示——绝不让标签骗人。 */
export function ledgerSource(): string {
  return usingFallback ? FALLBACK_FILE : 'turso';
}
