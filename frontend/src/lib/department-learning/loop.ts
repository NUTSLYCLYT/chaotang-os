/**
 * ⚠️ 已冻结(2026-06-20 会审 · CLAUDE.md 铁律 5 版面预算)
 *
 * 此"部门学习"是没有结果源的开环——只能写 unknown/observing、永远到不了 confirmed。
 * 会审判定:它不缺版面,缺结果;真正的家是**史馆归档的"事后兑现"回填弧**(结果源=旧案事后怎样了),
 * 而非上书房后台空转。决定:保留 C1 隔离骨架(无害),但**不建版面/不接 cron/停一切新投入**。
 * 要重启:先回答"第一条真实裁决结果从哪来",并把它溶解进史馆,而非在此扩功能。
 */
import { AGENT_META, type AgentCode } from '@/lib/contracts/agent';
import type {
  DepartmentLearningMetrics,
  DepartmentLearningRecord,
  DepartmentLearningVerdict,
} from '@/lib/contracts/department-learning';

const LEARNING_TARGETS: Record<AgentCode, { target: string; metric: string; nextLesson: string }> = {
  prime_minister: {
    target: '裁决建议是否被采纳并产生可追踪结果',
    metric: 'decision_outcome_fit',
    nextLesson: '下一课：把采纳率低的裁决拆成证据缺口、授权缺口和执行缺口。',
  },
  scribe: {
    target: '复盘是否能被下次任务复用',
    metric: 'lesson_reuse_rate',
    nextLesson: '下一课：把不可复用的复盘改写成可执行 playbook。',
  },
  li_bu: {
    target: '组织与人员判断是否改善责任链',
    metric: 'accountability_fit',
    nextLesson: '下一课：检查岗位、责任人和交付物是否一一对应。',
  },
  hu_bu: {
    target: 'ROI 估算是否兑现，预算是否超支',
    metric: 'roi_realization_rate',
    nextLesson: '下一课：把预算建议拆成现金流、回收期和最坏情景。',
  },
  li_bu_rites: {
    target: '对外话术是否匹配客户反馈与转化',
    metric: 'message_market_fit',
    nextLesson: '下一课：把低转化话术改成客户原话驱动的定位。',
  },
  bing_bu: {
    target: '竞争判断和战场优先级是否正确',
    metric: 'competitive_priority_hit_rate',
    nextLesson: '下一课：把竞争判断拆成对手动作、我方反制和资源代价。',
  },
  xing_bu: {
    target: '风险判定是否过度拦截或漏拦',
    metric: 'risk_gate_precision',
    nextLesson: '下一课：把风险拦截拆成法律责任、授权边界和审计证据。',
  },
  gong_bu: {
    target: '工期、质量和交付判断是否准确',
    metric: 'delivery_prediction_accuracy',
    nextLesson: '下一课：把延期风险拆成依赖、测试、回滚和责任人。',
  },
  qin_tian_jian: {
    target: '预测是否命中，触发器是否有效',
    metric: 'forecast_trigger_hit_rate',
    nextLesson: '下一课：把未知结果源接入后再改判 confirmed/refuted。',
  },
  jin_yi_wei: {
    target: '情报来源是否可靠，误报率是否下降',
    metric: 'intel_source_reliability',
    nextLesson: '下一课：按来源、时间戳和交叉验证拆分情报可信度。',
  },
  tai_yi_yuan: {
    target: '健康风险提醒是否及时且不过度惊扰',
    metric: 'health_signal_precision',
    nextLesson: '下一课：把健康建议拆成证据等级、紧急程度和人工确认。',
  },
};

export const ALL_DEPARTMENT_AGENT_CODES = Object.keys(AGENT_META) as AgentCode[];

export function buildDepartmentLearningRecord(agentCode: AgentCode, now = new Date()): DepartmentLearningRecord {
  const meta = AGENT_META[agentCode];
  const target = LEARNING_TARGETS[agentCode];
  const due = new Date(now);
  due.setDate(due.getDate() + 7);

  return {
    id: `department_learning_${agentCode}`,
    agentCode,
    agentName: meta.nameCn,
    calibrationTarget: target.target,
    metricName: target.metric,
    sourceLabel: 'RULE_SEED',
    verdict: 'observing',
    dueAt: due.toISOString(),
    nextLesson: target.nextLesson,
    calibrationDelta: '初始化：已建立部门自我校准槽位，等待真实结果源或史馆证据回填。',
    evidence: [
      `${meta.nameCn} · ${meta.description}`,
      `metric:${target.metric}`,
      'source:department_learning_rule_seed',
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    confirmedCount: 0,
    refutedCount: 0,
  };
}

/** 无状态飞轮健康度：confirmedRate / stillUnknownRate + 过期未确认（结果源是否接上）。 */
export function summarizeDepartmentLearning(
  records: DepartmentLearningRecord[],
  now = new Date(),
): DepartmentLearningMetrics {
  const total = records.length;
  const nowMs = now.getTime();
  const count = (verdict: DepartmentLearningVerdict) =>
    records.filter((record) => record.verdict === verdict).length;
  const confirmed = count('confirmed');
  const refuted = count('refuted');
  const unknown = count('unknown');
  const observing = count('observing');
  const dueUnresolved = records.filter((record) => {
    const due = new Date(record.dueAt).getTime();
    const resolved = record.verdict === 'confirmed' || record.verdict === 'refuted';
    return Number.isFinite(due) && due <= nowMs && !resolved;
  }).length;
  const rate = (n: number) => (total === 0 ? 0 : Number((n / total).toFixed(4)));

  return {
    total,
    confirmed,
    refuted,
    unknown,
    observing,
    dueUnresolved,
    confirmedRate: rate(confirmed),
    stillUnknownRate: rate(unknown),
    resultSourceStale: dueUnresolved > 0 && confirmed === 0,
  };
}

export function calibrateDepartmentLearningRecord(
  record: DepartmentLearningRecord,
  now = new Date(),
  forced = false,
): DepartmentLearningRecord {
  const dueAt = new Date(record.dueAt).getTime();
  const due = forced || (Number.isFinite(dueAt) && dueAt <= now.getTime());
  const verdict: DepartmentLearningVerdict = due ? 'unknown' : 'observing';

  return {
    ...record,
    verdict,
    calibrationDelta: due
      ? '自我校准：已进入复盘窗口，但尚未接入真实结果源，先标记 unknown，并要求补证。'
      : '自我校准：仍在观察窗口内，暂不改判。',
    nextLesson: due
      ? `下一课：为「${record.calibrationTarget}」接入真实结果源，再改判 confirmed/refuted。`
      : record.nextLesson,
    updatedAt: now.toISOString(),
  };
}
