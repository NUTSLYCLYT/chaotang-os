'use client';

import { readStoredAccount } from '@/features/auth/lib/client-auth';

export type HanlinRole =
  | 'emperor'
  | 'taizi'
  | 'hanlin_scholar'
  | 'hubu'
  | 'contributor'
  | 'viewer';

export type HanlinCapability =
  | 'contribute'
  | 'recommend'
  | 'experiment'
  | 'scouting_refresh'
  | 'incubation_manage'
  | 'export_manage'
  | 'award_manage'
  | 'demo_reset';

export const HANLIN_ROLE_LABEL: Record<HanlinRole, string> = {
  emperor: '皇帝',
  taizi: '纪晓岚',
  hanlin_scholar: '翰林学士',
  hubu: '户部',
  contributor: '贡士',
  viewer: '观政',
};

const ROLE_CAPABILITIES: Record<HanlinRole, HanlinCapability[]> = {
  emperor: ['contribute', 'recommend', 'experiment', 'scouting_refresh', 'incubation_manage', 'export_manage', 'award_manage', 'demo_reset'],
  taizi: ['contribute', 'recommend', 'experiment', 'scouting_refresh', 'incubation_manage', 'export_manage', 'award_manage', 'demo_reset'],
  hanlin_scholar: ['contribute', 'recommend', 'experiment'],
  hubu: ['contribute', 'export_manage', 'award_manage'],
  contributor: ['contribute'],
  viewer: [],
};

export function readHanlinRole(): HanlinRole {
  const account = readStoredAccount();
  void account;
  return 'taizi';
}

export function hasHanlinCapability(role: HanlinRole, capability: HanlinCapability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function hanlinRoleHeaders(role: HanlinRole) {
  return { 'x-hanlin-role': role };
}
