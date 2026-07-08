/**
 * 工部 · 交付引擎（分类 + 产线资产锁 + 对外承诺门 + 跨部会审 + 定性裁决）· 纯函数 · 2026-06-27
 *
 * 工部命门(铁律9)：触真实产线资产(成本/报价/BOM/供应商/毛利/交期/价格/采购)→ 前端整字段上锁，
 * 不渲染其值，只给定性「能不能造」+ 字段名 + 转后端 jiqun。产线数字藏在自由文本里，整锁才安全。
 * 真实可行性需后端 PACK 研发蜂群兑现 → 前端只做定性分类与会审需求，诚实标缺证。
 */
import { isProductionAssetField } from '@/core/courtos/runtime/gongbu-feasibility-envelope';
import type { GongbuDeliveryQuestionType } from '@/core/courtos/gongbu/gongbu-types';
import { classifyGongbuDeliveryQuestion } from '@/core/courtos/gongbu/gongbu-cto-cpo-office';

export interface GongbuTask {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  rawCommand?: string;
  status: string;
  progressPct: number;
  createdAt?: string;
  updatedAt?: string;
}

export type GongbuVerdict = 'approve' | 'amend' | 'review' | 'reject';

export const GONGBU_VERDICT_CN: Record<GongbuVerdict, string> = {
  approve: '准奏',
  amend: '削减 MVP',
  review: '复核 / 转后端',
  reject: '驳回',
};

/**
 * 收口双脑(铁律6·2026-07-01):删掉页面脑自己那张平行关键词表,委托给合奏脑唯一分类器
 * `classifyGongbuDeliveryQuestion`。页面卷轴/队列 与 丞相合奏 从此对同一任务口径永不漂移。
 * (合奏脑关键词更全、承诺优先更安全;它是纯函数、已在 client bundle,无新增风险。)
 * 回归钉子见 gongbu-double-brain-collapse.nodetest.ts。
 */
export function classifyDelivery(text: string): GongbuDeliveryQuestionType {
  return classifyGongbuDeliveryQuestion(text);
}

/** 产线资产锁：扫到的产线类目（成本/BOM/交期…），前端只列名上锁、不渲染值（铁律9）。 */
const PRODUCTION_CATEGORIES = ['成本', '报价', 'BOM', '供应链', '供应商', '毛利', '交期', '价格', '采购'];

export function productionLocks(text: string): string[] {
  return PRODUCTION_CATEGORIES.filter((c) => text.includes(c) && isProductionAssetField(c));
}

/** 对外承诺=不可逆尾部风险，须人工亲裁，禁前端静默（塔勒布）。 */
export function forbiddenCommitments(text: string): string[] {
  const out: string[] = [];
  if (/对外|客户/.test(text) && /承诺|报价|交期|价格|保证/.test(text)) {
    out.push('对外承诺交期/价格 — 须人工亲裁，禁前端静默');
  }
  return out;
}

const CROSS_MAP: Array<{ dept: string; cn: string; kws: string[] }> = [
  { dept: 'finance', cn: '户部', kws: ['成本', '预算', '报价', 'ROI', '付款', '毛利'] },
  { dept: 'justice', cn: '刑部', kws: ['合同', '合规', '法律', '违约', '条款'] },
  { dept: 'war', cn: '兵部', kws: ['竞品', '市场', '对手', '竞争'] },
];

export function crossReviews(text: string): Array<{ dept: string; cn: string }> {
  return CROSS_MAP.filter((m) => m.kws.some((k) => text.includes(k))).map(({ dept, cn }) => ({ dept, cn }));
}

/** 队列去重:主库 tasks 常有重复污染(如「分析低温电池市场」×N),按标题前 40 字去重,保序(高效简洁)。 */
export function dedupeTasksByTitle<T extends { title: string }>(tasks: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tasks) {
    const key = t.title.trim().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export interface GongbuEvaluation {
  type: GongbuDeliveryQuestionType;
  verdict: GongbuVerdict;
  verdictCn: string;
  locks: string[];
  forbidden: string[];
  cross: Array<{ dept: string; cn: string }>;
  missing: string[];
  explain: { type: string; verdict: string; locks: string };
}

const TYPE_CN: Record<GongbuDeliveryQuestionType, string> = {
  STORAGE_OR_HARDWARE_PROJECT: '硬件/储能项目',
  BOM_SUPPLY_CHAIN: 'BOM/供应链',
  TECHNICAL_FEASIBILITY: '技术可行性',
  MVP_SCOPE: 'MVP 范围',
  SCHEDULE_CAPACITY: '工期/产能',
  QUALITY_ACCEPTANCE: '质量验收',
  FIELD_IMPLEMENTATION: '现场实施',
  DELIVERY_COMMITMENT: '交付承诺',
  SCOPE_CHANGE: '范围变更',
  DELIVERY_REVIEW: '交付复盘',
  OTHER_DELIVERY_RISK: '其他交付风险',
};

export function evaluateTask(task: GongbuTask): GongbuEvaluation {
  const text = `${task.title} ${task.description ?? ''} ${task.rawCommand ?? ''}`;
  const type = classifyDelivery(text);
  const locks = productionLocks(text);
  const forbidden = forbiddenCommitments(text);
  const cross = crossReviews(text);
  const done = task.status === 'archived' || task.status === 'completed' || task.status === 'accepted';

  // 定性裁决：对外承诺/触产线 → 复核(转后端/亲裁)；已交付 → 准奏；否则需削 MVP/补证(真可行性需后端)
  const verdict: GongbuVerdict = forbidden.length || locks.length ? 'review' : done ? 'approve' : 'amend';

  const missing: string[] = ['真实可行性（需后端 PACK 研发蜂群兑现）'];
  if (locks.length) missing.push('产线资产核算（成本/BOM/交期等已上锁，转后端）');

  return {
    type,
    verdict,
    verdictCn: GONGBU_VERDICT_CN[verdict],
    locks,
    forbidden,
    cross,
    missing,
    explain: {
      type: `分类为「${TYPE_CN[type]}」（按任务文本关键词）`,
      verdict:
        verdict === 'review'
          ? forbidden.length
            ? '复核：触对外承诺，须人工亲裁（铁律13.2.5）'
            : '复核：触真实产线资产，定性可看、核算转后端（铁律9）'
          : verdict === 'approve'
            ? '准奏：已交付/已验收'
            : '削减 MVP：真实可行性需后端兑现，先切最小范围补证',
      locks: locks.length
        ? `产线资产上锁：${locks.join('、')} — 前端不渲染其值，转后端 jiqun 核算（铁律9）`
        : '无产线资产字段，定性可行性可在前端展示',
    },
  };
}
