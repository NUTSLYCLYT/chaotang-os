/**
 * 朝堂 OS · 三省审议台 · 案卷看板
 *
 * 左：案列表（可筛 state）+ 起草新案
 * 右：选中案的三栏时间线 + 转移操作 + 审计验证按钮
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { BillTimeline } from './bill-timeline';
import { toast } from 'sonner';
import { Plus, RefreshCw, ShieldCheck, Send, UserCheck, ShieldAlert } from 'lucide-react';
import type { Bill, BillState, EventType, Actor } from '@/features/governance/lib/bill-fsm';
import { legalNextEvents } from '@/features/governance/lib/bill-fsm';
import { backendFetch } from '@/lib/backend-api';

const ACTOR_LABEL: Record<Actor, string> = {
  ruler: '陛下',
  zhongshu: '中书',
  menxia: '门下',
  shangshu: '尚书',
  liubu: '六部',
  system: '系统',
};

const EVENT_LABEL: Record<EventType, string> = {
  create: '起草',
  submit_to_review: '送审',
  approve: '准',
  reject_for_revision: '驳改',
  reject_final: '终驳',
  shelve: '搁置',
  resubmit: '再呈',
  dispatch: '派下',
  mark_completed: '已成',
  mark_failed: '已败',
  archive: '入史馆',
};

const STATE_LABEL: Record<BillState, string> = {
  drafted: '起草',
  under_review: '审议',
  revising: '修改',
  approved: '已准',
  executing: '执行',
  completed: '已成',
  failed: '已败',
  rejected: '终驳',
  shelved: '搁置',
  archived: '史馆',
};

const STATE_COLOR: Record<BillState, string> = {
  drafted: '#F0C66A',
  under_review: '#FB923C',
  revising: '#F0C66A',
  approved: '#3DD68C',
  executing: '#60A5FA',
  completed: '#3DD68C',
  failed: '#F43F5E',
  rejected: '#F43F5E',
  shelved: '#8A92AC',
  archived: '#A78BFA',
};

/** 同 bill-fsm TRANSITIONS 的 actor 映射 · 给 UI 一键填 actor */
const ACTOR_FOR_EVENT: Record<EventType, Actor> = {
  create: 'zhongshu',
  submit_to_review: 'zhongshu',
  approve: 'menxia',
  reject_for_revision: 'menxia',
  reject_final: 'ruler',
  shelve: 'ruler',
  resubmit: 'zhongshu',
  dispatch: 'shangshu',
  mark_completed: 'liubu',
  mark_failed: 'liubu',
  archive: 'system',
};

interface AuditSummary {
  totalBills: number;
  okCount: number;
  tamperedCount: number;
  totalFrames: number;
  tampered: Array<{ billId: string; title: string; firstTamperedAt: number; reason?: string }>;
}

