/**
 * 朝堂 OS · Lesson Store · 持久化 + 内存索引
 *
 * 复用 safe-jsonl（多进程安全）· 重启 reload
 * 查询模式：by billId / recall by text / list all
 */

import { safeAppend, readAllRotations } from '@/lib/llm/safe-jsonl';
import type { ExtractedLesson } from './lesson-extractor';

const STORE_PATH = process.env.SCRIBE_LESSONS_PATH ?? '/tmp/courtos-lessons.jsonl';

const byBill = new Map<string, ExtractedLesson>();
let loaded = false;

async function reload(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const lines = await readAllRotations(STORE_PATH);
    for (const line of lines) {
      try {
        const l = JSON.parse(line) as ExtractedLesson;
        // 后写覆盖前写 · 同 bill 多次 extract 保留最新
        byBill.set(l.billId, l);
      } catch {
        /* skip bad lines */
      }
    }
  } catch {
    /* 空库 · 跳过 */
  }
}

export async function saveLesson(lesson: ExtractedLesson): Promise<void> {
  await reload();
  byBill.set(lesson.billId, lesson);
  await safeAppend(STORE_PATH, JSON.stringify(lesson));
}

export async function getLesson(billId: string): Promise<ExtractedLesson | null> {
  await reload();
  return byBill.get(billId) ?? null;
}

export async function listLessons(): Promise<ExtractedLesson[]> {
  await reload();
  return Array.from(byBill.values()).sort((a, b) =>
    b.extractedAt.localeCompare(a.extractedAt),
  );
}

/** 测试用 */
export function _resetForTest(): void {
  byBill.clear();
  loaded = false;
}
