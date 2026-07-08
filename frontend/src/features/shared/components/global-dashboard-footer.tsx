'use client';

import { GlobalEdictQuickDock } from '@/features/shared/components/global-edict-quick-dock';

export function GlobalDashboardFooter() {
  return (
    <div data-testid="global-dashboard-footer" className="contents">
      <GlobalEdictQuickDock />
    </div>
  );
}
