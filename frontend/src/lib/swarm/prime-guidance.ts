import type { RouteResult } from './router';

export interface PrimeGuidance {
  shouldGuide: boolean;
  trigger: 'none' | 'too_short' | 'vague' | 'brain_fog' | 'all_in' | 'release' | 'high_risk';
  contextBasis: string[];
  gaps: string[];
  suggestedPrompt: string | null;
}

const VAGUE_WORDS = ['优化', '完善', '搞好', '看看', '处理一下', '弄一下', '安排一下'];
const BRAIN_FOG_WORDS = ['脑雾', '乱了', '找回上下文', '确认主线', '偏主线', '忘了'];
const ALL_IN_WORDS = ['全做', '全部做', '都做', '一把梭'];
const RELEASE_WORDS = ['上线', '发布', '部署', '生产', '发版', '交付'];
const HIGH_RISK_WORDS = ['删库', '删除数据', '转账', '付款', '法务', '合规', '裁员', '投资建议', '金融建议'];

function includesAny(command: string, words: string[]): boolean {
  return words.some((word) => command.includes(word));
}

function hasEvidenceSignal(command: string): boolean {
  return /验收|证据|截图|日志|测试|build|typecheck|回滚|P0|P1|P2/i.test(command);
}

function firstTrigger(command: string): PrimeGuidance['trigger'] {
  if (command.length < 8) return 'too_short';
  if (includesAny(command, BRAIN_FOG_WORDS)) return 'brain_fog';
  if (includesAny(command, ALL_IN_WORDS)) return 'all_in';
  if (includesAny(command, RELEASE_WORDS)) return 'release';
  if (includesAny(command, HIGH_RISK_WORDS)) return 'high_risk';
  if (includesAny(command, VAGUE_WORDS) && !hasEvidenceSignal(command)) return 'vague';
  return 'none';
}

function triggerLabel(trigger: PrimeGuidance['trigger']): string {
  const labels: Record<PrimeGuidance['trigger'], string> = {
    none: '无需引导',
    too_short: '输入过短',
    vague: '输入空泛',
    brain_fog: '脑雾/主线恢复',
    all_in: '全做/范围不明',
    release: '上线/交付高风险',
    high_risk: '高风险/不可逆',
  };
  return labels[trigger];
}

export function assessPrimeGuidance(command: string, route?: RouteResult): PrimeGuidance {
  const normalized = String(command ?? '').trim();
  const trigger = firstTrigger(normalized);
  const contextBasis = [
    `丞相收到原始旨意：${normalized.slice(0, 80) || '空'}`,
    route
      ? `确定性路由召集：${route.departments.join('、')}；命中：${
          Object.entries(route.matched)
            .map(([dept, hits]) => `${dept}:${hits.join('/')}`)
            .join('；') || '无关键词命中'
        }`
      : '全蜂群密旨：不走关键词路由，直接召集全司',
    `触发判断：${triggerLabel(trigger)}`,
  ];

  const gaps: string[] = [];
  if (trigger === 'too_short') gaps.push('目标过短，无法判断真实结果');
  if (trigger === 'vague') gaps.push('缺少可观察验收标准');
  if (trigger === 'brain_fog') gaps.push('需要先恢复主线和当前证据');
  if (trigger === 'all_in') gaps.push('范围过大，需要拆 P0/P1/P2');
  if (trigger === 'release') gaps.push('上线任务需要 QA、安全、回滚和证据');
  if (trigger === 'high_risk') gaps.push('高风险任务需要人工确认和不可逆闸门');
  if (!hasEvidenceSignal(normalized)) gaps.push('未看到证据要求，如测试、截图、日志或验收');

  const shouldGuide = trigger !== 'none';
  const suggestedPrompt = shouldGuide
    ? [
        '我基于这些上下文判断：',
        ...contextBasis.map((item) => `- ${item}`),
        '',
        '更好的说法：',
        `请先把「${normalized || '这件事'}」收束成可执行命令：明确要做什么、不做什么、怎么算完成、下一步先做什么；${
          trigger === 'all_in' || trigger === 'release' ? '先拆 P0/P1/P2，' : ''
        }每个结论都要有证据。`,
        '',
        '重点：',
        `- 要做什么：${normalized || '先确认目标'}`,
        `- 不做什么：不扩大范围，不把待确认信息当事实${trigger === 'release' ? '，不跳过 QA/安全/回滚' : ''}`,
        '- 怎么算完成：有验收标准和证据',
        '- 下一步先做什么：先确认当前上下文和最小动作',
      ].join('\n')
    : null;

  return {
    shouldGuide,
    trigger,
    contextBasis,
    gaps,
    suggestedPrompt,
  };
}
