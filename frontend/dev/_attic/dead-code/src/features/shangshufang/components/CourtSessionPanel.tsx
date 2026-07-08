'use client';

/**
 * CourtSessionPanel — 今日朝报 · 皇帝单屏作战室
 *
 * 数据来源（真实，不 mock）：
 *   chaotang.courtSession() → BFF GET /api/court/court-session/latest → 后端 :8081/api/court-session/latest
 *
 * 展示「每日朝会自转」产出：八部蜂群 grounded 上奏 → 御史核真库标 ✅有据/⚠️无据 →
 * 军机处暴露跨部门矛盾 → 数字带 [一手]/[待核] 可信度章。
 * 视觉沿用上书房帝金/朱砂色板与 serif 字体，复用 GlassPanel，不引新依赖。
 */

import { Fragment, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ScrollText,
  Telescope,
  Users,
} from 'lucide-react';

import { chaotang } from '@/lib/api/chaotang';
import type { CourtSessionLatest } from '@/lib/contracts/court-session';
import { GlassPanel } from './atoms';

type StatTone = 'gold' | 'green' | 'amber' | 'blue';

const STAT_TONE: Record<StatTone, { color: string; bg: string; border: string }> = {
  gold: { color: '#F5E9C9', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.34)' },
  green: { color: '#B9F6D2', bg: 'rgba(61,214,140,0.09)', border: 'rgba(61,214,140,0.32)' },
  amber: { color: '#F5D28B', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.34)' },
  blue: { color: '#B8CCFF', bg: 'rgba(107,160,255,0.09)', border: 'rgba(107,160,255,0.30)' },
};

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: StatTone;
}) {
  const s = STAT_TONE[tone];
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border px-3 py-2.5"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] tracking-[0.1em] text-[#8F835F]">
        <span style={{ color: s.color }}>{icon}</span>
        {label}
      </div>
      <div
        className="font-mono text-[24px] font-black leading-none"
        style={{ color: s.color, fontFamily: 'var(--font-serif)' }}
      >
        {value}
      </div>
    </div>
  );
}

/** 极简 inline markdown 渲染：## / ### 标题、**加粗**、保留换行；不引第三方依赖。 */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#F5E9C9', fontWeight: 800 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function renderMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line, i) => {
    const key = `ln-${i}`;
    if (line.startsWith('### ')) {
      return (
        <h4
          key={key}
          className="mt-3 mb-1 text-[14px] font-bold"
          style={{ color: '#F0C66A', fontFamily: 'var(--font-serif)' }}
        >
          {renderInline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3
          key={key}
          className="mt-4 mb-1.5 border-b border-[#F0C66A]/20 pb-1 text-[16px] font-black"
          style={{ color: '#F0C66A', fontFamily: 'var(--font-serif)' }}
        >
          {renderInline(line.slice(3))}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2
          key={key}
          className="mt-1 mb-2 text-[19px] font-black"
          style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)' }}
        >
          {renderInline(line.slice(2))}
        </h2>
      );
    }
    if (line.startsWith('> ')) {
      return (
        <p
          key={key}
          className="my-1 border-l-2 border-[#F0C66A]/40 pl-2.5 text-[12px] italic"
          style={{ color: '#B6AB8C' }}
        >
          {renderInline(line.slice(2))}
        </p>
      );
    }
    if (/^[-*] /.test(line)) {
      return (
        <p key={key} className="my-0.5 pl-3 text-[12.5px] leading-[1.6]" style={{ color: '#DCEAFF' }}>
          <span className="mr-1.5 text-[#F0C66A]">·</span>
          {renderInline(line.replace(/^[-*] /, ''))}
        </p>
      );
    }
    if (line.trim() === '') {
      return <div key={key} className="h-2" />;
    }
    return (
      <p key={key} className="my-0.5 text-[12.5px] leading-[1.6]" style={{ color: '#DCEAFF' }}>
        {renderInline(line)}
      </p>
    );
  });
}

interface BriefingRow {
  /** 部名 / 小节标题 */
  title: string;
  /** 一句结论（小节首条实义行） */
  gist: string;
  /** 御史核真：有据/无据/未标 */
  grounded: 'yes' | 'no' | null;
}

const MAX_SUMMARY_ROWS = 3;

/** 御史核真徽记：仅认 ✅/⚠️ emoji 或【有据】/【待核】token，正文里的「有据/待核」自然词不剥。 */
const GROUNDED_MARK_RE = /\s*(?:✅\s*(?:有据)?|⚠️\s*(?:无据|待核)?|【(?:有据|待核|无据)】)\s*$/;

function stripMarks(line: string): string {
  return line
    .replace(/^(?:#{1,6}|\d+\.|[-*>])\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(GROUNDED_MARK_RE, '') // 去掉尾部御史徽记，避免标题里残留 emoji + 与独立徽章重复
    .trim();
}

/**
 * 判定御史核真态。只认明确徽记（✅/⚠️ emoji 或【…】token），
 * 不做裸「有据/无据/待核」子串匹配——否则正文自然句（如「有据可查」）会被误盖成官方定论（诚实纪律）。
 */
function groundedOf(text: string): 'yes' | 'no' | null {
  if (/✅|【有据】/.test(text)) return 'yes';
  if (/⚠️|【待核】|【无据】/.test(text)) return 'no';
  return null;
}

/**
 * 把朝报 markdown 全文浓缩成可扫读的汇总行（精简，非全文倾倒）。
 * 按 `#`/`##`/`###` 标题切节：标题=部名，节内首条实义行=一句结论，节内 ✅/⚠️ 记号定有据态。
 * 无标题时回退：取前若干条实义行各成一行。最多 MAX_SUMMARY_ROWS 行。
 */
function summarizeSections(content: string): BriefingRow[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const rows: BriefingRow[] = [];
  let current: BriefingRow | null = null;
  const headingRe = /^#{1,6}\s+/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (headingRe.test(line)) {
      if (current) rows.push(current);
      current = { title: stripMarks(line), gist: '', grounded: groundedOf(line) };
    } else if (current) {
      if (!current.gist) current.gist = stripMarks(line);
      if (current.grounded === null) current.grounded = groundedOf(line);
    } else {
      // 无标题前导内容 → 直接成行
      rows.push({ title: stripMarks(line), gist: '', grounded: groundedOf(line) });
    }
    if (rows.length >= MAX_SUMMARY_ROWS) break;
  }
  if (current && rows.length < MAX_SUMMARY_ROWS) rows.push(current);
  return rows.slice(0, MAX_SUMMARY_ROWS).filter((r) => r.title);
}

