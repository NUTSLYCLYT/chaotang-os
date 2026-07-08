/**
 * 朝堂 OS · 租户与用户视角契约
 *
 * 三种产品角色是系统内视角页面，不绑定登录用户，也不参与数据隔离：
 * - 企业家：默认看经营结论、下一步和风险
 * - AI爱好者：多看解释、证据和流程
 * - AI极客：可看调试、质门、运行细节
 *
 * 数据隔离以 tenantId 为边界；权限以 memberRole 为边界。
 */

export const AUDIENCE_VIEW_ROLES = ['entrepreneur', 'ai_enthusiast', 'ai_geek'] as const;
export type AudienceViewRole = (typeof AUDIENCE_VIEW_ROLES)[number];

export const AUDIENCE_VIEW_LABEL: Record<AudienceViewRole, string> = {
  entrepreneur: '企业家',
  ai_enthusiast: 'AI爱好者',
  ai_geek: 'AI极客',
};

export const TENANT_MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type TenantMemberRole = (typeof TENANT_MEMBER_ROLES)[number];

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  memberRole: TenantMemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface TenantScope {
  tenantId: string | number;
  userId: string;
  isAdmin: boolean;
}
