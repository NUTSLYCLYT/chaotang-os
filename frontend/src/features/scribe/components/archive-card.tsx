/**
 * 史馆 · 卷宗卡(ArchiveCard)
 *
 * 渲染规格：jiqun_ai_fresh docs/frontend_ui/shiguan.md §②③④
 * 诚实渲染宪法级铁律（不得违反）：
 *   - evidence_ref=null 或 grounding=none → 灰"待考·需人工补证"，禁绿灯/权威结论
 *   - gate=pending → 整卡盖半透"需人工复核"印，禁绿、不可导护身符
 *   - signed=false → "未签字"水印，export_amulet/feed_flywheel 等不可逆按钮置灰
 *   - source_label=FALLBACK/DEMO → 卡顶显式"演示/降级数据，非真实封存"，禁导护身符
 *
 * 官印固定为「史笔印 / 墨」，不跟随灯色（史馆身份色）。
 */

'use client';

import { useState } from 'react';
import { ScrollText, Link2, ShieldAlert, ShieldCheck, Download, FileSearch, RefreshCw } from 'lucide-react';
import { colors } from '@/config/design-tokens';
import {
  LIGHT_COLOR,
  LIGHT_LABEL,
  canExportAmulet,
  isPendingGate,
  type CourtDoc,
  type CourtDocItem,
} from '../lib/court-doc';

const INK = '#8C93AE'; // 史笔印 · 墨（身份色，不跟随灯色）

interface ArchiveCardProps {
  doc: CourtDoc;
  onTraceEvidence: (ref: string | null) => void;
  onExportAmulet: (doc: CourtDoc) => void;
}

export function ArchiveCard({ doc, onTraceEvidence, onExportAmulet }: ArchiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const lightColor = LIGHT_COLOR[doc.light];
  const pending = isPendingGate(doc);
  const isDemo = doc.sourceLabel === 'FALLBACK' || doc.sourceLabel === 'DEMO';
  const canExport = canExportAmulet(doc);
  const visibleItems = expanded ? doc.items : doc.items.slice(0, 2);
  // red 置顶
  const sortedItems = [...visibleItems].sort((a, b) => {
    const rank = { red: 0, yellow: 1, green: 2 };
    return rank[a.level] - rank[b.level];
  });

  return (
    <div
      className="relative overflow-hidden rounded-xl border px-4 py-3.5"
      style={{ borderColor: `${lightColor}3d`, background: `${lightColor}08` }}
    >
      {pending && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]"
          style={{ background: 'rgba(6,8,16,0.55)' }}
        >
          <span
            className="-rotate-6 rounded border px-3 py-1 text-[12px] font-bold tracking-[0.2em]"
            style={{ borderColor: colors.danger, color: colors.danger, background: 'rgba(244,63,94,0.08)' }}
          >
            需人工复核
          </span>
        </div>
      )}

      {isDemo && (
        <div
          className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ borderColor: `${colors.warning}66`, color: colors.warning, background: `${colors.warning}14` }}
        >
          <ShieldAlert size={10} /> 演示/降级数据 · 非真实封存
        </div>
      )}

      {/* 头行：史笔印 + 案号 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: INK }}>
          <ScrollText size={12} />
          <span className="font-serif tracking-wide">史馆卷宗</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded border px-1.5 py-0.5 font-serif text-[10px]"
            style={{ borderColor: `${INK}55`, color: INK }}
            title="史笔印 · 墨（史馆身份色，不跟随灯色）"
          >
            史笔印
          </span>
          <span className="font-mono text-[10px]" style={{ color: colors.textFaint }}>{doc.caseId}</span>
        </div>
      </div>

      {/* 灯 + headline */}
      <div className="mt-2 flex items-start gap-2">
        <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: lightColor, boxShadow: `0 0 6px ${lightColor}` }} />
        <div>
          <span className="text-[13px] font-semibold leading-6" style={{ color: colors.text }}>{doc.headline}</span>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: lightColor }}>
            {LIGHT_LABEL[doc.light]}
          </div>
        </div>
      </div>

      {/* 心意条 */}
      {doc.shielded && (
        <div
          className="mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-5"
          style={{ borderColor: `${colors.goldBright}33`, background: `${colors.goldBright}0a`, color: colors.textSecondary }}
        >
          <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: colors.goldBright }} />
          <span>{doc.shielded}</span>
        </div>
      )}

      {/* 卷宗要点 */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em]" style={{ color: colors.textFaint }}>
          <span>卷宗要点 · 以史为鉴</span>
          {doc.items.length > 2 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="transition-opacity hover:opacity-80" style={{ color: colors.goldBright }}>
              {expanded ? '收起 ▴' : `展开全部 ${doc.items.length} 条 ▾`}
            </button>
          )}
        </div>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {sortedItems.map((item, i) => (
            <ArchiveItemRow key={`${doc.caseId}-${i}`} item={item} onTraceEvidence={onTraceEvidence} />
          ))}
        </ul>
      </div>

      {/* 落款：接地 / 御史闸 / 来源 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[9.5px]" style={{ color: colors.textFaint }}>
        <FooterTag
          label={
            doc.provenance.grounding === 'rag' ? '法条/重算接地'
            : doc.provenance.grounding === 'deterministic' ? '重算接地'
            : '未接地 · 需人工'
          }
          tone={doc.provenance.grounding === 'none' ? 'muted' : 'ok'}
        />
        <FooterTag
          label={`御史闸：${doc.provenance.gate}`}
          tone={doc.provenance.gate === 'passed' ? 'ok' : doc.provenance.gate === 'pending' ? 'warn' : doc.provenance.gate === 'blocked' ? 'danger' : 'muted'}
        />
        <FooterTag label={`来源：${doc.sourceLabel}`} tone={isDemo ? 'warn' : 'muted'} />
      </div>

      {/* 操作栏 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {doc.actions.includes('trace_evidence') && (
          <ActionBtn icon={FileSearch} label="查证据" onClick={() => onTraceEvidence(doc.items.find((it) => it.evidenceRef)?.evidenceRef ?? null)} />
        )}
        {doc.actions.includes('feed_flywheel') && (
          <ActionBtn icon={RefreshCw} label="喂飞轮" disabled={!doc.signed} />
        )}
        {doc.actions.includes('export_amulet') && (
          <ActionBtn icon={Download} label="导护身符" disabled={!canExport} onClick={() => onExportAmulet(doc)} highlight />
        )}
        {!doc.signed && (
          <span className="ml-auto rounded border px-1.5 py-0.5 text-[9px]" style={{ borderColor: `${colors.textMuted}55`, color: colors.textMuted }}>
            未签字
          </span>
        )}
      </div>

      {/* 骑缝史笔印 */}
      {doc.sealedArchive && (
        <div className="mt-2.5 flex items-center justify-between text-[9.5px]" style={{ color: colors.textFaint }}>
          <span>留痕已封存 · 史馆 {doc.sealedArchive}</span>
          <span className="font-serif italic" style={{ color: INK }}>〔骑缝史笔印〕</span>
        </div>
      )}
    </div>
  );
}

