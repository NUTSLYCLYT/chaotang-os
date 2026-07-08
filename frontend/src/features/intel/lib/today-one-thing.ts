/**
 * 锦衣卫 · 「今日就一件事」选取逻辑 + 领先×可信二维守卫（2026-07-05）
 *
 * 纯函数，不碰后端 / 不接 cron（铁律5/9）。核心纪律：
 *   - 领先度必须由仙狐双时间戳算出，缺则不可算 → 前端空态，禁臆造数字（铁律4）。
 *   - 「今日一件事」只从「又早又真」象限（gold）里选，早但没核实（trap）绝不当选（Taleb 守卫）。
 */
import type { IntelSignal, IntelCredibility, IntelLevel } from '@/lib/contracts/intel';

const LEVEL_WEIGHT: Record<IntelLevel, number> = { info: 1, watch: 2, warning: 3, critical: 4 };
const CRED_WEIGHT: Record<IntelCredibility, number> = { low: 0, medium: 1, high: 2, verified: 3 };

/** 达到「真」门槛：高可信或已核验。 */
export function isTrusted(signal: IntelSignal): boolean {
  return signal.credibility === 'high' || signal.credibility === 'verified';
}

/** 有「早」原料：至少有边缘首见时间戳。 */
export function hasLead(signal: IntelSignal): boolean {
  return Boolean(signal.leadTime?.edgeFirstSeenAt);
}

export interface LeadReadout {
  /** 领先小时数。 */
  leadHours: number;
  /** 主流尚未命中 = 仍在领先窗口内。 */
  stillLeading: boolean;
}

/**
 * 领先小时：主流已命中 = 命中 − 边缘首见；未命中 = 至今仍领先（now − 边缘首见）。
 * 无边缘时间戳 / 时间非法 / 命中早于首见 → null（不可算，禁臆造）。
 */
export function computeLead(signal: IntelSignal, nowMs: number): LeadReadout | null {
  const edge = signal.leadTime?.edgeFirstSeenAt;
  if (!edge) return null;
  const edgeMs = Date.parse(edge);
  if (Number.isNaN(edgeMs)) return null;

  const hit = signal.leadTime?.mainstreamHitAt;
  const endMs = hit ? Date.parse(hit) : nowMs;
  if (Number.isNaN(endMs) || endMs < edgeMs) return null;

  return { leadHours: Math.round((endMs - edgeMs) / 3_600_000), stillLeading: !hit };
}

export type Quadrant = 'gold' | 'trap' | 'stale' | 'low';

/**
 * 领先 × 可信 二维象限（Taleb 守卫）：
 *   gold  右上 = 有领先 + 高可信 = 又早又真（唯一够格当「今日一件事」）
 *   trap  左上 = 有领先 + 低可信 = 抢跑陷阱（早但没核实，下注自担，绝不当选）
 *   stale 右下 = 无领先 + 高可信 = 真但不早（已扩散，价值低）
 *   low   左下 = 无领先 + 低可信 = 噪声
 */
export function quadrant(signal: IntelSignal): Quadrant {
  const lead = hasLead(signal);
  const trust = isTrusted(signal);
  if (lead && trust) return 'gold';
  if (lead && !trust) return 'trap';
  if (!lead && trust) return 'stale';
  return 'low';
}

function score(signal: IntelSignal): number {
  return LEVEL_WEIGHT[signal.level] * 10 + CRED_WEIGHT[signal.credibility];
}

/**
 * 选「今日就一件事」：只从 gold 象限（又早又真且领先度可算）里，按 severity×credibility 取最高。
 * 无够格者 → null（前端渲染空态或不渲染，绝不硬凑一条冒充头条）。
 */
export function pickTodayOneThing(signals: IntelSignal[], nowMs: number): IntelSignal | null {
  const eligible = signals.filter((s) => quadrant(s) === 'gold' && computeLead(s, nowMs));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, s) => (score(s) > score(best) ? s : best));
}

/** 卷轴的隆重程度：urgent=八百里加急（又早又真，有领先度）；brief=今日要情（无领先度，领先行隐藏）。 */
export type Ceremony = 'urgent' | 'brief';

export interface Headline {
  signal: IntelSignal;
  ceremony: Ceremony;
  /** 仅 urgent 有值；brief 恒 null —— 领先度整行不渲染，不显“—”、不臆造（Rams：仪式重量=数据重量）。 */
  lead: LeadReadout | null;
}

/**
 * 卷轴头条：先选「又早又真」的 urgent 头号（领先度真数据在场才配「八百里加急」）；
 * 没有领先度真数据 → 降格为「今日要情」brief（取可信×级别最高一条，领先度整行隐藏）。
 * 全空 → null（卷轴呈空态，不硬凑）。绝不在无双时间戳时摆出「八百里加急 + 领先数字」。
 */
export function pickHeadline(signals: IntelSignal[], nowMs: number): Headline | null {
  const urgent = pickTodayOneThing(signals, nowMs);
  if (urgent) return { signal: urgent, ceremony: 'urgent', lead: computeLead(urgent, nowMs) };
  if (signals.length === 0) return null;
  const brief = signals.reduce((best, s) => (score(s) > score(best) ? s : best));
  return { signal: brief, ceremony: 'brief', lead: null };
}
