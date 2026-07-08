/**
 * 单部红蓝 Loop（Loop2）—— 主手 A(尚书:推进) × 副手 B(侍郎:挑战) → 综合 → 裁断 → RedBlueCard。
 *
 * 用户定调：红蓝 = 主副手两 agent，不堆蜂群。当前用 mock 启发式（不接真实 LLM）；
 * 真实接线后把 mock 换成两次 AgentHarness 调用(A/B)即可，RedBlueCard 形状不变。
 * 纯函数，无 @/ 运行时依赖 → 可离线单测。
 */
import type {
  MinistryId,
  MinistrySignal,
  MinistryVerdict,
  RedBlueCard,
} from './ministry-types.ts';
import type { SourceLabel, RiskLevel } from '../types';
import { MINISTRY_REGISTRY } from './ministry-registry.ts';

export interface RedBlueInput {
  taskId: string;
  ministryId: MinistryId;
  /** 任务文本（问题 + 拟旨）。 */
  text: string;
  /** 已知缺证（来自证据检查）。 */
  missingEvidence?: string[];
  sourceLabel?: SourceLabel;
}

export function signalToVerdict(s: MinistrySignal): MinistryVerdict {
  switch (s) {
    case 'GREEN': return 'APPROVE';
    case 'YELLOW': return 'NEED_EVIDENCE';
    case 'GRAY': return 'NEED_EVIDENCE';
    case 'RED': return 'RECHECK';
  }
}

interface Heuristic {
  signal: MinistrySignal;
  riskLevel: RiskLevel;
  needsHumanConfirmation: boolean;
  challenge: string;
  risks: string[];
  missing: string[];
  conditions: string[];
}

/** 每部 mock 启发式（对应 PRD/spec 的红黄灯规则）。 */
function heuristic(id: MinistryId, text: string, missing: string[]): Heuristic {
  const has = (...kws: string[]) => kws.some((k) => text.includes(k));
  const base = { risks: [] as string[], missing: [...missing], conditions: [] as string[] };

  switch (id) {
    case 'justice':
      if (has('合同', '股权', '独家', '预付款', '违约', '对外报价', '保证收益')) {
        return { ...base, signal: 'RED', riskLevel: 'high', needsHumanConfirmation: true,
          challenge: '涉合同/股权/付款等不可逆条款，未经法务核验不得推进',
          risks: ['不可逆法律/财务责任', '红线条款风险'],
          conditions: ['法务尽调通过', '人工签字确认'] };
      }
      return { ...base, signal: 'YELLOW', riskLevel: 'medium', needsHumanConfirmation: false,
        challenge: '需确认是否触及合规红线', risks: ['潜在合规风险'], conditions: ['补合规审查'] };
    case 'finance':
      if (missing.length || !has('ROI', '回本', '现金', '预算')) {
        return { ...base, signal: missing.length ? 'GRAY' : 'YELLOW', riskLevel: 'medium',
          needsHumanConfirmation: has('大额', '重投入', '预付款'),
          challenge: 'ROI/现金流/付款节点证据不足，无法判断财务可行性',
          risks: ['ROI 不成立风险', '现金流压力'],
          missing: [...new Set([...missing, '报价', 'ROI 假设', '付款节点'])],
          conditions: ['补全收益模型与现金流'] };
      }
      return { ...base, signal: 'GREEN', riskLevel: 'low', needsHumanConfirmation: false,
        challenge: '财务参数基本齐备', risks: [], conditions: [] };
    case 'works':
      if (has('储能', '设备', '施工', '交付') && (missing.length || !has('BOM', '验收', '交期'))) {
        return { ...base, signal: 'YELLOW', riskLevel: 'medium', needsHumanConfirmation: false,
          challenge: '缺 BOM/交期/验收标准，不能承诺固定交付',
          risks: ['交付不可行风险', '供应链缺口'],
          missing: [...new Set([...missing, 'BOM', '交期', '验收标准'])],
          conditions: ['补 BOM 与交期', '定验收标准'] };
      }
      return { ...base, signal: 'GREEN', riskLevel: 'low', needsHumanConfirmation: false,
        challenge: '交付条件基本明确', risks: [], conditions: [] };
    case 'ritual':
      if (has('保证收益', '稳赚', '零风险')) {
        return { ...base, signal: 'RED', riskLevel: 'high', needsHumanConfirmation: true,
          challenge: '对外话术含"保证收益"等越界表述，违反合规口径',
          risks: ['品牌/合规风险', '客户误解'], conditions: ['改为合规话术'] };
      }
      return { ...base, signal: 'YELLOW', riskLevel: 'low', needsHumanConfirmation: false,
        challenge: '对外口径需审查', risks: ['表达越界风险'], conditions: ['过礼部话术审查'] };
    case 'war':
      return { ...base, signal: has('客户', '试点', '决策链') ? 'YELLOW' : 'GRAY', riskLevel: 'medium',
        needsHumanConfirmation: false,
        challenge: '缺客户决策链/预算确认/试点路径，机会成色待验',
        risks: ['伪机会风险', '竞争劣势'],
        missing: [...new Set([...missing, '客户决策链', '试点路径'])],
        conditions: ['确认客户决策链与预算'] };
    case 'personnel':
      if (!has('负责人', 'DRI', '里程碑')) {
        // 修 RED-bias(2026-06-24 · decision-eval 抓出):缺 DRI 是"信息不足"(GRAY/补证),
        // 不是"红旗否决"(RED)。咨询型问题几乎都没写 DRI,旧版默认 RED → 总灯永远红、无判别力。
        // RED 只留给真红旗(法律责任/不可逆大额,见 justice/finance)。
        return { ...base, signal: 'GRAY', riskLevel: 'low', needsHumanConfirmation: false,
          challenge: '尚未明确第一责任人/执行节奏，需补全后再推进(非否决)',
          risks: ['责任未落实'],
          missing: [...new Set([...missing, '第一责任人(DRI)', '协同部门', '时间节点'])],
          conditions: ['指定 DRI', '排 7/30/90 天计划'] };
      }
      return { ...base, signal: 'GREEN', riskLevel: 'low', needsHumanConfirmation: false,
        challenge: '责任与节奏基本明确', risks: [], conditions: [] };
  }
}