export function BillsBoard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCommand, setNewCommand] = useState('');
  const [currentActor, setCurrentActor] = useState<Actor>('liubu');
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch('/api/governance/bills');
      const data = (await res.json()) as { bills: Bill[]; count: number };
      setBills(data.bills);
      if (!activeId && data.bills.length > 0) setActiveId(data.bills[0]!.id);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void refresh();
    void (async () => {
      try {
        const res = await backendFetch('/api/governance/whoami');
        const data = (await res.json()) as { actor: Actor };
        setCurrentActor(data.actor);
      } catch {
        /* ignore */
      }
    })();
  }, [refresh]);

  async function changeActor(actor: Actor) {
    try {
      const res = await backendFetch('/api/governance/whoami', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCurrentActor(actor);
      toast.success(`身份已切换 · 当前 ${ACTOR_LABEL[actor]}`);
    } catch (err) {
      toast.error('身份切换失败', { description: String(err) });
    }
  }

  async function runFullAudit() {
    try {
      const res = await backendFetch('/api/governance/audit/summary');
      const data = (await res.json()) as AuditSummary;
      setAuditSummary(data);
      if (data.tamperedCount > 0) {
        toast.error('史馆遭篡改', {
          description: `${data.tamperedCount} 案被改 · ${data.okCount} 案完整 · 共 ${data.totalFrames} 帧已校验`,
          icon: '⚠️',
        });
      } else {
        toast.success('全卷审计通过', {
          description: `${data.totalBills} 案 · ${data.totalFrames} 帧 · 无任何改动`,
          icon: '🔐',
        });
      }
    } catch (err) {
      toast.error('全卷审计失败', { description: String(err) });
    }
  }

  const active = bills.find((b) => b.id === activeId) ?? null;

  async function handleCreate() {
    if (newCommand.trim().length < 5) {
      toast.error('指令太短 · 至少 5 字');
      return;
    }
    setCreating(true);
    try {
      const res = await backendFetch('/api/governance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: newCommand.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bill = (await res.json()) as Bill;
      setBills((b) => [bill, ...b]);
      setActiveId(bill.id);
      setNewCommand('');
      toast.success(`案 ${bill.id.slice(0, 12)} 已起草`);
    } catch (err) {
      toast.error('起草失败', { description: String(err) });
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition(billId: string, type: EventType) {
    const reason = window.prompt(`理由（${EVENT_LABEL[type]}）：`);
    if (!reason || reason.trim().length < 2) return;
    const cur = bills.find((b) => b.id === billId);
    const expectedEventCount = cur?.events.length;

    try {
      const res = await backendFetch(`/api/governance/bills/${billId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          actor: ACTOR_FOR_EVENT[type],
          reason: reason.trim(),
          expectedEventCount,
        }),
      });
      if (res.status === 409) {
        toast.error('案被他人改过 · 已自动刷新', { icon: '🔄' });
        await refresh();
        return;
      }
      if (res.status === 422) {
        const err = (await res.json()) as { error: string };
        toast.error('转移不合法', { description: err.error });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as Bill;
      setBills((b) => b.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(`${EVENT_LABEL[type]} · ${updated.state}`);
    } catch (err) {
      toast.error('操作失败', { description: String(err) });
    }
  }

  async function handleVerify(billId: string) {
    try {
      const res = await backendFetch(`/api/governance/bills/${billId}/audit`);
      const data = (await res.json()) as {
        ok: boolean;
        totalChecked: number;
        firstTamperedAt: number;
        reason?: string;
      };
      if (data.ok) {
        toast.success('审计通过 · 全链未被改动', {
          description: `已校验 ${data.totalChecked} 帧 · hash chain intact`,
          icon: '🔐',
        });
      } else {
        toast.error('审计失败 · 历史被改动', {
          description: `第 ${data.firstTamperedAt} 帧异常 · ${data.reason ?? ''}`,
          icon: '⚠️',
        });
      }
    } catch (err) {
      toast.error('审计调用失败', { description: String(err) });
    }
  }

  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners>
      {/* 顶栏 · 身份切换 + 全卷审计 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
        style={{ borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.06)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A78BFA]">
            <UserCheck size={12} />
            当前身份
          </span>
          <select
            value={currentActor}
            onChange={(e) => changeActor(e.target.value as Actor)}
            className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[12px] text-[#F5E9C9] focus:outline-none"
          >
            <option value="ruler">陛下 · ruler（御前权 · 可代他人）</option>
            <option value="zhongshu">中书 · zhongshu（起草 / 再呈）</option>
            <option value="menxia">门下 · menxia（驳议）</option>
            <option value="shangshu">shangshu（执行）</option>
            <option value="liubu">六部 · liubu（回执）</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {auditSummary && (
            <span className="text-[11px] text-[#9AA3C4]">
              {auditSummary.tamperedCount === 0 ? (
                <span className="text-[#3DD68C]">✓ 全 {auditSummary.totalBills} 案 / {auditSummary.totalFrames} 帧未改</span>
              ) : (
                <span className="text-[#F43F5E]">⚠ {auditSummary.tamperedCount}/{auditSummary.totalBills} 案遭篡改</span>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={runFullAudit}
            className="flex items-center gap-1.5 rounded-md border border-[#A78BFA]/45 bg-[#A78BFA]/10 px-3 py-1 text-[11px] font-semibold text-[#A78BFA] transition hover:bg-[#A78BFA]/18"
          >
            <ShieldAlert size={11} />
            全卷审计
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左 · 起草 + 列表 */}
        <div className="space-y-3 lg:col-span-4">
          {/* 起草新案 */}
          <div
            className="rounded-md border px-3 py-2.5"
            style={{
              borderColor: 'rgba(240,198,106,0.35)',
              background: 'rgba(240,198,106,0.06)',
            }}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
              <Plus size={12} />
              起草新案
            </div>
            <textarea
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="陛下口谕 · 至少 5 字"
              rows={3}
              className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-[#F5E9C9] placeholder:text-[#6A7299] focus:border-[#F0C66A]/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={creating || newCommand.trim().length < 5}
              onClick={handleCreate}
              className="mt-2 w-full rounded-md border border-[#F0C66A]/45 bg-[#F0C66A]/12 py-1.5 text-[12px] font-bold text-[#F0C66A] transition hover:bg-[#F0C66A]/22 disabled:opacity-40"
            >
              {creating ? '起草中...' : '中书起草'}
            </button>
          </div>

          {/* 案列表 */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
              <span>案卷 · {bills.length}</span>
              <button
                type="button"
                onClick={refresh}
                className="text-[#9AA3C4] hover:text-[#F0C66A]"
                title="刷新"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            {bills.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-[#9AA3C4]">
                尚无案 · 起草第一道
              </div>
            ) : (
              <ul className="space-y-1.5">
                {bills.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(b.id)}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition"
                      style={{
                        borderColor:
                          activeId === b.id
                            ? `${STATE_COLOR[b.state]}66`
                            : 'rgba(255,255,255,0.08)',
                        background:
                          activeId === b.id
                            ? `${STATE_COLOR[b.state]}10`
                            : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[12.5px] font-semibold text-[#F5E9C9]"
                          style={{ fontFamily: '"Noto Serif SC", serif' }}
                        >
                          {b.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#8A92AC]">
                          {b.events.length} 帧 · 修订 {b.revisionCount} 次
                        </div>
                      </div>
                      <span
                        className="ml-2 shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px]"
                        style={{
                          borderColor: `${STATE_COLOR[b.state]}55`,
                          color: STATE_COLOR[b.state],
                        }}
                      >
                        {STATE_LABEL[b.state]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 右 · 时间线 + 操作 */}
        <div className="space-y-3 lg:col-span-8">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-16 text-center">
              <Send size={28} className="text-[#6A7299]" />
              <div className="text-[12.5px] text-[#9AA3C4]">
                选一案看时间线 · 或起草新案
              </div>
            </div>
          ) : (
            <>
              <BillTimeline bill={active} />

              {/* 操作条 · 当前合法 transition */}
              <div
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9AA3C4]">
                  可执操作
                </span>
                {legalNextEvents(active.state).length === 0 ? (
                  <span className="text-[12px] text-[#6A7299]">终态 · 无可执</span>
                ) : (
                  legalNextEvents(active.state).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTransition(active.id, type)}
                      className="rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-1 text-[12px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
                    >
                      {EVENT_LABEL[type]}
                      <span className="ml-1 text-[11px] text-[#8A92AC]">
                        ({ACTOR_FOR_EVENT[type]})
                      </span>
                    </button>
                  ))
                )}
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() => handleVerify(active.id)}
                    title="审计 hash chain"
                    className="flex items-center gap-1.5 rounded-md border border-[#A78BFA]/40 bg-[#A78BFA]/10 px-3 py-1 text-[12px] font-semibold text-[#A78BFA] transition hover:bg-[#A78BFA]/18"
                  >
                    <ShieldCheck size={12} />
                    审计
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
