'use client';

import type { ReactNode } from 'react';
import { QualityGateStrip } from './QualityGateStrip';
import { VerdictActionBar } from './VerdictActionBar';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
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
  const isMenxiaVetoPending = view.caseIdentity.status === 'menxia_veto_pending';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {extra}
      <div className={`min-h-[380px] flex-1 ${!view.caseIdentity.taskId ? 'flex justify-center py-3' : ''}`}>
        <div className={!view.caseIdentity.taskId ? 'h-full w-full max-w-[780px]' : 'h-full w-full'}>
          {edictStage}
        </div>
      </div>
      {isMenxiaVetoPending && (
        <section className={JUNJICHU_PANEL_CLASS} aria-label="门下省封驳状态">
          <div className="text-[11px] font-semibold tracking-[0.16em] text-[#F0C66A]">
            门下省封驳 · 未进入会审
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[#D8CEAE]">
            门下省封驳，需人工确认后才能进入会审。未生成奏折，也未派发部门或蜂群执行。
          </p>
        </section>
      )}
      {stream}
      <QualityGateStrip view={view} />
      <VerdictActionBar view={view} onDecision={onDecision} />
    </div>
  );
}