const GROUNDED_BADGE: Record<'yes' | 'no', { label: string; color: string; border: string }> = {
  yes: { label: '有据', color: '#B9F6D2', border: 'rgba(61,214,140,0.42)' },
  no: { label: '待核', color: '#F5D28B', border: 'rgba(240,198,106,0.42)' },
};

function BriefingSummary({ rows }: { rows: BriefingRow[] }) {
  return (
    <ul data-testid="court-session-summary" className="flex flex-col">
      {rows.map((row, i) => (
        <li
          key={`${i}-${row.title}`}
          className="flex items-center gap-2.5 border-t border-[#F0C66A]/12 py-1.5 first:border-t-0"
        >
          <span aria-hidden className="text-[#F0C66A]/70">·</span>
          <span
            className="shrink-0 text-[12.5px] font-bold"
            style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)' }}
          >
            {row.title}
          </span>
          {row.gist && (
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: '#B6AB8C' }}>
              {row.gist}
            </span>
          )}
          {row.grounded && (
            <span
              className="ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono tracking-[0.06em]"
              style={{ color: GROUNDED_BADGE[row.grounded].color, borderColor: GROUNDED_BADGE[row.grounded].border }}
            >
              {GROUNDED_BADGE[row.grounded].label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CourtSessionPanel() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useSWR<CourtSessionLatest, Error>(
    'court-session-latest',
    () => chaotang.courtSession(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const summary = data?.summary;
  // 折叠态才算汇总行（展开态直接给全文，无需白算一遍）。
  const summaryRows = !expanded && data?.available ? summarizeSections(data.content) : [];

  return (
    <GlassPanel accent="#F0C66A" className="mx-auto mb-3 w-full max-w-[1680px] p-3 md:p-4">
      <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-[#F0C66A]" />
          <h2
            className="text-[17px] font-black md:text-[19px]"
            style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)' }}
          >
            今日朝报 · 皇帝单屏作战室
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] tracking-[0.1em] text-[#8F835F]">
          {data?.stamp && (
            <span
              className="rounded border border-[#F0C66A]/24 px-2 py-0.5 font-mono"
              style={{ color: '#F5D28B' }}
            >
              {data.stamp}
            </span>
          )}
          <span>每日朝会自转 · grounded 真实数据</span>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-[12px] text-[#8F835F]" style={{ fontFamily: 'var(--font-serif)' }}>
            正在调阅今日朝报……
          </p>
        </div>
      ) : !data?.available ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-[#C2553D]/35 bg-[#C2553D]/[0.08] px-3 py-4 text-[12px] text-[#E8B4A6]"
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>今日朝会未生成 · 八部蜂群尚未完成上奏，请稍后再调阅今日朝报。</span>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <StatCard icon={<Users size={13} />} label="上奏部数" value={summary?.deptCount ?? 0} tone="gold" />
            <StatCard
              icon={<CheckCircle2 size={13} />}
              label="✅ 有据"
              value={summary?.groundedCount ?? 0}
              tone="green"
            />
            <StatCard
              icon={<AlertTriangle size={13} />}
              label="⚠️ 无据待核"
              value={summary?.ungroundedCount ?? 0}
              tone="amber"
            />
            <StatCard
              icon={<Telescope size={13} />}
              label="🔭 跨部门矛盾"
              value={summary?.conflictCount ?? 0}
              tone="blue"
            />
          </div>

          {/* 精简汇总：默认只给八部上奏的浓缩扫读行（部名+一句+有据章），不倾倒全文；
              全文一键展开，诚实不藏（整洁/精简/古风审美门）。 */}
          {!expanded &&
            (summaryRows.length ? (
              <div className="mb-2">
                <BriefingSummary rows={summaryRows} />
              </div>
            ) : (
              <p
                className="mb-2 text-[12.5px] italic"
                style={{ color: '#B6AB8C', fontFamily: 'var(--font-serif)' }}
              >
                今日朝报已就绪，展开细览八部上奏与矛盾。
              </p>
            ))}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={expanded ? 'court-session-content' : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition hover:border-[#F0C66A]/55 hover:bg-[#F0C66A]/[0.08]"
            style={{
              borderColor: expanded ? 'rgba(240,198,106,0.52)' : 'rgba(240,198,106,0.24)',
              background: expanded ? 'rgba(240,198,106,0.12)' : 'rgba(5,7,13,0.64)',
              color: '#F5E9C9',
              fontFamily: 'var(--font-serif)',
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? '收起今日朝报' : '展开今日朝报全文'}
          </button>

          {expanded && (
            <div
              className="mt-2 max-h-[440px] overflow-y-auto rounded-lg border border-white/8 bg-black/25 px-3 py-2.5 md:px-4"
              id="court-session-content"
              data-testid="court-session-content"
            >
              {renderMarkdown(data.content)}
            </div>
          )}
        </>
      )}
    </GlassPanel>
  );
}
