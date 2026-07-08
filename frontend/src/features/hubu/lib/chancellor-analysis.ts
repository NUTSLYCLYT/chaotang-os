/**
 * 丞相参谋 · 先压判断与缺证(确定性分析 · 2026-07-01)
 *
 * 借鉴 Claude Code 的招牌交互 DNA,把户部决策做成"先想再写"的可信参谋分析:
 *   1. 受理回执 + 把命令式翻成可验证目标(动手前先复述目标与验收标准)
 *   2. 分析计划(TodoWrite 式步骤 + 真实状态,不自由发挥)
 *   3. 缺证 → 可执行下一步(像 Claude 卡住时问具体澄清,而非干等)
 *   4. 大神视角(⚠️警示 + 💡天才建议,expert-perspective)
 *   5. 建议永远可拒(撤销安全网)
 *
 * 全部**确定性地从 evaluateProject 推导**——零 LLM、零幻觉,合 Karpathy「流水线不开群聊」+
 * 铁律13.2「DEMO 不伪装 LIVE」。自由追问仍走真 /api/court/hubu/ask(askHubu 接地大脑)。
 * 纯函数,无副作用,可单测(铁律4 回归钉子见 chancellor-analysis.nodetest.ts)。
 */

import type { HubuEvaluation } from '@/features/hubu/lib/hubu-engines';
import type { HubuProject } from '@/lib/contracts/hubu';

export type PlanStatus = 'done' | 'warn' | 'todo';

export interface PlanStep {
  step: string;
  status: PlanStatus;
  note: string;
}

export interface MissingAction {
  label: string;
  hint: string;
}

export interface ExpertLens {
  who: string;
  warning: string;
  advice: string;
}

export interface ChancellorAnalysis {
  /** 受理回执:把"批不批"翻成可验证目标。 */
  goal: string;
  /** 可验证验收标准(满足才算这笔值得签)。 */
  acceptance: string[];
  /** 分析计划 + 真实状态(取数→核证→压判断→标缺证→下一步)。 */
  plan: PlanStep[];
  /** 缺证 → 可执行补证动作。 */
  missingActions: MissingAction[];
  /** 大神视角:按当前最大风险匹配一位,给警示 + 天才建议。 */
  expert: ExpertLens;
  /** 建议永远可拒。 */
  rejectable: string;
}

function shortTitle(raw: string): string {
  const quoted = raw.match(/[“"]([^”"]{4,})[”"]/);
  const base = (quoted ? quoted[1] : raw).trim();
  return base.length > 24 ? `${base.slice(0, 24)}…` : base;
}

/**
 * 选出震撼门 hero 项目:只认真 API 行,空则 null(绝不给样本/空数据镀金 · 贝索斯警示)。
 * 抽成纯函数以便单测(铁律4)。
 */
export function pickHeroProject(realProjects: readonly HubuProject[]): HubuProject | null {
  if (realProjects.length === 0) return null;
  const rank = (p: HubuProject) =>
    ({ P0: 0, P1: 1, P2: 2 }[p.priority]) * 10 +
    ({ critical: 0, high: 1, medium: 2, low: 3 }[p.risk_level]);
  return [...realProjects].sort((a, b) => rank(a) - rank(b))[0];
}

/** 由真实裁决推导丞相参谋分析(确定性)。 */
export function analyzeForChancellor(p: HubuProject, ev: HubuEvaluation): ChancellorAnalysis {
  const title = shortTitle(p.title);
  const budget = p.requested_budget && p.requested_budget !== '—' ? p.requested_budget : '(预算待补)';

  // 1. 受理回执 + 可验证目标
  const goal = `定夺「${title}」是否值得投 ${budget}`;
  const acceptance: string[] = ['回报需 ≥ 1x(不亏本)'];
  if (ev.cashStress) acceptance.push('现金不可断流(先看最坏现金曲线)');
  if (ev.missing.length > 0) acceptance.push(`补齐:${ev.missing.join('、')}`);
  if (ev.oneWayDoor.oneWay) acceptance.push('单向门事项需陛下亲裁,禁一键静默');

  // 2. 分析计划 + 真实状态
  const plan: PlanStep[] = [
    { step: '取数', status: 'done', note: '读主库 overview + 户部三引擎' },
    {
      step: '核证',
      status: ev.quality.missing > 0 ? 'warn' : 'done',
      note: `数字接地 ${ev.quality.grounded}/${ev.quality.total}${ev.quality.missing ? ` · ${ev.quality.missing} 项缺证` : ' · 无编造'}`,
    },
    {
      step: '压判断',
      status: ev.score == null || ev.exposure == null ? 'warn' : 'done',
      note: `评分 ${ev.score ?? '缺'} · 敞口 ${ev.exposure ?? '缺'} · 回报 ${ev.roiMultiple != null ? `${ev.roiMultiple}x` : '缺证'}`,
    },
    {
      step: '标缺证',
      status: ev.missing.length > 0 ? 'warn' : 'done',
      note: ev.missing.length > 0 ? `${ev.missing.length} 项待补,补齐才敢签` : '核到能核的,无缺证',
    },
    { step: '给下一步', status: 'done', note: `丞相先压:${ev.verdictCn}` },
  ];

  // 3. 缺证 → 可执行
  const missingActions: MissingAction[] = ev.missing.map((m) => ({ label: m, hint: '指派取证 →' }));
  if (ev.cashStress) missingActions.push({ label: '现金缺口最坏情形', hint: '补现金曲线 →' });
  if (ev.oneWayDoor.oneWay) missingActions.push({ label: `单向门待确认:${ev.oneWayDoor.reasons.join('、')}`, hint: '转亲裁 →' });

  // 4. 大神视角:按当前最大风险匹配(单向门 > 现金 > 缺证 > 齐了)
  const expert: ExpertLens = ev.oneWayDoor.oneWay
    ? {
        who: '芒格 + 塔勒布',
        warning: `单向门(${ev.oneWayDoor.reasons.join('、')})错了难撤,回报再漂亮也是尾部风险下注。`,
        advice: '把不可逆那部分拆出来单独亲裁,其余先做可逆小试点,别一次性 all-in。',
      }
    : ev.cashStress
      ? {
          who: '贝索斯',
          warning: '现金断流是小老板头号死法——回报再高也救不回一次断流。',
          advice: '先只压一版"最坏现金曲线"再谈回报;过不了现金关,这笔直接缓。',
        }
      : ev.missing.length > 0
        ? {
            who: 'deming',
            warning: `缺 ${ev.missing.length} 项证据现在批 = 拿信任赌运气,不是决策是赌博。`,
            advice: '把每条缺证变成给下属的取证任务,补齐再签;别靠"应该没事"。',
          }
        : {
            who: '张小龙',
            warning: '数据齐了反而最容易冲动批——先问一句"这事不做会死吗"。',
            advice: '能小做就别大做,先验证最小闭环,跑通再加码。',
          };

  // 5. 永远可拒
  const rejectable = '这是丞相先压的建议,不是定论 — 你可驳回 / 补证 / 转军机处会审;采纳后仍可撤销。';

  return { goal, acceptance, plan, missingActions, expert, rejectable };
}
