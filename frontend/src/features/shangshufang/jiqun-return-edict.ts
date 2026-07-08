import type { JiqunSessionDetail } from '@/lib/jiqun-api';
import type { PersistedJiqunFinalOutputBlock } from '@/lib/contracts/shangshufang';
import type { EdictRow, EdictView } from './edict-content';
import { buildSwarmReceipt, swarmReceiptDisplay } from './swarm-receipt';

type Dict = Record<string, unknown>;

type FinalOutputBlock = PersistedJiqunFinalOutputBlock;

const RETURN_LABEL = '蜂群回奏';
const RETURN_BADGE = '蜂群已回奏';
// 正文滚动区负责承载长内容（memorial-rows overflow-y-auto），这里只设防爆护栏、不做阅读性截断：
// 旧值 360 字符/字段、10 字段会把蜂群回奏的方案正文拦腰截断，滚动条也救不回被丢弃的部分
const MAX_FIELDS_PER_OUTPUT = 24;
const MAX_VALUE_CHARS = 4000;

function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function clip(value: string, max = MAX_VALUE_CHARS): string {
  const text = normalizeText(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function stringifyValue(value: unknown, max = MAX_VALUE_CHARS): string {
  if (value == null) return '';
  if (typeof value === 'string') return clip(value, max);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item, Math.max(120, Math.floor(max / 2))))
      .filter(Boolean)
      .slice(0, 12)
      .map((item) => `- ${item}`)
      .join('\n');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, v]) => v != null && stringifyValue(v, 80).length > 0)
      .slice(0, 16)
      .map(([k, v]) => `${k}: ${stringifyValue(v, 600)}`)
      .join('\n');
  }
  return clip(String(value), max);
}

function compactLabel(label: string): string {
  return label.replace(/\s/g, '');
}

function isReturnRow(row: EdictRow): boolean {
  return compactLabel(row.label).startsWith(RETURN_LABEL);
}

function payloadOf(event: unknown): Dict | null {
  if (!isRecord(event)) return null;
  const payload = event.payload;
  return isRecord(payload) ? payload : null;
}

function finalOutputRecord(value: unknown): Dict | null {
  if (isRecord(value)) return value;
  if (Array.isArray(value) && stringifyValue(value, 64)) return { items: value };
  if (typeof value === 'string' && value.trim()) return { result: value.trim() };
  if (typeof value === 'number' || typeof value === 'boolean') return { result: value };
  return null;
}

function candidateFinalOutput(record: Dict): Dict | null {
  return (
    finalOutputRecord(record.final_output) ??
    finalOutputRecord(record.finalOutput) ??
    finalOutputRecord(record.output) ??
    finalOutputRecord(record.result)
  );
}

function appendFinalOutputBlock(
  blocks: FinalOutputBlock[],
  seen: Set<string>,
  block: FinalOutputBlock,
) {
  const fingerprint = JSON.stringify(block.output).slice(0, 1200);
  const key = `${block.swarmId ?? ''}|${block.runId ?? ''}|${fingerprint}`;
  if (seen.has(key)) return;
  seen.add(key);
  blocks.push(block);
}

export function extractJiqunFinalOutputs(session: JiqunSessionDetail): FinalOutputBlock[] {
  const blocks: FinalOutputBlock[] = [];
  const seen = new Set<string>();
  for (const event of session.events ?? []) {
    const payload = payloadOf(event);
    if (!payload) continue;
    const finalOutput = candidateFinalOutput(payload);
    if (!finalOutput) continue;
    appendFinalOutputBlock(blocks, seen, {
      topic: typeof event.topic === 'string' ? event.topic : '',
      swarmId: typeof payload.swarm_id === 'string' ? payload.swarm_id : null,
      runId: typeof payload.run_id === 'string' ? payload.run_id : null,
      qualityScore: typeof payload.quality_score === 'number' ? payload.quality_score : null,
      output: finalOutput,
    });
  }
  for (const run of session.swarm_runs ?? []) {
    const runRecord = isRecord(run) ? run : {};
    const finalOutput = candidateFinalOutput(runRecord);
    if (!finalOutput) continue;
    appendFinalOutputBlock(blocks, seen, {
      topic: `${run.swarm_id}.final_output`,
      swarmId: run.swarm_id || null,
      runId: run.run_id || null,
      qualityScore: typeof run.quality_score === 'number' ? run.quality_score : null,
      output: finalOutput,
    });
  }
  return blocks;
}

function outputBlockToRow(block: FinalOutputBlock, sessionId: string, index: number): EdictRow {
  const meta = [
    `会话 ${sessionId}`,
    block.swarmId ? `蜂群 ${block.swarmId}` : null,
    block.runId ? `run ${block.runId}` : null,
    block.qualityScore != null ? `质量 ${block.qualityScore}` : null,
  ].filter(Boolean);
  const entries = Object.entries(block.output).filter(([, value]) => stringifyValue(value, 32).length > 0);
  const shown = entries.slice(0, MAX_FIELDS_PER_OUTPUT).map(([key, value]) => `${key}：${stringifyValue(value)}`);
  const omitted =
    entries.length > shown.length ? [`另有 ${entries.length - shown.length} 项，详见蜂群流程会话。`] : [];
  return {
    label: index === 0 ? RETURN_LABEL : `${RETURN_LABEL} ${index + 1}`,
    body: [meta.join(' · '), ...shown, ...omitted].filter(Boolean).join('\n'),
  };
}

