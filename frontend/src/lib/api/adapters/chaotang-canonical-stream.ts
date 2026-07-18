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
    // "done" 是这个词汇表里唯一的成功终态，只能对明确认识的成功状态发——
    // 之前是反过来写的(只有 status === 'failed' 才不算成功，其余一律 done)，
    // 任何新终态(比如 menxia_veto_pending 这种被拦住、需要人工确认的状态)
    // 只要没显式改成 'failed'，就会被这条兜底逻辑误报成任务成功完成，
    // 违反了这个文件自己测试标题写的"without inventing success"
    // (2026-07-18 实测：门下省封驳被 SSE 报成 done)。改成白名单：只有明确
    // 认识的成功状态才是 done，其余(封驳/失败/未来任何新状态)一律不算成功。
    const SUCCESS_STATUSES = new Set(['report_ready', 'reviewed', 'archived', 'direct_completed']);
    if (status && SUCCESS_STATUSES.has(status)) {
      return { type: 'done', taskId, runId: text(event.runId) };
    }
    return {
      type: 'error',
      taskId,
      message: text(event.error)
        ?? (status === 'menxia_veto_pending' ? '门下省封驳，需人工确认后才能派单。' : null)
        ?? '任务执行失败',
    };
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