/** 跑一部红蓝对抗，产出 RedBlueCard。 */
export function runRedBlueLoop(input: RedBlueInput): RedBlueCard {
  const meta = MINISTRY_REGISTRY[input.ministryId];
  const missing = input.missingEvidence ?? [];
  const h = heuristic(input.ministryId, input.text, missing);
  // 诚实标源(2026-06-24 · 修缺口#2 / 铁律3 · 停止 LIVE 撒谎):
  // 本红蓝卡是确定性 heuristic() 规则推断,**不是真 LLM/真 agent 推理**。无论外层意图/报告
  // 是否 LIVE,本部审只能标 FALLBACK(规则兜底级),绝不继承外层 LIVE 冒充真推理。
  // 待"打穿一部真 agent"(缺口#3)后,该部真 LLM 路径才在此设 LIVE。
  const sourceLabel: SourceLabel = 'FALLBACK';
  void input.sourceLabel; // 保留入参(未来真 agent 模式用);当前规则路径不据它标 LIVE。
  const confidence = h.signal === 'GREEN' ? 0.8 : h.signal === 'YELLOW' ? 0.55 : h.signal === 'GRAY' ? 0.4 : 0.6;

  return {
    ministryId: input.ministryId,
    taskId: input.taskId,
    mainThesis: `${meta.nameCn}主手(A)：从「${meta.mission.split('、')[0]}」角度，本案存在可推进价值，主张在满足条件下推进。`,
    mainPlan: `按${meta.nameCn}职责给出推进路径，待副手挑战与证据校验。`,
    deputyChallenge: `${meta.nameCn}副手(B)：${h.challenge}`,
    deputyRisks: h.risks,
    disputeFocus: h.risks[0] ?? '推进价值 vs 证据/风险充分性',
    synthesis: `综合 A/B：${h.signal === 'GREEN' ? '分歧小，条件基本满足' : '副手挑战成立，需先消解风险/补证再推进'}。`,
    ruling: `${meta.nameCn}尚书裁断：${h.signal === 'RED' ? '暂不放行' : h.signal === 'GREEN' ? '可放行' : '有条件/补证后放行'}。`,
    signal: h.signal,
    verdict: signalToVerdict(h.signal),
    conditionsToProceed: h.conditions,
    missingEvidence: h.missing,
    needsHumanConfirmation: h.needsHumanConfirmation,
    riskLevel: h.riskLevel,
    sourceLabel,
    confidence,
  };
}