export function jiqunFinalOutputText(session: JiqunSessionDetail): string | null {
  const outputs = extractJiqunFinalOutputs(session);
  if (outputs.length === 0) return null;
  return outputs
    .slice(0, 3)
    .map((block, index) => outputBlockToRow(block, session.session_id, index).body)
    .filter(Boolean)
    .join('\n\n');
}

function fallbackReturnRow(session: JiqunSessionDetail): EdictRow {
  const completed = `${session.completed_count ?? 0}/${session.swarm_count ?? 0}`;
  const failedRuns = (session.swarm_runs ?? [])
    .filter((run) => run.status === 'failed' || run.error)
    .map((run) => `${run.swarm_id}${run.error ? `：${run.error}` : ''}`);
  return {
    label: RETURN_LABEL,
    body:
      `会话 ${session.session_id} 已结束，状态 ${session.status}，完成 ${completed}。` +
      (failedRuns.length > 0
        ? `\n异常：${failedRuns.slice(0, 4).join('\n')}`
        : '\n本次会话未写入 final_output，正文仅能回填运行状态。'),
  };
}

export function buildJiqunReturnRows(session: JiqunSessionDetail): EdictRow[] {
  const receipt = buildSwarmReceipt(session);
  const receiptRow: EdictRow = {
    label: '验 真',
    body: swarmReceiptDisplay(receipt),
  };
  const outputs = extractJiqunFinalOutputs(session);
  if (outputs.length === 0) return [receiptRow, fallbackReturnRow(session)];
  return [receiptRow, ...outputs.slice(0, 3).map((block, index) => outputBlockToRow(block, session.session_id, index))];
}

export function mergeJiqunReturnIntoEdict(view: EdictView, session: JiqunSessionDetail): EdictView {
  const receipt = buildSwarmReceipt(session);
  const returnText = jiqunFinalOutputText(session);
  const fallbackText = fallbackReturnRow(session).body;
  const rowsWithoutReturn = view.rows.filter((row) => !isReturnRow(row) && !['来源', '主判', '红线', '后令', '追溯'].includes(row.label));
  const insertAt = Math.min(rowsWithoutReturn.length, 2);
  const badges = view.meta?.badges ?? [];
  const hasReturnBadge = badges.some((badge) => badge.label === RETURN_BADGE);
  const returnSource: EdictRow = {
    label: '来源',
    body: ['jiqun_ai 蜂群回奏', swarmReceiptDisplay(receipt)].join('\n'),
  };
  const returnMain: EdictRow = {
    label: '主判',
    body: returnText ?? fallbackText,
  };
  const returnRisk: EdictRow = {
    label: '红线',
    body:
      receipt.verification_level === 'verified_clear'
        ? '质量门已放行；仍需按证据边界与业务责任裁决。'
        : receipt.user_message,
  };
  const returnAction: EdictRow = {
    label: '后令',
    body: receipt.can_show_valid_memorial
      ? '可进入裁决；如涉及对外承诺、付款、合同或不可逆动作，仍需人工确认。'
      : '先补证、复核或重跑蜂群；不得作为最终奏折直接采纳。',
  };
  const returnTrace: EdictRow = {
    label: '追溯',
    body: [
      `session: ${session.session_id}`,
      `status: ${session.status}`,
      session.release_gate ? `release_gate: ${session.release_gate}` : null,
      `final_output: ${receipt.final_output_count}`,
    ].filter(Boolean).join('\n'),
  };

  return {
    ...view,
    id: `${view.id}:jiqun:${session.session_id}`,
    subtitle: view.subtitle?.includes(RETURN_BADGE)
      ? view.subtitle
      : [view.subtitle, RETURN_BADGE].filter(Boolean).join(' · '),
    meta: {
      ...view.meta,
      badges: hasReturnBadge ? badges : [...badges, { label: RETURN_BADGE, tone: 'green' as const }],
    },
    rows: [
      ...rowsWithoutReturn.slice(0, insertAt),
      returnSource,
      returnMain,
      returnRisk,
      returnAction,
      returnTrace,
      ...rowsWithoutReturn.slice(insertAt),
    ],
  };
}

export function jiqunReturnChatText(session: JiqunSessionDetail): string {
  const receipt = buildSwarmReceipt(session);
  if (receipt.verification_level === 'verified_blocked') {
    return `后端蜂群真实完成，会话 ${session.session_id}，但质量门阻断；正文已追加“验真”和“${RETURN_LABEL}”，本次只能补证/复核，不能准奏归档。`;
  }
  if (receipt.verification_level !== 'verified_clear') {
    return `后端蜂群会话 ${session.session_id} 已返回，但验真不完整；正文已追加“验真”，不能作为最终裁决依据。`;
  }
  const outputs = extractJiqunFinalOutputs(session);
  if (outputs.length === 0) {
    return `后端蜂群已结束，会话 ${session.session_id}，但未写入 final_output；正文已回填运行状态。`;
  }
  const firstKeys = Object.keys(outputs[0]?.output ?? {}).slice(0, 4).join('、');
  return `后端蜂群已回奏，会话 ${session.session_id}，共 ${outputs.length} 份结果；${firstKeys ? `要点字段：${firstKeys}。` : ''}正文已追加“${RETURN_LABEL}”。`;
}
