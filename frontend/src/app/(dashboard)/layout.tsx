/**
 * 朝堂 OS V2 · Dashboard layout
 *
 * 负责 dashboard 级页面骨架编排：顶部导航、Reality 状态条、底部脉搏条和全局浮层。
 * 具体 flex 结构由 DashboardAppShell 承载，业务页面只渲染自己的内容。
 */

'use client';

import { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { DashboardAppShell } from '@/components/chaotang/layout/DashboardAppShell';
import { API_MODE, ENDPOINT_MODE } from '@/lib/api/client';
import { withBasePath } from '@/lib/base-path';
import { useRealEventStream } from '@/lib/hooks/use-real-event-stream';
import { useCourtPulse } from '@/features/shared/hooks/use-court-pulse';
import { ChaotangTopNav } from '@/features/shangshufang/components/ChaotangTopNav';
import { CommandPalette } from '@/features/shared/components/command-palette';
import { GlobalDashboardFooter } from '@/features/shared/components/global-dashboard-footer';
import { GlobalEdictDockSlotProvider } from '@/features/shared/components/global-edict-dock-slot';
import { RealityStatusBar } from '@/features/shared/components/reality-status-bar';
import { TitleBadge } from '@/features/shared/components/title-badge';
import { VerdictCardModal } from '@/features/shared/components/verdict-card-modal';
import { VermilionAnnotator } from '@/features/shared/components/vermilion-annotator';
import { useAppStore } from '@/lib/store/app-store';
import { clearStoredAuthState } from '@/features/auth/lib/client-auth';
import type { RealitySignal, RealityState } from '@/lib/reality/reality-state';
import { worstRealityState } from '@/lib/reality/reality-state';

interface TrueChainSummary {
  ready: number;
  degraded: number;
  down: number;
  missing: number;
  mock: number;
  requiredDown: number;
}

interface TrueChainHealthResponse {
  data?: {
    status: 'ready' | 'degraded' | 'needs_backend';
    summary: TrueChainSummary;
  };
}

async function fetchTrueChain(): Promise<TrueChainHealthResponse> {
  const res = await fetch(withBasePath('/api/court/true-chain-health'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as TrueChainHealthResponse;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRealEventStream(true);

  const router = useRouter();
  const pathname = usePathname();
  const hiddenChromeRoutes = ['/study'];
  const hideTopNav = hiddenChromeRoutes.some((p) => pathname === p);
  const hideFloatingChrome = false;
  const pulse = useCourtPulse(!hideTopNav);
  const { data: trueChain, error: trueChainError } = useSWR<TrueChainHealthResponse, Error>(
    hideTopNav ? null : 'layout-true-chain-health',
    fetchTrueChain,
    { refreshInterval: 30000 },
  );
  const storeLogout = useAppStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const realitySignal = buildRealitySignal(trueChain?.data?.summary, trueChainError);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Best-effort cookie revoke.
    } finally {
      clearStoredAuthState();
      storeLogout();
      router.replace('/login');
    }
  }, [router, storeLogout]);

  const header = !hideTopNav ? (
    <>
      <ChaotangTopNav
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
        notifyCount={pulse.pendingReviews ?? 2}
      />
      {realitySignal.state !== 'missing' && <RealityStatusBar signal={realitySignal} compact />}
    </>
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

function buildRealitySignal(summary?: TrueChainSummary, error?: Error): RealitySignal {
  if (error) {
    return {
      state: 'degraded',
      label: '真实性体检不可读',
      detail: `/api/court/true-chain-health 返回异常：${error.message}`,
      evidencePath: '/settings',
    };
  }

  if (!summary) {
    return {
      state: 'missing',
      label: '真实性体检加载中',
      detail: '尚未取得 true-chain health；发布前不能按真实链路放行。',
      evidencePath: '/settings',
    };
  }

  const states: RealityState[] = ['real'];
  if (summary.degraded > 0) states.push('degraded');
  if (summary.down > 0 || summary.requiredDown > 0) states.push('degraded');
  if (summary.missing > 0) states.push('missing');
  if (summary.mock > 0) states.push('mock');
  const state = worstRealityState(states);

  return {
    state,
    label: state === 'real' ? '真实链路可用' : '真实链路有边界',
    detail: `ready ${summary.ready} · degraded ${summary.degraded} · mock ${summary.mock} · missing ${summary.missing} · requiredDown ${summary.requiredDown}`,
    evidencePath: '/settings',
  };
}
