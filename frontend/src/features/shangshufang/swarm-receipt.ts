import type { JiqunSessionDetail } from '../../lib/jiqun-api.ts';

export type SwarmReceiptVerificationLevel =
  | 'running'
  | 'verified_blocked'
  | 'verified_clear'
  | 'invalid';

export interface SwarmReceipt {
  session_id: string;
  task_input: string;
  status: string;
  release_gate: string | null;
  started_at: string | null;
  finished_at: string | null;
  run_count: number;
  completed_runs: string[];
  failed_runs: string[];
  qa_run_count: number;
  final_output_count: number;
  can_label_live_swarm: boolean;
  can_show_valid_memorial: boolean;
  verification_level: SwarmReceiptVerificationLevel;
  user_message: string;
}

function hasFinalOutput(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const payload = (event as { payload?: unknown }).payload;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { final_output?: unknown }).final_output === 'object' &&
    (payload as { final_output?: unknown }).final_output !== null
  );
}

function hasQa(run: { qa_result?: unknown; quality_score?: unknown }): boolean {
  return Boolean(run.qa_result) || typeof run.quality_score === 'number';
}

export function buildSwarmReceipt(session: JiqunSessionDetail): SwarmReceipt {
  const runs = Array.isArray(session.swarm_runs) ? session.swarm_runs : [];
  const completedRuns = runs.filter((run) => run.status === 'completed').map((run) => run.swarm_id);
  const failedRuns = runs
    .filter((run) => run.status === 'failed' || Boolean(run.error))
    .map((run) => run.swarm_id);
  const qaRunCount = runs.filter(hasQa).length;
  const finalOutputCount = (session.events ?? []).filter(hasFinalOutput).length;
  const hasRealRun = runs.some(
    (run) => run.run_id || run.status === 'completed' || run.status === 'failed' || Boolean(run.error),
  );
  const canLabelLiveSwarm = Boolean(session.session_id && hasRealRun && runs.length > 0 && qaRunCount > 0);
  const blocked = session.release_gate === 'blocked';
  const canShowValidMemorial = Boolean(canLabelLiveSwarm && finalOutputCount > 0 && !blocked);
  const verificationLevel: SwarmReceiptVerificationLevel =
    !canLabelLiveSwarm
      ? session.status === 'running'
        ? 'running'
        : 'invalid'
      : blocked
        ? 'verified_blocked'
        : canShowValidMemorial
          ? 'verified_clear'
          : 'invalid';
  const userMessage =
    verificationLevel === 'running'
      ? '后端蜂群已启动，正在等待质量门和最终回奏；当前不得标记为 LIVE_SWARM。'
      : verificationLevel === 'verified_blocked'
        ? '后端蜂群真实完成，但质量门阻断；本次结果只能作为补证/复核依据，不能准奏归档。'
        : verificationLevel === 'verified_clear'
          ? '后端蜂群真实完成且质量门放行；可作为军机处奏折依据。'
          : '缺少完整蜂群运行凭证；不能作为真实蜂群回奏。';

  return {
    session_id: session.session_id,
    task_input: session.task_input,
    status: session.status,
    release_gate: session.release_gate ?? null,
    started_at: session.start_time ?? null,
    finished_at: session.end_time ?? null,
    run_count: runs.length,
    completed_runs: completedRuns,
    failed_runs: failedRuns,
    qa_run_count: qaRunCount,
    final_output_count: finalOutputCount,
    can_label_live_swarm: canLabelLiveSwarm,
    can_show_valid_memorial: canShowValidMemorial,
    verification_level: verificationLevel,
    user_message: userMessage,
  };
}

export function swarmReceiptDisplay(receipt: SwarmReceipt): string {
  return [
    receipt.user_message,
    `会话：${receipt.session_id}`,
    `状态：${receipt.status}${receipt.release_gate ? ` · 质门：${receipt.release_gate}` : ''}`,
    `运行：${receipt.run_count} 个蜂群记录；完成 ${receipt.completed_runs.join('、') || '—'}；异常 ${
      receipt.failed_runs.join('、') || '—'
    }`,
    `凭证：QA ${receipt.qa_run_count} 条；final_output ${receipt.final_output_count} 份`,
    `LIVE_SWARM：${receipt.can_label_live_swarm ? '可标记' : '不可标记'}；可准奏：${
      receipt.can_show_valid_memorial ? '是' : '否'
    }`,
  ].join('\n');
}
