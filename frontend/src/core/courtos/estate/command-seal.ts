import type { AuthorityActor, CommandSeal, CommandType, EstateRiskLevel, FormationType } from './estate-types.ts';

const ALL_FORMATIONS: FormationType[] = ['SCOUT', 'RED_BLUE', 'EVIDENCE', 'RISK', 'CAMPAIGN', 'DELIVERY', 'WAR_ROOM'];
const LOW_FORMATIONS: FormationType[] = ['SCOUT', 'RED_BLUE', 'EVIDENCE', 'CAMPAIGN', 'DELIVERY'];

export const COMMAND_SEALS: CommandSeal[] = [
  seal('seal_emperor_public', 'EMPEROR', 'PUBLIC_DECREE', ALL_FORMATIONS, 'HIGH', false, true, true),
  seal('seal_emperor_secret', 'EMPEROR', 'SECRET_EDICT', ALL_FORMATIONS, 'HIGH', true, true, true),
  seal('seal_chancellor_secret', 'CHANCELLOR', 'SECRET_EDICT', ['SCOUT', 'RED_BLUE', 'EVIDENCE', 'RISK', 'CAMPAIGN', 'DELIVERY'], 'HIGH', true, false, true),
  seal('seal_grand_council_public', 'GRAND_COUNCIL', 'PUBLIC_DECREE', ALL_FORMATIONS, 'HIGH', false, false, true),
  seal('seal_minister_request', 'MINISTER', 'MINISTRY_REQUEST', LOW_FORMATIONS, 'MEDIUM', false, false, false),
  seal('seal_deputy_request', 'DEPUTY', 'MINISTRY_REQUEST', ['SCOUT', 'RED_BLUE', 'EVIDENCE'], 'MEDIUM', false, false, false),
  seal('seal_yushitai_audit', 'YUSHITAI', 'AUDIT_ORDER', ['RED_BLUE', 'EVIDENCE', 'RISK', 'WAR_ROOM'], 'HIGH', false, false, true),
];

function seal(
  id: string,
  actor: AuthorityActor,
  commandType: CommandType,
  allowedFormationTypes: FormationType[],
  allowedRiskLevel: EstateRiskLevel,
  canBypassPublicCourt: boolean,
  canApproveHighRisk: boolean,
  auditRequired: boolean,
): CommandSeal {
  return { id, actor, commandType, allowedFormationTypes, allowedRiskLevel, canBypassPublicCourt, canApproveHighRisk, auditRequired };
}

export function getCommandSeal(actor: AuthorityActor, commandType: CommandType): CommandSeal | null {
  return COMMAND_SEALS.find((item) => item.actor === actor && item.commandType === commandType) ?? null;
}

export function riskRank(level: EstateRiskLevel): number {
  if (level === 'LOW') return 1;
  if (level === 'MEDIUM') return 2;
  return 3;
}

export function assertCommandAllowed(params: {
  actor: AuthorityActor;
  commandType: CommandType;
  formationType: FormationType;
  riskLevel: EstateRiskLevel;
}): CommandSeal {
  const seal = getCommandSeal(params.actor, params.commandType);
  if (!seal) throw new Error(`[CommandSeal] ${params.actor} 无权发起 ${params.commandType}`);
  if (!seal.allowedFormationTypes.includes(params.formationType)) {
    throw new Error(`[CommandSeal] ${params.actor}/${params.commandType} 不允许调用 ${params.formationType}`);
  }
  if (riskRank(params.riskLevel) > riskRank(seal.allowedRiskLevel)) {
    throw new Error(`[CommandSeal] 风险等级 ${params.riskLevel} 超过兵符权限 ${seal.allowedRiskLevel}`);
  }
  return seal;
}
