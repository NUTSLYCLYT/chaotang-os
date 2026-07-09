'use client';

import type { ReactNode } from 'react';
import { QualityGateStrip } from './QualityGateStrip';
import { VerdictActionBar } from './VerdictActionBar';
import type { JunjichuPageView } from '../model/types';

type VerdictAction = 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';

export function JunjichuCenterWorkSurface({
  view,
  edictStage,
  stream,
  extra,
  onDecision,
}: {
  view: JunjichuPageView;
  edictStage: ReactNode;
  stream?: ReactNode;
  extra?: ReactNode;
  onDecision?: (action: VerdictAction, reason: string) => Promise<void> | void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {extra}
      <div className={`min-h-[380px] flex-1 ${!view.caseIdentity.taskId ? 'flex justify-center py-3' : ''}`}>
        <div className={!view.caseIdentity.taskId ? 'h-full w-full max-w-[780px]' : 'h-full w-full'}>
          {edictStage}
        </div>
      </div>
      {stream}
      <QualityGateStrip view={view} />
      <VerdictActionBar view={view} onDecision={onDecision} />
    </div>
  );
}
