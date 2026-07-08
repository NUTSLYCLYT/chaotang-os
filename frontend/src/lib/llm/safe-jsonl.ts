/**
 * 朝堂 OS · 多进程安全的 JSONL append + rotation
 *
 * v1.2 缺陷：fs.appendFile 在多进程下，单条 > PIPE_BUF (4096B) 会撕裂
 *           文件无大小上限 · 1 个月后 100MB 起跳
 *
 * v1.3 修复：
 *   1. POSIX O_APPEND 单 write < PIPE_BUF 是原子的（kernel 保证）· 主动截断超长条
 *   2. 写前检查文件大小 · 超 N MB 自动 rotate（rename → .0, .1, .2...）· 保留最近 3 份
 *   3. 单文件原子 append · 用 fsPromises.open + fileHandle.appendFile + close
 *
 * 适用：单机多进程 / 容器多副本（共享卷）
 * 不适用：跨主机 · 跨主机请上 postgres / clickhouse
 */

import { promises as fs } from 'fs';

const PIPE_BUF_SAFE = 3500; // POSIX 4096 留余量
const ROTATE_BYTES = 5 * 1024 * 1024; // 5 MB
const KEEP_FILES = 3;

const sizeCheckCache = new Map<string, { size: number; checkedAt: number }>();
const SIZE_CACHE_TTL_MS = 30_000;

/**
 * 单条 JSONL 超出 PIPE_BUF 原子写余量时抛出 · 用于治理事件「拒写而非静默截断」
 *
 * 普通遥测/lesson 仍走默认截断（向后兼容）；只有显式 opts.noTruncate === true
 * 的调用方（如 bill-store 事件溯源）会收到本错误，配套由调用层给出明确 4xx。
 */
export class JsonlTooLongError extends Error {
  readonly size: number;
  readonly limit: number;

  constructor(size: number, limit: number) {
    super(`JSONL line too long: ${size}B exceeds atomic-write limit ${limit}B`);
    this.name = 'JsonlTooLongError';
    this.size = size;
    this.limit = limit;
  }
}

async function getSize(path: string): Promise<number> {
  const cached = sizeCheckCache.get(path);
  if (cached && Date.now() - cached.checkedAt < SIZE_CACHE_TTL_MS) {
    return cached.size;
  }
  try {
    const stat = await fs.stat(path);
    sizeCheckCache.set(path, { size: stat.size, checkedAt: Date.now() });
    return stat.size;
  } catch {
    return 0;
  }
}

async function rotate(path: string): Promise<void> {
  // 从尾往头 · 防覆盖
  for (let i = KEEP_FILES - 1; i >= 1; i--) {
    const src = `${path}.${i - 1}`;
    const dst = `${path}.${i}`;
    try {
      await fs.rename(src, dst);
    } catch {
      // 不存在就跳
    }
  }
  try {
    await fs.rename(path, `${path}.0`);
  } catch {
    /* noop */
  }
  sizeCheckCache.delete(path);
}

/**
 * 多进程安全 append · 单条
 *
 * @param opts.noTruncate true 时超长 throw JsonlTooLongError（不静默截断），
 *        用于治理事件溯源等不可丢数据的场景。默认 undefined → 保持原截断行为。
 */
export async function safeAppend(
  path: string,
  line: string,
  opts?: { noTruncate?: boolean },
): Promise<void> {
  // 1. 截断超长 · 防 PIPE_BUF 撕裂
  let payload = line;
  if (payload.length > PIPE_BUF_SAFE) {
    if (opts?.noTruncate === true) {
      // 治理事件：拒写而非静默截断，由调用层给出明确 4xx
      throw new JsonlTooLongError(payload.length, PIPE_BUF_SAFE);
    }
    const truncated = payload.slice(0, PIPE_BUF_SAFE - 50);
    payload = truncated + `…<truncated@${payload.length}B>`;
  }
  if (!payload.endsWith('\n')) payload += '\n';

  // 2. 检查 size · 超阈 rotate
  const size = await getSize(path);
  if (size > ROTATE_BYTES) {
    await rotate(path);
  }

  // 3. 用 fileHandle.appendFile · 显式 flag 'a' = O_APPEND · POSIX 保证 < PIPE_BUF 原子
  const fh = await fs.open(path, 'a');
  try {
    await fh.appendFile(payload, 'utf-8');
    // size cache 增量
    const cached = sizeCheckCache.get(path);
    if (cached) cached.size += payload.length;
  } finally {
    await fh.close();
  }
}

/** 给 audit reader 用 · 按时间倒序读所有 rotation */
export async function readAllRotations(path: string): Promise<string[]> {
  const lines: string[] = [];
  const candidates = [path, ...Array.from({ length: KEEP_FILES }, (_, i) => `${path}.${i}`)];
  for (const p of candidates) {
    try {
      const txt = await fs.readFile(p, 'utf-8');
      for (const line of txt.split('\n')) {
        if (line.trim()) lines.push(line);
      }
    } catch {
      /* 不存在跳过 */
    }
  }
  return lines;
}

/** Test-only · 清缓存 */
export function _resetForTest(): void {
  sizeCheckCache.clear();
}
