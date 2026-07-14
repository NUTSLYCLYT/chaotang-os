import type { CourtDoc, CourtDocAction, CourtDocGate, CourtDocGrounding, CourtDocItem, CourtDocLight, CourtDocSourceLabel } from './court-doc';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

const LIGHTS: ReadonlySet<string> = new Set(['green', 'yellow', 'red', 'black']);
const GATES: ReadonlySet<string> = new Set(['passed', 'pending', 'blocked', 'n/a']);
const GROUNDINGS: ReadonlySet<string> = new Set(['rag', 'deterministic', 'none']);
const SOURCE_LABELS: ReadonlySet<string> = new Set(['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO']);
const ACTIONS: ReadonlySet<string> = new Set(['open_annals', 'trace_evidence', 'export_amulet']);
const ITEM_LEVELS: ReadonlySet<string> = new Set(['green', 'yellow', 'red']);

function toItem(value: unknown): CourtDocItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const level = stringValue(record.level);
  if (!ITEM_LEVELS.has(level)) return null;
  return {
    level: level as CourtDocItem['level'],
    title: stringValue(record.title),
    odds: nullableString(record.odds),
    impact: nullableString(record.impact),
    fix: nullableString(record.fix),
    evidenceRef: nullableString(record.evidenceRef),
  };
}

function toCourtDoc(value: unknown): CourtDoc | null {
  const record = asRecord(value);
  if (!record) return null;
  const light = stringValue(record.light);
  if (!LIGHTS.has(light)) return null;
  const sourceLabel = stringValue(record.sourceLabel);
  if (!SOURCE_LABELS.has(sourceLabel)) return null;
  const provenanceRecord = asRecord(record.provenance);
  const gate = stringValue(provenanceRecord?.gate);
  const grounding = stringValue(provenanceRecord?.grounding);
  const caseId = stringValue(record.caseId);
  if (!caseId) return null;

  return {
    caseId,
    light: light as CourtDocLight,
    headline: stringValue(record.headline),
    shielded: nullableString(record.shielded),
    items: Array.isArray(record.items) ? record.items.map(toItem).filter((item): item is CourtDocItem => item !== null) : [],
    actions: Array.isArray(record.actions)
      ? (record.actions.filter((action): action is CourtDocAction => typeof action === 'string' && ACTIONS.has(action)))
      : [],
    provenance: {
      advisors: Array.isArray(provenanceRecord?.advisors)
        ? provenanceRecord.advisors.filter((item): item is string => typeof item === 'string')
        : [],
      grounding: (GROUNDINGS.has(grounding) ? grounding : 'none') as CourtDocGrounding,
      gate: (GATES.has(gate) ? gate : 'n/a') as CourtDocGate,
    },
    sourceLabel: sourceLabel as CourtDocSourceLabel,
    signed: boolValue(record.signed),
    sealedArchive: nullableString(record.sealedArchive),
  };
}

/** GET /api/scribe/archive-docs 的 {success,data:{docs:[...]}}信封 → CourtDoc[]。防御式校验，格式不对的条目直接丢弃而不是让页面崩溃。 */
export function normalizeCourtDocResponse(value: unknown): CourtDoc[] {
  const envelope = asRecord(value);
  const data = envelope && 'data' in envelope ? asRecord(envelope.data) : asRecord(value);
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  return docs.map(toCourtDoc).filter((doc): doc is CourtDoc => doc !== null);
}
