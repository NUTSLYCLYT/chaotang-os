import type { JiqunSessionDetail } from '@/lib/jiqun-api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const child = value[key];
  return isRecord(child) ? child : null;
}

export function extractHubuMemorialFromSession(session: JiqunSessionDetail | undefined): Record<string, unknown> | null {
  if (!session) return null;
  const loopMemorial = recordAt(session.finance_intel_loop, 'memorial');
  if (loopMemorial) return loopMemorial;

  for (const run of session.swarm_runs ?? []) {
    if (run.swarm_id !== 'finance' && run.swarm_id !== 'hu_bu') continue;
    const output = run.final_output;
    const memorial = recordAt(output, 'memorial');
    if (memorial) return memorial;
    if (isRecord(output) && output.department === 'hu_bu') return output;
  }
  return null;
}

export function validateHubuSwarmMemorial(memorial: Record<string, unknown>, fallbackUrls: string[]): string[] {
  const gaps: string[] = [];
  const urls = readStringArray(memorial.sourceUrls).length ? readStringArray(memorial.sourceUrls) : fallbackUrls;
  const formulaTrace = Array.isArray(memorial.formulaTrace) ? memorial.formulaTrace : [];
  if (memorial.department !== 'hu_bu') gaps.push('department_not_hu_bu');
  if (!urls.length) gaps.push('source_urls_missing');
  if (!formulaTrace.length) gaps.push('formula_trace_missing');
  if (memorial.previewOnly !== true) gaps.push('preview_only_not_true');
  if (memorial.executionAllowed !== false) gaps.push('execution_allowed_not_false');
  if (memorial.sideEffects !== 'none') gaps.push('side_effects_not_none');
  if (memorial.nonAdviceDisclaimer !== true) gaps.push('non_advice_disclaimer_missing');
  return gaps;
}
