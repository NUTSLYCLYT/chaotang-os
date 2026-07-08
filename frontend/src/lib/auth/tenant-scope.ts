import { readSession } from '@/lib/auth-server';

export interface TenantScope {
  userId: string;
  tenantId: string;
}

export async function requireTenantScope(): Promise<TenantScope | null> {
  const session = await readSession();
  if (!session?.userId) return null;
  return {
    userId: session.userId,
    tenantId: session.tenant == null ? session.userId : String(session.tenant),
  };
}
