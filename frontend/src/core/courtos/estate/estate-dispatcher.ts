import type {
  AuthorityActor,
  CommandType,
  EstateDispatchResult,
  EstateRiskLevel,
  FormationType,
} from './estate-types.ts';
import type { SourceLabel } from '../types';
import { detectHighRisk } from '../harness/human-approval-gate.ts';
import { assertCommandAllowed } from './command-seal.ts';
import { getFormation } from './formation-registry.ts';
import { getSwarmCapability } from './swarm-capability-registry.ts';

export function inferEstateRiskLevel(text: string): EstateRiskLevel {
  const high = detectHighRisk(text);
  if (high.isHighRisk) return 'HIGH';
  if (/[Rr][Oo][Ii]|预算|客户|交付|BOM|竞争|供应链|承诺/.test(text)) return 'MEDIUM';
  return 'LOW';
}

export function dispatchFromEstate(params: {
  commandType: CommandType;
  actor: AuthorityActor;
  formationType: FormationType;
  taskText: string;
  ministryId?: string;
  secrecyLevel?: string;
  sourceLabel: SourceLabel;
}): EstateDispatchResult {
  const riskLevel = inferEstateRiskLevel(params.taskText);
  try {
    const seal = assertCommandAllowed({
      actor: params.actor,
      commandType: params.commandType,
      formationType: params.formationType,
      riskLevel,
    });
    const formation = getFormation(params.formationType);
    const swarms = [...formation.requiredSwarms, ...formation.optionalSwarms]
      .map((id) => getSwarmCapability(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const highRisk = riskLevel === 'HIGH';
    const requiresAudit = seal.auditRequired || highRisk || swarms.some((item) => item.requiresAudit);
    const requiresHumanApproval = formation.humanApprovalRequired || highRisk || swarms.some((item) => item.requiresHumanApproval);
    const forbiddenActions =
      params.commandType === 'SECRET_EDICT'
        ? ['external_commitment', 'payment_approval', 'contract_approval', 'public_report']
        : highRisk
          ? ['silent_acceptance']
          : [];
    return {
      selectedFormation: formation,
      selectedSwarms: swarms,
      forbiddenActions,
      requiresAudit,
      requiresHumanApproval,
      sourceLabel: params.sourceLabel,
      dispatchTraces: [
        {
          actor: params.actor,
          formationType: params.formationType,
          activity: `${params.actor === 'CHANCELLOR' ? '丞相密旨' : params.actor}正在调用${formation.name}`,
          sourceLabel: params.sourceLabel,
        },
        ...swarms.map((swarm) => ({
          actor: params.actor,
          formationType: params.formationType,
          activity: swarm.userFacingActivity,
          sourceLabel: params.sourceLabel,
        })),
      ],
    };
  } catch (error) {
    const formation = getFormation(params.formationType);
    return {
      selectedFormation: formation,
      selectedSwarms: [],
      forbiddenActions: ['external_commitment', 'payment_approval', 'contract_approval', 'public_report'],
      requiresAudit: true,
      requiresHumanApproval: true,
      sourceLabel: 'FALLBACK',
      dispatchTraces: [
        {
          actor: params.actor,
          formationType: params.formationType,
          activity: error instanceof Error ? error.message : '庄园调兵失败，已降级为待审',
          sourceLabel: 'FALLBACK',
        },
      ],
    };
  }
}
