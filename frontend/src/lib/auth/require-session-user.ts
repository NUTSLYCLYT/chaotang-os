import 'server-only';

import { headers } from 'next/headers';
import { readSession } from '@/lib/auth-server';
import { normalizeSession, type NormalizedSession } from '@/lib/auth/session-claims';

export class SessionUserError extends Error {
  status = 401;

  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'SessionUserError';
  }
}

export async function requireSessionUserId(): Promise<string> {
  const session = await requireSessionUser();
  return session.userId;
}

export async function requireSessionUser(): Promise<NormalizedSession & { userId: string }> {
  const session = await readSession();
  if (session?.userId) return { ...session, userId: session.userId };

  const auth = (await headers()).get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const bearerSession = match ? normalizeSession(match[1]) : null;
  if (bearerSession?.userId) return { ...bearerSession, userId: bearerSession.userId };

  throw new SessionUserError();
}

