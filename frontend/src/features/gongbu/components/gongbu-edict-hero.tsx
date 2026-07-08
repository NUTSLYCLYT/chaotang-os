'use client';

/**
 * 工部 · 中间卷轴 hero(御赐呈奏 · 2026-07-01)
 *
 * 与户部同构的震撼门,但工部克制精简(高效简洁):工部价值不是财政数字,是「真可行性=转后端 pack_rd」。
 * 只对真 tasks 渲染,去重后取最急那件当 hero。用与 cockpit 同一页面脑(evaluateTask),不触发双脑冲突(铁律6)。
 * 复用冻结系统:GlassPanel / DeptSeal / .display-serif / .animate-*。真实成本/BOM/交期上锁转后端(铁律9)。
 */

import { useMemo } from 'react';

import { GlassPanel } from '@/components/GlassPanel';
import { DeptSeal } from '@/components/DeptSeal';
import { useGongbuTasks } from '@/features/gongbu/hooks/use-gongbu-tasks';
import { evaluateTask, dedupeTasksByTitle } from '@/features/gongbu/lib/gongbu-engines';

const C = {
  warm: '#EAF3EE', dim: '#a7b3ac', muted: '#7a8a82', faint: '#5a6a62',
  gold: '#D4A84B', goldBright: '#F0C66A', goldDeep: '#8A6A2A',
  gong: '#7FC9A8', blue: '#9ec5ff', amber: '#E5B84D', danger: '#E5604D', border: '#22402f',
};
const VERDICT_DOT: Record<string, string> = { approve: '#5FB97A', amend: '#E5B84D', review: '#4A82F0', reject: '#E5604D' };
const ACTIVE = new Set(['running', 'submitted', 'planning', 'queued', 'in_progress']);

function cleanTitle(raw: string): string {
  const quoted = raw.match(/[“"]([^”"]{4,})[”"]/);
  const base = (quoted ? quoted[1] : raw.replace(/^请[^，。：:、]{0,10}(围绕|就|对|审查|判断|建设|实现)\s*/, '')).trim();
  return base.length > 36 ? `${base.slice(0, 36)}…` : base;
}

export function GongbuEdictHero() {
  const { tasks } = useGongbuTasks();

  const top = useMemo(() => {
    const deduped = dedupeTasksByTitle(tasks ?? []);
    return [...deduped].sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)))[0] ?? null;
  }, [tasks]);

  const ev = useMemo(() => (top ? evaluateTask(top) : null), [top?.id, top?.title, top?.status]);
  if (!top || !ev) return null;

  const dot = VERDICT_DOT[ev.verdict] ?? C.muted;

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div aria-hidden style={{ position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)', width: 680, height: 320, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(127,201,168,0.10), transparent 70%)' }} />

      <GlassPanel variant="gold" tone="deep" glow hudCorners padding="lg">
        <div style={{ position: 'relative', padding: '4px 6px' }}>
          {/* 朱红工部官印 */}
          <div style={{ position: 'absolute', top: -6, right: -2, transform: 'rotate(-9deg)', opacity: 0.96, filter: 'drop-shadow(0 2px 8px rgba(190,46,38,0.4))' }}>
            <DeptSeal name="工部" kind="研发专用章" variant="vermilion" size={100} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.goldDeep }}>工部呈奏 · 御前一纸</span>
            <span style={{ fontSize: 10, color: C.gong, border: `1px solid ${C.gong}55`, borderRadius: 4, padding: '1px 7px' }}>真 · 主库/后端 tasks</span>
          </div>

          <h1 className="display-serif metal-edge animate-shimmer-h" style={{ fontSize: 'clamp(1.5rem, 1.1rem + 1.5vw, 2rem)', lineHeight: 1.32, color: C.warm, margin: '10px 0 0', fontWeight: 600, maxWidth: 440 }}>
            {cleanTitle(top.title)}
          </h1>

          {/* 工部尚书 voice(一行·克制) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '16px 0 20px', paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: `${C.gong}22`, border: `1px solid ${C.gong}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>工</span>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.75, margin: 0, fontFamily: 'var(--font-serif)', maxWidth: 440 }}>
              <span style={{ color: C.warm }}>工部尚书启奏:</span>臣已核过可行性——<span style={{ color: dot, fontWeight: 600 }}>{ev.verdictCn}</span>。真成本/BOM/交期须转后端 pack_rd 实算,臣不敢在前端编。
            </p>
          </div>

          {/* 裁决 + 类型/状态 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: dot, fontWeight: 600 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: dot }} />{ev.verdictCn}
            </span>
            <span style={{ color: C.muted }}>类型 {ev.explain.type.replace('分类为「', '').replace('」（按任务文本关键词）', '')} · 状态 {top.status}</span>
          </div>

          {/* 产线锁(工部特色·铁律9) */}
          {ev.locks.length > 0 && (
            <p style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.6, color: C.blue, background: '#4A82F012', borderRadius: 8, padding: '8px 10px', margin: '0 0 10px' }}>
              🔒 <span><span style={{ fontWeight: 600 }}>产线资产上锁:</span>{ev.locks.join('、')} · 转后端 jiqun pack_rd 核算,前端不编</span>
            </p>
          )}
          {ev.missing.length > 0 && (
            <p style={{ fontSize: 12.5, color: '#F3D08A', margin: '0 0 12px' }}><span style={{ color: C.muted }}>缺证:</span>{ev.missing.join('、')}</p>
          )}

          {/* CTA:工部杀手锏——复核转后端真派 pack_rd(Karpathy:真回执才是工部的心) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11.5, color: C.faint, fontFamily: 'var(--font-serif)' }}>工部尚书 谨呈 · 待陛下裁 · 详见下方队列</span>
            <a href="#gongbu-queue" style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold} 55%, ${C.goldDeep})`, color: '#1A1206', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 6px 18px ${C.gold}33`, textDecoration: 'none' }}>
              下方裁建设 ↓
            </a>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
