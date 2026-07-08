/**
 * 史馆 · 首页 Hub（三栏排布 · 参照上书房）
 *
 * 左栏 复盘索引：六域导航 + 复盘三问
 * 中栏 今日引卷：最新一卷 brief + 成败分布 + 卷宗要览
 * 右栏 复盘飞轮：三股信号 PASS/FAIL + 燃料体检 + 护身符导出
 *
 * 风格沿用现有玻璃金（GlassPanel + design-tokens），不另起一套。
 */

'use client';

import { useState } from 'react';
import {
  ScrollText,
  Award,
  Tag,
  FileSearch,
  Archive,
  Command,
  ArrowRight,
  Clock,
  ShieldCheck,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';
import { ANNALS_ENTRIES, OUTCOME_META, type AnnalsEntry } from '../lib/annals-entries';
import { ArchiveCard } from './archive-card';
import { EvidenceChainPanel } from './evidence-chain-panel';
import { MOCK_COURT_DOCS, canExportAmulet, type CourtDoc } from '../lib/court-doc';

const GOLD = colors.goldBright;

type RealmId = 'annals' | 'cases' | 'lessons' | 'recall' | 'archive' | 'codex';

interface Realm {
  id: RealmId;
  icon: LucideIcon;
  title: string;
  en: string;
  accent: string;
  count: number;
  suffix: string;
}

interface FlywheelSignal {
  key: string;
  en: string;
  status: 'on' | 'idle';
  detail: string;
}

const REVIEW_QUESTIONS = [
  '这次命令哪一句最有效，能否复用？',
  '哪个禁区或验收写得不够清，导致返工？',
  '下次相似任务，先召回哪条模板？',
];

// 示例数据 · 待接后端 health() 三表（court_flywheel / failure_memory / signoff_learning）
const FLYWHEEL: FlywheelSignal[] = [
  { key: '朝会沉淀', en: 'Session → Knowledge', status: 'on', detail: '结案回流入库 · error 态已挡（脏燃料不入库）' },
  { key: '失败记忆', en: 'Failure Memory', status: 'on', detail: '命中「重复犯的错」· 已注入下轮 flow' },
  { key: '签字学习', en: 'Signoff Learning', status: 'idle', detail: '本周无 reject 教训沉淀（无人类驳回信号）' },
];

export interface ScribeHubBoardProps {
  onJump: (id: RealmId) => void;
}

export function ScribeHubBoard({ onJump }: ScribeHubBoardProps) {
  const [traceRef, setTraceRef] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  const handleTraceEvidence = (ref: string | null) => {
    setTraceRef(ref);
    setTraceOpen(true);
  };

  const handleExportAmulet = (doc: CourtDoc) => {
    if (!canExportAmulet(doc)) return;
    const confirmed = window.confirm('将生成对外可追责卷宗包（含证据链 + 签字），是否继续？');
    if (!confirmed) return;
    const bundle = {
      caseId: doc.caseId,
      headline: doc.headline,
      items: doc.items,
      signed: doc.signed,
      sealedArchive: doc.sealedArchive,
      sourceLabel: doc.sourceLabel,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.caseId}-amulet.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportableDoc = MOCK_COURT_DOCS.find((d) => canExportAmulet(d)) ?? null;

  const total = ANNALS_ENTRIES.length;
  const s = ANNALS_ENTRIES.filter((e) => e.outcome === 'success').length;
  const m = ANNALS_ENTRIES.filter((e) => e.outcome === 'mixed').length;
  const f = ANNALS_ENTRIES.filter((e) => e.outcome === 'failure').length;
  const tagCount = new Set(ANNALS_ENTRIES.flatMap((e) => e.tags)).size;
  const lessonCount = ANNALS_ENTRIES.reduce((n, e) => n + e.lessons.length, 0);
  const recent = ANNALS_ENTRIES[0];
  const preview = ANNALS_ENTRIES.slice(0, 5);

  const realms: Realm[] = [
    { id: 'annals',  icon: ScrollText, title: '卷轴', en: 'Bamboo Annals', accent: colors.goldBright, count: total,       suffix: '卷' },
    { id: 'cases',   icon: Award,      title: '案例', en: 'Outcome Cases',  accent: colors.success,     count: s,           suffix: '成案' },
    { id: 'lessons', icon: Tag,        title: '教训', en: 'Lessons · Tags', accent: colors.warning,     count: lessonCount, suffix: '条' },
    { id: 'recall',  icon: FileSearch, title: '召回', en: 'Similar Recall', accent: colors.gold,        count: tagCount,    suffix: '标签' },
    { id: 'codex',   icon: Command,    title: 'Codex', en: 'Command Books', accent: colors.blueBright,  count: 7,           suffix: '模板' },
    { id: 'archive', icon: Archive,    title: '档案', en: 'Full Archive',   accent: colors.blueBright,  count: total,       suffix: '归档' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,264px)_minmax(0,1fr)_minmax(0,320px)]">
      {/* ── 左栏 · 复盘索引 ── */}
      <aside className="flex flex-col gap-4 lg:min-h-0">
        <GlassPanel tone="elevated" padding="md" className="flex flex-col gap-1">
          <div className="section-eyebrow">Review Index · 复盘六域</div>
          <nav className="mt-2 flex flex-col gap-1.5">
            {realms.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onJump(r.id)}
                  className="group flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-left transition-all hover:translate-x-0.5"
                  style={{ borderLeftColor: `${r.accent}66`, background: `${r.accent}0a` }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${r.accent}1f`, border: `1px solid ${r.accent}40` }}
                  >
                    <Icon size={13} style={{ color: r.accent }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold" style={{ color: colors.text }}>{r.title}</span>
                    <span className="block text-[10px] uppercase tracking-[0.16em]" style={{ color: colors.textFaint }}>{r.en}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[12px] font-bold tabular-nums" style={{ color: r.accent }}>{r.count}</span>
                    <span className="block text-[9px]" style={{ color: colors.textMuted }}>{r.suffix}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </GlassPanel>

        <GlassPanel tone="flat" padding="md">
          <div className="section-eyebrow">Review Questions · 复盘三问</div>
          <ol className="mt-3 flex flex-col gap-2">
            {REVIEW_QUESTIONS.map((q, i) => (
              <li key={q} className="flex gap-2 text-[11px] leading-5" style={{ color: colors.textSecondary }}>
                <span className="font-mono font-bold" style={{ color: GOLD }}>{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </GlassPanel>
      </aside>

      {/* ── 中栏 · 今日引卷 ── */}
      <div className="flex flex-col gap-4">
        <GlassPanel variant="gold" tone="elevated" padding="lg" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 0% 0%, rgba(240,198,106,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(255,217,122,0.10), transparent 55%)',
            }}
          />
          <div className="relative flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(240,198,106,0.32), rgba(240,198,106,0.06))',
                border: '1px solid rgba(240,198,106,0.6)',
                boxShadow: '0 4px 24px rgba(240,198,106,0.3)',
              }}
            >
              <ScrollText size={19} style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
                Imperial Historian Brief · 今日引卷
              </div>
              <h2 className="mt-1 text-[19px] font-semibold leading-snug" style={{ color: colors.goldBright }}>
                {recent ? `最新一卷「${recent.title}」` : '史馆候阅'}
              </h2>
              {recent && (
                <p className="mt-1.5 text-[12px] leading-6" style={{ color: colors.textSecondary }}>{recent.summary}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]" style={{ color: colors.textDim }}>
                <span className="inline-flex items-center gap-1"><Clock size={11} /> 在录 {total} 卷 · 横跨 2024–2026</span>
                <span>·</span>
                <span>可抄送丞相</span>
              </div>
            </div>
          </div>

          {/* 成败分布条 */}
          <div className="relative mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em]" style={{ color: colors.textFaint }}>
              <span>成败分布</span>
              <span className="font-mono tabular-nums">成 {s} · 混 {m} · 败 {f}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <span style={{ width: `${(s / total) * 100}%`, background: OUTCOME_META.success.color }} />
              <span style={{ width: `${(m / total) * 100}%`, background: OUTCOME_META.mixed.color }} />
              <span style={{ width: `${(f / total) * 100}%`, background: OUTCOME_META.failure.color }} />
            </div>
          </div>
        </GlassPanel>

        {/* 卷宗要览 */}
        <GlassPanel tone="elevated" padding="md">
          <div className="flex items-center justify-between">
            <div className="section-eyebrow">Recent Scrolls · 卷宗要览</div>
            <button
              type="button"
              onClick={() => onJump('annals')}
              className="inline-flex items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
              style={{ color: GOLD }}
            >
              展开竹简长卷 <ArrowRight size={11} />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {preview.map((e) => (
              <ScrollRow key={e.id} entry={e} onClick={() => onJump('annals')} />
            ))}
          </div>
        </GlassPanel>

        {/* 护身符卷宗 · 诚实渲染闸(court_doc archive) */}
        <GlassPanel tone="elevated" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="section-eyebrow">Amulet Archive · 护身符卷宗</div>
              <div className="mt-0.5 text-[11px]" style={{ color: colors.textDim }}>出事调依据 · 无源一律"待考"，不美化</div>
            </div>
            <span
              className="rounded-full border px-2 py-0.5 text-[9px]"
              style={{ borderColor: `${colors.textMuted}55`, color: colors.textMuted }}
              title="待接后端 /api/archive/case 等 HTTP 路由(现只有 CLI 脚本)"
            >
              示例 · 待接真实归档接口
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {MOCK_COURT_DOCS.map((doc) => (
              <ArchiveCard key={doc.caseId} doc={doc} onTraceEvidence={handleTraceEvidence} onExportAmulet={handleExportAmulet} />
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* ── 右栏 · 复盘飞轮 + 护身符 ── */}
      <aside className="flex flex-col gap-4 lg:min-h-0">
        <GlassPanel tone="elevated" padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={13} style={{ color: colors.success }} />
              <div>
                <div className="section-eyebrow">Review Flywheel · 复盘飞轮</div>
                <div className="text-[12px] font-semibold" style={{ color: colors.goldBright }}>系统在学吗</div>
              </div>
            </div>
            <span
              className="rounded-full border px-2 py-0.5 text-[9px]"
              style={{ borderColor: `${colors.textMuted}55`, color: colors.textMuted }}
              title="待接后端 health() 三表"
            >
              示例 · 待接 health()
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {FLYWHEEL.map((sig) => {
              const on = sig.status === 'on';
              const c = on ? colors.success : colors.warning;
              return (
                <div
                  key={sig.key}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ borderColor: `${c}2e`, background: `${c}0a` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold" style={{ color: colors.text }}>{sig.key}</div>
                      <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: colors.textFaint }}>{sig.en}</div>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: `${c}1f`, color: c, border: `1px solid ${c}55` }}
                    >
                      {on ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
                      {on ? '在转' : '空转'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-5" style={{ color: colors.textDim }}>{sig.detail}</p>
                </div>
              );
            })}
          </div>

          {/* 燃料体检 */}
          <div
            className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[10px]"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span style={{ color: colors.textFaint }}>燃料体检</span>
            <span className="flex items-center gap-2 font-mono tabular-nums">
              <span style={{ color: colors.success }}>可信 —</span>
              <span style={{ color: colors.textMuted }}>孤儿 0</span>
              <span style={{ color: colors.textMuted }}>未鉴权 0</span>
            </span>
          </div>
        </GlassPanel>

        {/* 护身符导出 */}
        <GlassPanel variant="gold" tone="elevated" padding="md" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(240,198,106,0.16), transparent 60%)' }}
          />
          <div className="relative flex items-center gap-2">
            <ShieldCheck size={14} style={{ color: GOLD }} />
            <div className="section-eyebrow">Amulet · 护身符</div>
          </div>
          <p className="relative mt-2 text-[11px] leading-5" style={{ color: colors.textSecondary }}>
            出事时一键调出「当时基于这些依据做了合理决策」—— 带证据链 + 御史签字的卷宗包。
          </p>
          <button
            type="button"
            disabled={!exportableDoc}
            onClick={() => exportableDoc && handleExportAmulet(exportableDoc)}
            className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            style={{
              borderColor: `${GOLD}66`,
              background: `linear-gradient(135deg, ${GOLD}26, ${GOLD}0a)`,
              color: colors.goldBright,
            }}
          >
            <Download size={13} />
            一键调取护身符
          </button>
          {!exportableDoc && (
            <p className="relative mt-1.5 text-[10px]" style={{ color: colors.textMuted }}>
              暂无可导出卷宗（需已签字 · 御史闸通过 · 非降级数据）
            </p>
          )}
          <button
            type="button"
            onClick={() => onJump('archive')}
            className="relative mt-2 flex w-full items-center justify-center gap-1.5 text-[11px] transition-opacity hover:opacity-80"
            style={{ color: colors.textDim }}
          >
            查看全部档案 <ArrowRight size={10} />
          </button>
        </GlassPanel>
      </aside>

      <EvidenceChainPanel open={traceOpen} evidenceRef={traceRef} onClose={() => setTraceOpen(false)} />
    </div>
  );
}

function ScrollRow({ entry, onClick }: { entry: AnnalsEntry; onClick: () => void }) {
  const meta = OUTCOME_META[entry.outcome];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all hover:translate-x-0.5"
      style={{ borderColor: `${meta.color}33`, background: `${meta.color}08` }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: `radial-gradient(circle, ${meta.color}aa, ${meta.color}22)`, color: colors.goldBright, border: `1px solid ${meta.color}` }}
      >
        {meta.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: colors.goldBright }}>{entry.title}</span>
          <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: meta.color }}>{entry.dateLabel}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px]" style={{ color: colors.textDim }}>{entry.summary}</span>
      </span>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}12`, color: GOLD }}>
        {entry.category}
      </span>
    </button>
  );
}
