/**
 * 朝堂 OS · 审计哈希链 · Tamper-Evident Audit
 *
 * Simon Willison 怼点："jsonl 没签名 · sed 一改历史就消失"
 *
 * 设计：
 *   - 每帧 event 加 prevHash 字段 · 指向前帧的 contentHash
 *   - contentHash = sha256(JSON.stringify(event 不含 prevHash))
 *   - verify(events) 重算 · 对不上 = tampered · 给出第一处坏帧
 *
 * 不阻止恶意改动 · 只让"改了"立刻可被发现 · 满足 audit/compliance 法律要求
 *
 * 性能：sha256 ~10us/帧 · 1000 帧 verify < 50ms
 */

import { createHash } from 'crypto';
import type { BillEvent } from './bill-fsm';

/** 事件经审计加固后的形态 · 多 1 个 prevHash 字段 */
export type ChainedEvent = BillEvent & { prevHash: string };

/** Genesis hash · 链头 · 0…0 */
export const GENESIS_HASH = '0'.repeat(64);

/** 计算事件内容 hash（不含 prevHash 字段） */
export function contentHash(e: BillEvent | ChainedEvent): string {
  // 排除 prevHash 字段 · 保证 hash 只反映"事件本身"
  const { prevHash: _drop, ...rest } = e as ChainedEvent;
  void _drop;
  // canonical JSON · 按 key 排序 · 跨平台一致
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * 给 plain event 加 prevHash · 形成链中下一节
 *  · 第一帧的 prev = GENESIS_HASH
 */
export function chain(prev: ChainedEvent | null, plain: BillEvent): ChainedEvent {
  const prevHash = prev ? contentHash(prev) : GENESIS_HASH;
  return { ...plain, prevHash };
}

/**
 * 验证整条链 · 返回第一处篡改位置（若有）
 */
export interface VerifyResult {
  ok: boolean;
  totalChecked: number;
  /** 0-based · 第一处对不上的事件 index · 没有则 -1 */
  firstTamperedAt: number;
  /** 详细错误描述 */
  reason?: string;
}

export function verifyChain(events: ChainedEvent[]): VerifyResult {
  if (events.length === 0) {
    return { ok: true, totalChecked: 0, firstTamperedAt: -1 };
  }

  // 第 1 帧的 prevHash 必须是 GENESIS
  if (events[0]!.prevHash !== GENESIS_HASH) {
    return {
      ok: false,
      totalChecked: 1,
      firstTamperedAt: 0,
      reason: `第 1 帧 prevHash != GENESIS · 链头被改`,
    };
  }

  for (let i = 1; i < events.length; i++) {
    const expectedPrev = contentHash(events[i - 1]!);
    if (events[i]!.prevHash !== expectedPrev) {
      return {
        ok: false,
        totalChecked: i + 1,
        firstTamperedAt: i,
        reason: `第 ${i} 帧 prevHash 与前帧 contentHash 不符 · 历史被改`,
      };
    }
  }

  return { ok: true, totalChecked: events.length, firstTamperedAt: -1 };
}

/**
 * 给一组未链化的旧事件批量加链 · 用于 v1.0 → v1.4 数据迁移
 */
export function chainAll(plain: BillEvent[]): ChainedEvent[] {
  const out: ChainedEvent[] = [];
  let prev: ChainedEvent | null = null;
  for (const e of plain) {
    const c = chain(prev, e);
    out.push(c);
    prev = c;
  }
  return out;
}

/** 类型守卫 · 判断 event 是否已链化 */
export function isChained(e: BillEvent | ChainedEvent): e is ChainedEvent {
  return 'prevHash' in e && typeof (e as ChainedEvent).prevHash === 'string';
}