function ArchiveItemRow({ item, onTraceEvidence }: { item: CourtDocItem; onTraceEvidence: (ref: string | null) => void }) {
  const levelColor = item.level === 'red' ? colors.danger : item.level === 'yellow' ? colors.warning : colors.success;
  // 诚实闸：无源一律待考灰，禁止渲染成绿灯
  const unverifiable = item.evidenceRef === null;
  const dotColor = unverifiable ? colors.textMuted : levelColor;

  return (
    <li className="flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]" style={{ borderColor: `${dotColor}26`, background: `${dotColor}08` }}>
      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dotColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: colors.textSecondary }}>{item.title}</span>
          {(item.odds || item.impact) && (
            <span className="shrink-0 text-[10px]" style={{ color: colors.textFaint }}>
              {[item.odds, item.impact].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {unverifiable ? (
            <span className="text-[10px]" style={{ color: colors.textMuted }}>待考 · 无依据，需人工补证</span>
          ) : (
            <button
              type="button"
              onClick={() => onTraceEvidence(item.evidenceRef)}
              className="inline-flex items-center gap-1 text-[10px] transition-opacity hover:opacity-80"
              style={{ color: colors.blueBright }}
            >
              <Link2 size={9} /> 回链证据
            </button>
          )}
          {item.fix && (
            <span className="truncate text-[10px]" style={{ color: colors.textFaint }} title={item.fix}>
              · {item.fix}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function FooterTag({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }) {
  const color = tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : tone === 'danger' ? colors.danger : colors.textMuted;
  return (
    <span className="rounded border px-1.5 py-0.5" style={{ borderColor: `${color}40`, color }}>
      {label}
    </span>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: typeof Download;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10.5px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
      style={
        highlight && !disabled
          ? { borderColor: `${colors.goldBright}66`, color: colors.goldBright, background: `${colors.goldBright}14` }
          : { borderColor: 'rgba(255,255,255,0.12)', color: colors.textDim, background: 'rgba(255,255,255,0.02)' }
      }
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
