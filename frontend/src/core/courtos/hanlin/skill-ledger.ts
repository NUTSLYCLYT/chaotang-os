/**
 * 朝堂 OS · 翰林院核心原语「借调即真相 · 用过才入库」(server-safe 纯函数,零副作用)
 *
 * 设计依据:dev/notes/hanlin-design.md(Karpathy/张小龙/Bezos/Andrew Ng/Munger 一致)。
 * 武库永远建在使用的下游:没被真借调用过且被采纳过的 skill 不该进库。库靠借调流水自己保持精瘦。
 * 本模块只【判定】skill 该不该入库/退库、一条借调是否合法;不写库、不调模型、不给 skill 打"有用分"
 * (那是 agent 判 agent,违铁律6——评测唯一 ground truth 是真实 Loop 的采纳态,由上游反写)。
 */

export type SkillStatus = 'candidate' | 'incubating' | 'armory' | 'retired';
export type SkillOrigin = 'scout' | 'forge' | 'video';
export type BorrowOutcome = 'adopted' | 'discarded' | 'failed';

/** SSOT 注册表条目(全朝唯一真相源,禁各部私有副本)。 */
export interface SkillRegistryEntry {
  id: string;
  name: string;
  origin: SkillOrigin;
  status: SkillStatus;
  capabilityTags: string[];
  /** 被借调总次数 */
  usedCount: number;
  /** 借调后被用户采纳的次数(只采纳态反写,不由 skill 自评) */
  adoptedCount: number;
  /** 最后一次被借调的 epoch ms;从未借调=null */
  lastUsedAt: number | null;
  /** 是否已被某六部工位认领痛点(入库前置门槛) */
  painPointClaimed: boolean;
}

/** append-only 借调账一行。 */
export interface BorrowRecord {
  skillId: string;
  /** 借调方部门码(必须 ∈ 部门 SSOT 枚举) */
  callerDept: string;
  loopId: string;
  ts: number;
  outcome: BorrowOutcome;
}

/** 采纳率 = 被采纳次数 / 被借次数;从未借=0(不是 1,防"零样本伪满分")。 */
export function adoptedRate(entry: Pick<SkillRegistryEntry, 'usedCount' | 'adoptedCount'>): number {
  return entry.usedCount > 0 ? entry.adoptedCount / entry.usedCount : 0;
}

export interface PromoteThreshold {
  minUsed: number;
  minAdoptedRate: number;
}

const DEFAULT_PROMOTE: PromoteThreshold = { minUsed: 1, minAdoptedRate: 0.5 };

/**
 * 能否升入武库(armory):用过才入库。须同时——已认领痛点 + 当前 incubating + 被借≥minUsed + 采纳率达标。
 * used_count=0 永远不能 armory(杜绝"装了没人用"的死库存)。
 */
export function canPromoteToArmory(
  entry: SkillRegistryEntry,
  threshold: PromoteThreshold = DEFAULT_PROMOTE,
): { ok: boolean; reason: string } {
  if (entry.status !== 'incubating') return { ok: false, reason: `须 incubating 态(当前 ${entry.status})` };
  if (!entry.painPointClaimed) return { ok: false, reason: '无六部认领痛点,不入库' };
  if (entry.usedCount < threshold.minUsed) return { ok: false, reason: `用过才入库:被借 ${entry.usedCount}<${threshold.minUsed}` };
  const rate = adoptedRate(entry);
  if (rate < threshold.minAdoptedRate) return { ok: false, reason: `采纳率 ${rate.toFixed(2)}<${threshold.minAdoptedRate}` };
  return { ok: true, reason: `被借 ${entry.usedCount} 次、采纳率 ${rate.toFixed(2)},可升武库` };
}

/** 90 天零借调自动下架(归档不删,可复活)。 */
export const DEFAULT_STALE_DAYS = 90;

export function shouldRetire(
  entry: SkillRegistryEntry,
  nowMs: number,
  staleDays: number = DEFAULT_STALE_DAYS,
): { ok: boolean; reason: string } {
  if (entry.status !== 'armory') return { ok: false, reason: '仅 armory 态参与货架租金淘汰' };
  if (entry.lastUsedAt === null) {
    return { ok: true, reason: '入库即从未被借,死库存,退役' };
  }
  const idleDays = (nowMs - entry.lastUsedAt) / 86_400_000;
  return idleDays > staleDays
    ? { ok: true, reason: `${Math.floor(idleDays)} 天零借调>${staleDays},退役` }
    : { ok: false, reason: `${Math.floor(idleDays)} 天内有借调,留库` };
}

/**
 * 校验一条借调合法:借调方 ∈ 部门 SSOT 枚举 且 skillId ∈ registry。
 * 不匹配一律 fail-fast,禁静默回退(铁律2:防孤儿边/平行 map)。
 */
export function validateBorrow(
  record: BorrowRecord,
  registryIds: ReadonlySet<string>,
  validDeptCodes: ReadonlySet<string>,
): { valid: boolean; error?: string } {
  if (!validDeptCodes.has(record.callerDept)) {
    return { valid: false, error: `借调方 "${record.callerDept}" 不在部门 SSOT 枚举,拒(铁律2 fail-fast)` };
  }
  if (!registryIds.has(record.skillId)) {
    return { valid: false, error: `skillId "${record.skillId}" 不在 registry,禁硬编路径(拒)` };
  }
  return { valid: true };
}
