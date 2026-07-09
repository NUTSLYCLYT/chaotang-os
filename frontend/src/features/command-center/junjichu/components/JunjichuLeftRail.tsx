import { ShangshufangRailPanel } from '@/features/shared/components/shangshufang-layout-shell';
import { CaseIdentityPanel } from './CaseIdentityPanel';
import { EvidenceQueuePanel } from './EvidenceQueuePanel';
import { GovernanceGatePanel } from './GovernanceGatePanel';
import { RoutingReasonPanel } from './RoutingReasonPanel';
import { SummonListPanel } from './SummonListPanel';
import type { JunjichuPageView } from '../model/types';

export function JunjichuLeftRail({ view, onProceed }: { view: JunjichuPageView; onProceed?: () => void }) {
  return (
    <ShangshufangRailPanel title="军机处为何开" subtitle={view.caseIdentity.title} accent="#F0C66A">
      <div className="space-y-3">
        <CaseIdentityPanel view={view} />
        <RoutingReasonPanel view={view} />
        <SummonListPanel view={view} />
        <EvidenceQueuePanel view={view} />
        <GovernanceGatePanel view={view} onProceed={onProceed} />
      </div>
    </ShangshufangRailPanel>
  );
}
