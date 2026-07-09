'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardAppShell } from '@/components/chaotang/layout/DashboardAppShell';
import { API_MODE, ENDPOINT_MODE } from '@/lib/api/client';
import { backendFetch } from '@/lib/backend-api';
import { useRealEventStream } from '@/lib/hooks/use-real-event-stream';
import { useCourtPulse } from '@/features/shared/hooks/use-court-pulse';
import { ChaotangTopNav } from '@/features/shangshufang/components/ChaotangTopNav';
import { CommandPalette } from '@/features/shared/components/command-palette';
import { GlobalDashboardFooter } from '@/features/shared/components/global-dashboard-footer';
import { GlobalEdictDockSlotProvider } from '@/features/shared/components/global-edict-dock-slot';
import { TitleBadge } from '@/features/shared/components/title-badge';
import { VerdictCardModal } from '@/features/shared/components/verdict-card-modal';
import { VermilionAnnotator } from '@/features/shared/components/vermilion-annotator';
import { clearStoredAuthState } from '@/features/auth/lib/client-auth';
import { useAppStore } from '@/lib/store/app-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRealEventStream(true);

  const router = useRouter();
  const pathname = usePathname();
  const hiddenChromeRoutes = ['/study'];
  const hideTopNav = hiddenChromeRoutes.some((p) => pathname === p);
  const hideFloatingChrome = false;
  const pulse = useCourtPulse(!hideTopNav);
  const storeLogout = useAppStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await backendFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort cookie revoke.
    } finally {
      clearStoredAuthState();
      storeLogout();
      router.replace('/login');
    }
  }, [router, storeLogout]);

  const header = !hideTopNav ? (
    <ChaotangTopNav
      onLogout={() => void handleLogout()}
      loggingOut={loggingOut}
      notifyCount={pulse.pendingReviews ?? 2}
    />
  ) : null;

  const footer = !hideTopNav ? <GlobalDashboardFooter /> : null;

  const floatingChrome = (
    <>
      {!hideFloatingChrome && <CommandPalette pulse={pulse} />}
      {!hideFloatingChrome && <TitleBadge />}
      {!hideFloatingChrome && <VerdictCardModal />}
      {!hideFloatingChrome && <VermilionAnnotator />}
    </>
  );

  return (
    <GlobalEdictDockSlotProvider>
      <DashboardAppShell header={header} footer={footer} floatingChrome={floatingChrome}>
        {children}
      </DashboardAppShell>
    </GlobalEdictDockSlotProvider>
  );
}

void API_MODE;
void ENDPOINT_MODE;
