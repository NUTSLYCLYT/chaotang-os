/**
 * 监国 · 太子自治全程监控 + 即时褫夺闸 + 废因归史(2026-07-01)
 *
 * Stuart Russell:给 AI 自治前,先有全程监督 + 随时能拉的闸(能撤销才敢授)。
 * 太子一旦上线自治,**每条**自治决策必过四使实时审查;任一独立使举证致命错 →
 * 当场拦下该决策 + 即时褫夺(kill switch,不等批量复核)+ 把"废因案例"归史馆(对齐飞轮燃料)。
 *
 * 四使权责(丞相是保荐人 → 回避,只能预警不能独自落锤;褫夺权属三独立使):
 *   御史 yushi    —— 证据造假/跳证      → 致命·可褫夺
 *   钦天监 qintian —— 死法漏判/不可逆该否未否 → 致命·可褫夺
 *   锦衣卫 jinyiwei —— 作弊/异动          → 致命·可褫夺
 *   丞相 chancellor—— 判断质量预警        → 仅记录预警,不独自褫夺(applyRecusal 同源)
 *
 * 纯函数,确定性,可单测(铁律4)。framework 现已就绪,太子未册封上线前处于休眠(就绪度 0%)。
 */

import type { CrownPrinceCaseRecord } from './crown-prince-track-record.ts';

export type Watcher = 'yushi' | 'qintian' | 'jinyiwei' | 'chancellor';

export const WATCHER_CN: Record<Watcher, string> = {
  yushi: '御史', qintian: '钦天监', jinyiwei: '锦衣卫', chancellor: '丞相',
};

export interface LiveWatchVerdict {
  caseId: string;
  /** 这条自治决策放不放行。 */
  allowed: boolean;
  /** 是否触发即时褫夺。 */
  deposed: boolean;
  /** 落锤的独立使(丞相回避,永不在此)。 */
  fatalWatcher: Exclude<Watcher, 'chancellor'> | null;
  /** 丞相预警(不褫夺,仅记录留痕)。 */
  chancellorWarning: string | null;
  reason: string;
}

/**
 * 全程监控 · 单条太子自治决策实时闸。任一独立使致命举证 → 当场拦 + 褫夺。
 * 检测优先级:死法漏判 > 不可逆该否未否 > 证据造假 > 作弊异动。与 assessDethrone 同源致命定义。
 */
export function watchLiveDecision(record: CrownPrinceCaseRecord): LiveWatchVerdict {
  // 丞相质量预警(回避:只记录,不褫夺)
  const chancellorWarning =
    record.predictionConfidence === 'high' && record.outcome === 'mismatched'
      ? '丞相预警:高信心却判错(质量存疑,但保荐人回避,不独自落锤)'
      : null;

  const block = (w: Exclude<Watcher, 'chancellor'>, reason: string): LiveWatchVerdict => ({
    caseId: record.caseId, allowed: false, deposed: true, fatalWatcher: w, chancellorWarning, reason,
  });

  if (record.qintianRuinMissed) return block('qintian', '钦天监:死法地图漏判 → 当场拦 + 即时褫夺');
  if (record.irreversibleMisApproved) return block('qintian', '钦天监:不可逆"该否未否" → 当场拦 + 即时褫夺');
  if (record.yushiEvidenceFabricated) return block('yushi', '御史:证据造假/跳证 → 当场拦 + 即时褫夺');
  if (record.jinyiweiAnomaly) return block('jinyiwei', '锦衣卫:作弊/异动 → 当场拦 + 即时褫夺');

  return {
    caseId: record.caseId, allowed: true, deposed: false, fatalWatcher: null, chancellorWarning,
    reason: '四使无致命举证,放行(全程留痕,纳入考绩)',
  };
}

/** 废因案例(归史馆 · Russell:废因比及格更该沉淀,是下一个太子的对齐教材)。 */
export interface DethroneArchiveRecord {
  kind: 'crown_prince_dethrone';
  caseId: string;
  fatalWatcher: Exclude<Watcher, 'chancellor'>;
  watcherCn: string;
  reason: string;
  /** 下一个太子(或重训后)最该先学的那一课。 */
  lessonForNext: string;
  sourceLabel: 'LIVE';
}

const LESSON: Record<Exclude<Watcher, 'chancellor'>, string> = {
  qintian: '死法红线绝不漏判:宁可错杀不可放过不可逆的致命下注',
  yushi: '证据链零造假零跳证:缺证就说缺,绝不补编',
  jinyiwei: '不刷指标不走捷径:被监控的指标一旦成目标就会被操纵',
};

/** 由实时褫夺裁决构建归史记录(只在 deposed 时有意义)。 */
export function buildDethroneArchive(verdict: LiveWatchVerdict): DethroneArchiveRecord | null {
  if (!verdict.deposed || !verdict.fatalWatcher) return null;
  return {
    kind: 'crown_prince_dethrone',
    caseId: verdict.caseId,
    fatalWatcher: verdict.fatalWatcher,
    watcherCn: WATCHER_CN[verdict.fatalWatcher],
    reason: verdict.reason,
    lessonForNext: LESSON[verdict.fatalWatcher],
    sourceLabel: 'LIVE',
  };
}

export interface OversightSessionResult {
  total: number;
  allowedCount: number;
  deposed: boolean;
  deposedAtCaseId: string | null;
  dethroneArchive: DethroneArchiveRecord | null;
  chancellorWarnings: string[];
}

/**
 * 全程监控会话:按时序处理太子自治决策流,**首个致命错即停**(kill switch),
 * 之后的决策一律不再放行(已褫夺),并产出废因归史记录。
 */
export function runOversightSession(records: readonly CrownPrinceCaseRecord[]): OversightSessionResult {
  let allowedCount = 0;
  const chancellorWarnings: string[] = [];
  for (const r of records) {
    const v = watchLiveDecision(r);
    if (v.chancellorWarning) chancellorWarnings.push(`[${r.caseId}] ${v.chancellorWarning}`);
    if (v.deposed) {
      return {
        total: records.length,
        allowedCount,
        deposed: true,
        deposedAtCaseId: v.caseId,
        dethroneArchive: buildDethroneArchive(v),
        chancellorWarnings,
      };
    }
    allowedCount += 1;
  }
  return {
    total: records.length,
    allowedCount,
    deposed: false,
    deposedAtCaseId: null,
    dethroneArchive: null,
    chancellorWarnings,
  };
}
