import type { AgentCode } from '@/lib/contracts/agent';
import type { DepartmentLearningRealSourceAction } from '@/lib/contracts/department-learning';
import type { ShiguanArchiveRecordV1 } from '@/lib/shangshufang/local-decision-loop';
import { resolveDepartmentAgentCode } from '@/lib/contracts/dept';
import { applyDepartmentLearningRealSource } from './real-source';
import { loadLearningRecords } from './store';

function archiveAgents(record: ShiguanArchiveRecordV1): Set<AgentCode> {
  const ids = [
    ...(record.draft_edict.suggested_perspectives ?? []),
    ...(record.draft_edict.recommended_departments ?? []),
    ...(record.memorial.department_memorials ?? []).map((item) => item.department_id),
  ];
  return new Set(ids.map(resolveDepartmentAgentCode).filter((agent): agent is AgentCode => Boolean(agent)));
}

function pendingBossEvidence(evidence: string[]): {
  action: DepartmentLearningRealSourceAction;
  evidenceId: string;
} | null {
  if (!evidence.includes('archive:pending')) return null;
  const actionRaw = evidence
    .find((item) => item.startsWith('real_source:boss_signoff:'))
    ?.replace('real_source:boss_signoff:', '');
  if (actionRaw !== 'signed' && actionRaw !== 'edited' && actionRaw !== 'rejected') return null;
  const decision = evidence.find((item) => /^boss_decision:\d+$/.test(item));
  return decision ? { action: actionRaw, evidenceId: decision } : null;
}

export async function backfillDepartmentLearningFromArchive(
  archive: ShiguanArchiveRecordV1,
): Promise<{ scanned: number; promoted: number }> {
  const agents = archiveAgents(archive);
  if (agents.size === 0) return { scanned: 0, promoted: 0 };

  const records = await loadLearningRecords();
  let promoted = 0;

  for (const record of records) {
    if (!agents.has(record.agentCode)) continue;
    const pending = pendingBossEvidence(record.evidence);
    if (!pending) continue;
    const result = await applyDepartmentLearningRealSource({
      source: 'boss_signoff',
      action: pending.action,
      agentCode: record.agentCode,
      evidenceId: pending.evidenceId,
      archiveId: archive.archive_id,
      // 会审HIGH修复(2026-07-03)：把"这次真正在处理的归档属于哪个taskId"传给real-source.ts，
      // 让它能验证这条pending签核跟这次归档是不是真的对得上，而不是"任意归档存在就算数"。
      expectedTaskId: archive.task_id,
    });
    if (result.applied && result.record?.verdict !== 'observing') promoted += 1;
  }

  return { scanned: records.length, promoted };
}
