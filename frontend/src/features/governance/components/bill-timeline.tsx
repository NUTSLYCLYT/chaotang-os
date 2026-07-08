/**
 * 朝堂 OS · 三栏并行案卷时间线
 *
 * 左 中书 / 中 门下 / 右 尚书 · 每个 transition 在对应栏画一个朱印封缄
 * 这是 Edge 差异化 · 其他 SaaS 不可能做出来
 */

'use client';

import type { Bill, BillEvent, Actor } from '@/features/governance/lib/bill-fsm';
import { CheckCircle2, FileText, ShieldAlert, Send, Stamp, Clock, X } from 'lucide-react';

const ACTOR_COLUMN: Record<Actor, 0 | 1 | 2> = {
  zhongshu: 0,
  menxia: 1,
  shangshu: 2,
  ruler: 1, // 御批归到中栏
  liubu: 2, // 六部回执归到尚书栏
  system: 1,
};

const COLUMN_META = [
  { key: 'zhongshu', label: '中书省', sub: '起草', accent: '#F0C66A' },
  { key: 'menxia', label: '门下省', sub: '驳议', accent: '#F43F5E' },
  { key: 'shangshu', label: '尚书省', sub: '执行', accent: '#3DD68C' },
] as const;

const EVENT_ICON = {
  create: FileText,
  submit_to_review: Send,
  approve: CheckCircle2,
  reject_for_revision: ShieldAlert,
  reject_final: X,
  shelve: Clock,
  resubmit: Send,
  dispatch: Send,
  mark_completed: CheckCircle2,
  mark_failed: X,
  archive: Stamp,
} as const;

const EVENT_LABEL = {
  create: '起草',
  submit_to_review: '送审',
  approve: '准奏',
  reject_for_revision: '驳改',
  reject_final: '终驳',
  shelve: '搁置',
  resubmit: '再呈',
  dispatch: '派下六部',
  mark_completed: '已成',
  mark_failed: '已败',
  archive: '入史馆',
} as const;

const STATE_BADGE = {
  drafted: { label: '起草', color: '#F0C66A' },
  under_review: { label: '审议中', color: '#FB923C' },
  revising: { label: '修改中', color: '#F0C66A' },
  approved: { label: '已准', color: '#3DD68C' },
  executing: { label: '执行中', color: '#60A5FA' },
  completed: { label: '已成', color: '#3DD68C' },
  failed: { label: '已败', color: '#F43F5E' },
  rejected: { label: '终驳', color: '#F43F5E' },
  shelved: { label: '搁置', color: '#8A92AC' },
  archived: { label: '入史馆', color: '#A78BFA' },
} as const;

export function BillTimeline({ bill }: { bill: Bill }) {
  const badge = STATE_BADGE[bill.state];

  return (
    <div className="space-y-4">
      {/* 顶部状态条 */}
      <div
        className="flex items-center justify-between rounded-lg border px-4 py-3"
        style={{ borderColor: `${badge.color}55`, background: `${badge.color}10` }}
      >
        <div>
          <div
            className="text-[16px] font-bold"
            style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
          >
            {bill.title}
          </div>
          <div className="mt-1 text-[11px] text-[#8A92AC]">
            修订 {bill.revisionCount} 次 · 共 {bill.events.length} 帧 · 创建于
            {' '}
            {new Date(bill.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
        <div
          className="rounded-full border-2 px-4 py-1 text-[14px] font-bold tracking-[0.16em]"
          style={{
            borderColor: badge.color,
            color: badge.color,
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          {badge.label}
        </div>
      </div>

      {/* 三栏并行 */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMN_META.map((col) => (
          <ColumnHeader key={col.key} meta={col} />
        ))}
        {COLUMN_META.map((col, idx) => (
          <ColumnEvents key={col.key} events={bill.events} columnIdx={idx as 0 | 1 | 2} accent={col.accent} />
        ))}
      </div>
    </div>
  );
}

function ColumnHeader({ meta }: { meta: (typeof COLUMN_META)[number] }) {
  return (
    <div
      className="flex items-center justify-between rounded-md border px-3 py-2"
      style={{ borderColor: `${meta.accent}45`, background: `${meta.accent}08` }}
    >
      <div>
        <div
          className="text-[13px] font-bold tracking-[0.1em]"
          style={{ color: meta.accent, fontFamily: '"Noto Serif SC", serif' }}
        >
          {meta.label}
        </div>
        <div className="text-[11px] text-[#8A92AC]">{meta.sub}</div>
      </div>
    </div>
  );
}

function ColumnEvents({
  events,
  columnIdx,
  accent,
}: {
  events: BillEvent[];
  columnIdx: 0 | 1 | 2;
  accent: string;
}) {
  const colEvents = events.filter((e) => ACTOR_COLUMN[e.actor] === columnIdx);
  return (
    <div className="space-y-2">
      {colEvents.length === 0 ? (
        <div
          className="rounded-md border border-dashed px-3 py-6 text-center text-[11px]"
          style={{ borderColor: `${accent}22`, color: '#6A7299' }}
        >
          尚无动作
        </div>
      ) : (
        colEvents.map((evt) => <EventCard key={evt.id} event={evt} accent={accent} />)
      )}
    </div>
  );
}

function EventCard({ event, accent }: { event: BillEvent; accent: string }) {
  const Icon = EVENT_ICON[event.type] ?? FileText;
  const label = EVENT_LABEL[event.type] ?? event.type;

  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: `${accent}33`,
        background: `linear-gradient(135deg, ${accent}10, transparent 80%)`,
      }}
    >
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5" style={{ color: accent }}>
          <Icon size={11} />
          <span className="font-bold tracking-[0.06em]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            {label}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#8A92AC]">
          {new Date(event.ts).toLocaleTimeString('zh-CN').slice(0, 5)}
        </span>
      </div>
      <p
        className="mt-1 text-[12px] leading-5"
        style={{ color: '#E6DBBC', fontFamily: '"Noto Serif SC", serif' }}
      >
        {event.reason}
      </p>
      {typeof event.payload?.draft === 'string' && (
        <div
          className="mt-1 rounded border-l-2 px-2 py-1 text-[11px] leading-5 text-[#C8CDD8]"
          style={{ borderLeftColor: accent }}
        >
          {(event.payload.draft as string).slice(0, 100)}
          {(event.payload.draft as string).length > 100 ? '…' : ''}
        </div>
      )}
    </div>
  );
}
