'use client';

import { useAppStore } from '@/lib/store/app-store';

export function useCurrentUser() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const switchIdentity = useAppStore((s) => s.switchIdentity);
  const logout = useAppStore((s) => s.logout);

  return { currentUserId, switchIdentity, logout };
}
