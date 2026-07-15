type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Canonical ledger events -> the stable BattleStream event vocabulary. */
export function adaptCanonicalCourtStreamEvent(value: unknown): UnknownRecord | null {
  const event = asRecord(value);
  if (!event) return null;
  if (event.type !== 'canonical.event' && event.type !== 'canonical.snapshot') {
    return event;
  }

  const taskId = text(event.taskId);
  if (!taskId) return null;
  if (event.type === 'canonical.snapshot') {
    if (event.terminal !== true) return null;
    const status = text(event.status);
    if (status === 'failed') {
      return {
        type: 'error',
        taskId,
        message: text(event.error) ?? '任务执行失败',
      };
    }
    return { type: 'done', taskId, runId: text(event.runId) };
  }

  const eventType = text(event.eventType);
  const payload = asRecord(event.payload) ?? {};
  if (eventType === 'memorial.formalized') {
    return {
      type: 'memorial.drafted',
      taskId,
      runId: text(payload.swarm_run_id),
      memorialId: text(payload.formal_memorial_id),
    };
  }
  if (eventType === 'reports.completed') {
    return {
      type: 'council.aggregated',
      taskId,
      summary: text(event.message) ?? '',
    };
  }
  if (eventType === 'quality.blocked') {
    return {
      type: 'risk.flagged',
      taskId,
      level: 'high',
      label: '质量门阻断',
      detail: text(event.message) ?? '',
    };
  }
  if (
    eventType === 'dispatch.started'
    || eventType === 'dispatch.queued'
    || eventType === 'routing.decided'
  ) {
    return { type: 'council.summon', taskId };
  }
  return null;
}
