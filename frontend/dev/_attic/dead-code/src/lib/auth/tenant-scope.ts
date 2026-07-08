import 'server-only';

import { readSession } from '@/lib/auth-server';
import type { TenantScope } from '@/lib/contracts/tenant';

export class TenantScopeError extends Error {
  status = 401;

  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/**
 * 读取当前请求的租户边界。
 *
 * 新的写路径必须 requireTenantScope()，不能只按 user_id 隔离；
 * 否则同一用户跨租户切换时会串数据。
 */
export async function requireTenantScope(): Promise<TenantScope> {
  const session = await readSession();
  if (!session?.userId || session.tenant == null) {
    throw new TenantScopeError();
  }

  return {
    tenantId: session.tenant,
    userId: session.userId,
    isAdmin: session.isAdmin,
  };
}

/**
 * 构造读查询的租户条件。
 *
 * allowLegacy=true 用于迁移期读历史空租户数据；新接口默认应关闭。
 */
export function tenantWhereClause(
  alias: string,
  opts: { allowLegacy?: boolean } = {},
): string {
  const column = `${alias}.tenant_id`;
  return opts.allowLegacy ? `(${column} = ? OR ${column} IS NULL)` : `${column} = ?`;
}

export function tenantParam(scope: TenantScope): string {
  return String(scope.tenantId);
}
