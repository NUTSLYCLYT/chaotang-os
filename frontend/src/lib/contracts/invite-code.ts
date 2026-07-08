/**
 * 朝堂 OS · 邀请码数据契约
 *
 * 表结构：invite_codes（列式，支持精确匹配 + 使用计数）
 * maxUses = -1 表示无限次使用（向后兼容现有硬编码邀请码行为）
 */

import { z } from 'zod';

export const INVITE_CODE_TABLE = 'invite_codes' as const;

export interface InviteCode {
  code: string;
  label: string | null;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
}

export const ZCreateInviteCode = z.object({
  code: z.string().min(4).max(64).transform((s) => s.trim().toUpperCase()),
  label: z.string().max(200).optional(),
  maxUses: z.number().int().min(-1).default(-1),
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CreateInviteCodeInput = z.infer<typeof ZCreateInviteCode>;

/** 出厂种子邀请码（对应现有硬编码列表，maxUses=-1 保持向后兼容） */
export const SEED_INVITE_CODES: Array<Omit<InviteCode, 'createdAt'>> = [
  { code: 'COURT2026',    label: '朝廷2026',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'COURT2025',    label: '朝廷2025',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'CHAOTANG2026', label: '朝堂2026',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'CHAOTANG2025', label: '朝堂2025',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'COURTOS2026',  label: 'CourtOS26',  maxUses: -1, uses: 0, expiresAt: null },
  { code: 'COURTOS2025',  label: 'CourtOS25',  maxUses: -1, uses: 0, expiresAt: null },
  { code: 'EMPEROR2026',  label: '皇帝2026',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'MINGSHUO2026', label: '铭硕2026',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'INVITE2026',   label: '通用邀请26', maxUses: -1, uses: 0, expiresAt: null },
  { code: 'WELCOME2026',  label: '欢迎2026',   maxUses: -1, uses: 0, expiresAt: null },
  { code: 'JIQUN2026',    label: '蜂群2026',   maxUses: -1, uses: 0, expiresAt: null },
];
