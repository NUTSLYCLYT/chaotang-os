import type { VerdictCardData } from '@/features/scribe/lib/verdict-card';

const SHARE_ROUTE = '/share/verdict';
const MAX_HIGHLIGHTS = 3;
const MAX_HIGHLIGHT_LENGTH = 72;
const MAX_VERDICT_LENGTH = 84;
const MAX_DATE_LENGTH = 32;
const ALLOWED_VERDICTS = new Set(['准', '驳', '再议', '行', '查']);

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const bytes = base64ToBytes(padded);
  return new TextDecoder().decode(bytes);
}

export function sanitizeVerdictCardData(data: VerdictCardData): VerdictCardData | null {
  const highlights = Array.isArray(data.highlights)
    ? data.highlights
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, MAX_HIGHLIGHTS)
        .map((item) => item.slice(0, MAX_HIGHLIGHT_LENGTH))
    : [];

  const primeMinisterVerdict = data.primeMinisterVerdict?.trim().slice(0, MAX_VERDICT_LENGTH);
  const date = data.date?.trim().slice(0, MAX_DATE_LENGTH);
  const verdict =
    data.verdict && ALLOWED_VERDICTS.has(data.verdict) ? data.verdict : undefined;

  if (highlights.length === 0 || !primeMinisterVerdict) {
    return null;
  }

  return {
    highlights,
    primeMinisterVerdict,
    date: date || undefined,
    verdict,
  };
}

export function encodeVerdictCardPayload(data: VerdictCardData): string {
  const sanitized = sanitizeVerdictCardData(data);
  if (!sanitized) {
    throw new Error('invalid verdict card share payload');
  }

  return toBase64Url(JSON.stringify(sanitized));
}

export function decodeVerdictCardPayload(payload: string | null | undefined): VerdictCardData | null {
  if (!payload) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as VerdictCardData;
    return sanitizeVerdictCardData(parsed);
  } catch {
    return null;
  }
}

export function buildVerdictShareHref(data: VerdictCardData): string {
  const params = new URLSearchParams({ payload: encodeVerdictCardPayload(data) });
  return `${SHARE_ROUTE}?${params.toString()}`;
}

