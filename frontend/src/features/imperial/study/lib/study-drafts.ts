'use client';

import type { StudyOfficialCode } from './study-officials';

const STORAGE_PREFIX = 'courtos.study.draft';

export interface StudyDraftSnapshot {
  content: string;
  version: number;
  updatedAt: string;
  label?: string;
  note?: string;
}

export interface StudyDraftState {
  current: StudyDraftSnapshot;
  history: StudyDraftSnapshot[];
}

export interface StudyOfficialDraftSeed {
  name: string;
  summary: string;
  prompts: readonly string[];
  dossier: readonly string[];
}

export function buildDefaultMemorialDraft(seed: StudyOfficialDraftSeed) {
  return [
    `【${seed.name}呈】`,
    '',
    '臣已查阅当前议题所涉资料，现将核心判断与建议条列如下：',
    '',
    `一、当前职责判断：${seed.summary}`,
    `二、当下最值得先问的问题：${seed.prompts[0]}`,
    `三、当前最值得先看的 dossier：${seed.dossier[0]}`,
    '',
    '【请陛下批示】',
  ].join('\n');
}

export function loadStudyDraft(code: StudyOfficialCode, fallback: string): StudyDraftState {
  if (typeof window === 'undefined') {
    return {
      current: { content: fallback, version: 1, updatedAt: '未保存' },
      history: [],
    };
  }

  const raw = window.localStorage.getItem(getStorageKey(code));
  if (!raw) {
    return {
      current: { content: fallback, version: 1, updatedAt: '未保存' },
      history: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as StudyDraftState | StudyDraftSnapshot;
    if ('current' in parsed) {
      return {
        current: {
          content: parsed.current.content || fallback,
          version: parsed.current.version || 1,
          updatedAt: parsed.current.updatedAt || '未保存',
          label: parsed.current.label,
          note: parsed.current.note,
        },
        history: Array.isArray(parsed.history)
          ? parsed.history.slice(0, 8).map((item) => ({
              content: item.content,
              version: item.version || 1,
              updatedAt: item.updatedAt || '未保存',
              label: item.label,
              note: item.note,
            }))
          : [],
      };
    }

    return {
      current: {
        content: parsed.content || fallback,
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || '未保存',
        label: parsed.label,
        note: parsed.note,
      },
      history: [],
    };
  } catch {
    return {
      current: { content: fallback, version: 1, updatedAt: '未保存' },
      history: [],
    };
  }
}

export function saveStudyDraft(
  code: StudyOfficialCode,
  content: string,
  previous?: StudyDraftState | null,
): StudyDraftState {
  const fallback = previous ?? {
    current: { content, version: 1, updatedAt: '未保存' },
    history: [],
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  const prior = previous ?? loadStudyDraft(code, content);
  if (prior.current.content === content && prior.current.updatedAt !== '未保存') {
    return prior;
  }

  const next: StudyDraftSnapshot = {
    content,
    version: prior.current.content === content ? prior.current.version : prior.current.version + 1,
    updatedAt: new Date().toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const history = [
    next,
    ...prior.history.filter((item) => item.version !== next.version),
    ...(prior.current.updatedAt !== '未保存' ? [prior.current] : []),
  ].slice(0, 8);

  const payload: StudyDraftState = {
    current: next,
    history,
  };

  window.localStorage.setItem(getStorageKey(code), JSON.stringify(payload));
  return payload;
}


export function commitStudyDraft(
  code: StudyOfficialCode,
  previous: StudyDraftState,
  meta?: { label?: string; note?: string },
): StudyDraftState {
  const now = new Date().toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nextCurrent: StudyDraftSnapshot = {
    ...previous.current,
    updatedAt: now,
    label: meta?.label?.trim() || previous.current.label || `御稿 v${previous.current.version}`,
    note: meta?.note?.trim() || previous.current.note || '未附备注',
  };

  const payload: StudyDraftState = {
    current: nextCurrent,
    history: [
      nextCurrent,
      ...previous.history.filter((item) => item.version !== nextCurrent.version),
    ].slice(0, 8),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(code), JSON.stringify(payload));
  }

  return payload;
}

export function restoreStudyDraft(
  code: StudyOfficialCode,
  version: number,
  previous?: StudyDraftState | null,
): StudyDraftState | null {
  const current = previous ?? loadStudyDraft(code, '');
  const target =
    current.current.version == version
      ? current.current
      : current.history.find((item) => item.version === version);

  if (!target) return null;

  const payload: StudyDraftState = {
    current: {
      ...target,
      updatedAt: new Date().toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
    history: [
      current.current,
      ...current.history.filter((item) => item.version !== target.version),
    ].slice(0, 6),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(code), JSON.stringify(payload));
  }

  return payload;
}

function getStorageKey(code: StudyOfficialCode) {
  return `${STORAGE_PREFIX}.${code}`;
}
