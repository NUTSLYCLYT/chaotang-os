import type { JunjichuActionPolicy, JunjichuStage, QualityGateView } from './types';

const enabled = (label: string, extra: Partial<JunjichuActionPolicy[keyof JunjichuActionPolicy]> = {}) => ({
  enabled: true,
  label,
  ...extra,
});

const disabled = (label: string, disabledReason: string) => ({
  enabled: false,
  label,
  disabledReason,
});

export function buildJunjichuActionPolicy(input: {
  stage: JunjichuStage;
  gate: QualityGateView;
  hasTask: boolean;
  canWriteBackendDecision: boolean;
  governanceWaiting: boolean;
}): JunjichuActionPolicy {
  const noTask = '待接案后可用';
  const deliberating = '会审未完成，暂不可裁';
  const blocked = input.gate.blockingReasons[0] ?? '质量门阻断，需补证或复核';
  const backendNote = input.canWriteBackendDecision ? undefined : '仅记录意见：当前缺少真实后端裁决锚点';
  const canAdopt =
    input.hasTask &&
    input.stage !== 'empty' &&
    input.stage !== 'deliberating' &&
    input.stage !== 'evidence_blocked' &&
    input.stage !== 'archived' &&
    input.gate.canAdopt;

  return {
    issueEdict: enabled(input.hasTask ? '重新立案' : '发圣旨'),
    unfoldCase: input.hasTask ? enabled('展卷') : disabled('展卷', noTask),
    summonCouncil:
      input.hasTask && input.stage !== 'deliberating' && input.stage !== 'archived'
        ? enabled(input.stage === 'quality_ready' ? '重审六部' : '召六部会审')
        : disabled('召六部会审', input.hasTask ? '当前阶段不宜重复召集' : noTask),
    startSwarm:
      input.hasTask && input.stage !== 'archived'
        ? enabled(input.stage === 'evidence_blocked' ? '补证后重跑蜂群' : '派蜂群')
        : disabled('派蜂群', input.hasTask ? '已归档案不再派蜂群' : noTask),
    archive:
      input.stage === 'decision_written' || input.stage === 'archived'
        ? enabled(input.stage === 'archived' ? '查看归档' : '转史馆')
        : disabled('转史馆', '裁决写入后可转史馆'),
    adopt: canAdopt
      ? enabled('采纳', {
          disabledReason: backendNote,
          requiresReason: true,
          requiresHumanConfirmation: input.gate.requiresHumanConfirmation,
        })
      : disabled('采纳', input.stage === 'deliberating' ? deliberating : blocked),
    requestEvidence:
      input.hasTask && input.stage !== 'archived'
        ? enabled('补证', { requiresReason: true })
        : disabled('补证', noTask),
    recheck:
      input.hasTask && input.stage !== 'archived'
        ? enabled('复核', { requiresReason: true })
        : disabled('复核', noTask),
    reject:
      input.hasTask && input.stage !== 'archived'
        ? enabled('驳回', { requiresReason: true })
        : disabled('驳回', noTask),
    followup:
      input.hasTask && input.stage !== 'archived'
        ? enabled('追问', { requiresReason: true })
        : disabled('追问', noTask),
    proceed:
      input.governanceWaiting
        ? enabled('圣裁放行', { requiresHumanConfirmation: true })
        : disabled('圣裁放行', '当前没有等待放行的治理门'),
  };
}
