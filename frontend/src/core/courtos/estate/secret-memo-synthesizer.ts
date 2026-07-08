import type { EstateDispatchResult, SecretEdict, SecretMemo, SecretMemoRecommendation } from './estate-types.ts';

function hasWeakSource(sourceLabel: SecretEdict['sourceLabel']): boolean {
  return sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO';
}

function buildRecommendation(secretEdict: SecretEdict, dispatch: EstateDispatchResult): SecretMemoRecommendation {
  if (hasWeakSource(secretEdict.sourceLabel)) return 'REQUEST_MORE_EVIDENCE';
  if (secretEdict.needsHumanConfirmation || dispatch.requiresHumanApproval) return 'PROMOTE_TO_COURT';
  if (secretEdict.formationType === 'SCOUT') return 'KEEP_SECRET';
  return 'PROMOTE_TO_COURT';
}

export function synthesizeSecretMemoFromDispatch(
  secretEdict: SecretEdict,
  dispatch: EstateDispatchResult,
): SecretMemo {
  const highRisk = secretEdict.needsHumanConfirmation || dispatch.requiresHumanApproval;
  const weakSource = hasWeakSource(secretEdict.sourceLabel);
  const recommendation = buildRecommendation(secretEdict, dispatch);

  return {
    id: `secret_memo_${secretEdict.id}`,
    secretEdictId: secretEdict.id,
    chancellorSummary: `丞相密奏：${secretEdict.purpose}`,
    swarmFindings: dispatch.selectedSwarms.map((swarm) => `${swarm.name}：${swarm.userFacingActivity}`),
    redTeamChallenges: [
      highRisk ? '红队提示：该密旨命中高风险事项，不能绕过人工确认。' : '红队提示：需确认该事项是否值得公开上朝。',
      weakSource ? `来源为 ${secretEdict.sourceLabel}，不得作为最终裁决依据。` : '密奏仅用于预研，不能直接替代正式圣裁。',
    ],
    missingEvidence: weakSource
      ? ['缺少真实链路证据或可追溯蜂群 trace']
      : ['正式会审前仍需补齐可归档证据链'],
    risks: [
      ...(highRisk ? ['高风险事项需皇上人工确认'] : []),
      ...(dispatch.requiresAudit ? ['密旨必须经过御史台暗审'] : []),
      '密奏不能直接准奏，只能建议是否转入军机处',
    ],
    yushitaiAudit: dispatch.requiresAudit
      ? ['御史台暗审要求保留 sourceLabel、风险、缺证和调兵记录。']
      : ['当前密旨仍需在转正前接受御史台复核。'],
    recommendation,
    nextAction:
      recommendation === 'PROMOTE_TO_COURT'
        ? '转入军机处公开会审'
        : recommendation === 'REQUEST_MORE_EVIDENCE'
          ? '先补齐证据后再决定是否上朝'
          : recommendation === 'DISMISS'
            ? '驳回密旨'
            : '封存为密案并等待皇上追问',
    sourceLabel: secretEdict.sourceLabel,
    needsHumanConfirmation: highRisk,
  };
}
