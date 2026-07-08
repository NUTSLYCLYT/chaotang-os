import type {
  AuthorityActor,
  EstateDispatchResult,
  FormationType,
  PromotedCourtTaskInput,
  SecretEdict,
  SecretMemo,
  SecrecyLevel,
} from './estate-types.ts';
import type { SourceLabel } from '../types';
import { detectHighRisk } from '../harness/human-approval-gate.ts';
import { assertCommandAllowed } from './command-seal.ts';
import { dispatchFromEstate, inferEstateRiskLevel } from './estate-dispatcher.ts';
import { synthesizeSecretMemoFromDispatch } from './secret-memo-synthesizer.ts';

const SECRET_FORBIDDEN_ACTIONS = ['external_commitment', 'payment_approval', 'contract_approval', 'public_report'];

function makeId(prefix: string, text: string): string {
  const hash = Array.from(text).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 17);
  return `${prefix}_${hash.toString(36)}`;
}

function normalizeSourceLabel(sourceLabel: SourceLabel, hasLiveTrace = false): SourceLabel {
  if (sourceLabel === 'LIVE_SWARM' && !hasLiveTrace) return 'MIXED';
  return sourceLabel;
}

function appendTrail(secretEdict: SecretEdict, entry: string): SecretEdict {
  return { ...secretEdict, auditTrail: [...secretEdict.auditTrail, entry] };
}

export function createSecretEdict(input: {
  title?: string;
  originalText: string;
  issuer: AuthorityActor;
  secrecyLevel?: SecrecyLevel;
  purpose: string;
  formationType: FormationType;
  sourceLabel?: SourceLabel;
  hasLiveTrace?: boolean;
}): SecretEdict {
  if (!input.purpose.trim()) throw new Error('[SecretEdict] 密旨必须有 purpose');
  const riskLevel = inferEstateRiskLevel(`${input.originalText}\n${input.purpose}`);
  assertCommandAllowed({
    actor: input.issuer,
    commandType: 'SECRET_EDICT',
    formationType: input.formationType,
    riskLevel,
  });
  const sourceLabel = normalizeSourceLabel(input.sourceLabel ?? 'MIXED', input.hasLiveTrace);
  const dispatch = dispatchFromEstate({
    commandType: 'SECRET_EDICT',
    actor: input.issuer,
    formationType: input.formationType,
    taskText: `${input.originalText}\n${input.purpose}`,
    secrecyLevel: input.secrecyLevel,
    sourceLabel,
  });
  const highRisk = detectHighRisk([input.originalText, input.purpose]);
  return {
    id: makeId('secret', `${input.issuer}:${input.formationType}:${input.originalText}:${input.purpose}`),
    title: input.title ?? input.purpose,
    originalText: input.originalText,
    issuer: input.issuer,
    secrecyLevel: input.secrecyLevel ?? 'CONFIDENTIAL',
    purpose: input.purpose,
    formationType: input.formationType,
    selectedSwarms: dispatch.selectedSwarms.map((swarm) => swarm.id),
    forbiddenActions: SECRET_FORBIDDEN_ACTIONS,
    status: 'SECRET_DRAFT',
    sourceLabel,
    needsHumanConfirmation: highRisk.isHighRisk || dispatch.requiresHumanApproval,
    createdAt: new Date(0).toISOString(),
    auditRequired: true,
    auditTrail: ['密旨已创建，等待丞相拆解。'],
  };
}

export function scopeSecretEdict(secretEdict: SecretEdict): SecretEdict {
  return appendTrail({ ...secretEdict, status: 'SECRET_SCOPING' }, '丞相正在拆解密旨目标、密级和调兵范围。');
}

export function dispatchSecretFormation(secretEdict: SecretEdict): SecretEdict {
  return appendTrail({ ...secretEdict, status: 'SECRET_SWARMING' }, '庄园已按阵型调兵，蜂群开始秘密预研。');
}

export function runSecretRedTeam(secretEdict: SecretEdict): SecretEdict {
  return appendTrail({ ...secretEdict, status: 'SECRET_REDTEAMING' }, '红队蜂群正在攻击过度乐观假设和隐藏风险。');
}

export function runSecretAudit(secretEdict: SecretEdict): SecretEdict {
  return appendTrail({ ...secretEdict, status: 'SECRET_AUDITING', auditRequired: true }, '御史台正在暗审 sourceLabel、缺证和高风险。');
}

export function synthesizeSecretMemo(secretEdict: SecretEdict, dispatch?: EstateDispatchResult): SecretMemo {
  const effectiveDispatch = dispatch ?? dispatchFromEstate({
    commandType: 'SECRET_EDICT',
    actor: secretEdict.issuer,
    formationType: secretEdict.formationType,
    taskText: `${secretEdict.originalText}\n${secretEdict.purpose}`,
    secrecyLevel: secretEdict.secrecyLevel,
    sourceLabel: secretEdict.sourceLabel,
  });
  return synthesizeSecretMemoFromDispatch(
    appendTrail({ ...secretEdict, status: 'SECRET_MEMO_READY' }, '丞相已合成密奏，等待皇上查看。'),
    effectiveDispatch,
  );
}

export function promoteSecretToCourt(secretMemo: SecretMemo): PromotedCourtTaskInput {
  return {
    commandType: 'PUBLIC_DECREE',
    originalSecretEdictId: secretMemo.secretEdictId,
    rawQuestion: `${secretMemo.chancellorSummary}\n请军机处正式会审：${secretMemo.nextAction}`,
    evidence: [...secretMemo.swarmFindings, ...secretMemo.yushitaiAudit],
    risks: secretMemo.risks,
    sourceLabel: secretMemo.sourceLabel,
    needsHumanConfirmation: secretMemo.needsHumanConfirmation,
  };
}

export function sealSecretArchive(secretMemo: SecretMemo): SecretMemo {
  return {
    ...secretMemo,
    recommendation: 'KEEP_SECRET',
    nextAction: '封存密档，保留 sourceLabel、御史台暗审和调兵记录。',
  };
}

export function dismissSecretEdict(secretMemo: SecretMemo): SecretMemo {
  return {
    ...secretMemo,
    recommendation: 'DISMISS',
    nextAction: '驳回密旨，不进入军机处。',
  };
}
