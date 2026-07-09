import type { JunjichuStage, QualityGateView, StreamView, SwarmRunView } from './types';

export function deriveJunjichuStage(input: {
  hasTask: boolean;
  hasRouting: boolean;
  stream: StreamView;
  gate: QualityGateView;
  swarmRun: SwarmRunView | null;
  evidenceBlocking: boolean;
  decisionWritten: boolean;
  archived: boolean;
}): JunjichuStage {
  if (input.archived) return 'archived';
  if (input.decisionWritten) return 'decision_written';
  if (!input.hasTask) return 'empty';
  if (input.gate.status === 'blocked' || input.evidenceBlocking) return 'evidence_blocked';
  if (input.gate.status === 'passed' || input.gate.status === 'warning') return 'quality_ready';
  if (input.stream.active || input.swarmRun?.status === 'running') return 'deliberating';
  if (input.hasRouting) return 'routing';
  return 'accepted';
}
