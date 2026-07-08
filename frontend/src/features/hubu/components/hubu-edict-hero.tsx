'use client';

/**
 * 户部 · 御赐呈奏卷轴 hero(震撼门 · 2026-07-01)
 *
 * 把样板 sample-hubu-edict 的「卷轴 + 朱红官印 + 帝金巨数字 + 七段缩影」设计思路,
 * 落到真 overview 数据上:只对 **真 API 行**(overview.projects)渲染震撼门,
 * 取最急那件当 hero。无真行 → 不渲染(绝不给样本/空数据镀金,守贝索斯警示 + 用户「样本明标」决策)。
 *
 * 纪律(dark-luxury-playbook):金光预算 ≤8% · 一屏 1 hero · 巨数锚点(clamp 48–64px) ·
 * 衬线气质 · 唯一动态金光绑真实状态 · 极薄噪点景深层。复用冻结系统:GlassPanel / DeptSeal /
 * .display-serif / .animate-stat-bloom / .metal-edge / 帝金 token。不碰发动机、不重算成本(铁律6)。
 */

import { useMemo } from 'react';

import { GlassPanel } from '@/components/GlassPanel';
import { DeptSeal } from '@/components/DeptSeal';
import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';
import { evaluateProject } from '@/features/hubu/lib/hubu-engines';
import { pickHeroProject } from '@/features/hubu/lib/chancellor-analysis';
import { ChancellorAnalysis } from '@/features/hubu/components/chancellor-analysis';
import { FINANCE_RISK_LABEL } from '@/lib/contracts/hubu';

const C = {
  warm: '#FBF7EC', text: '#EAEEFB', dim: '#9AA3C4', muted: '#6A7299', faint: '#484F72',
  gold: '#D4A84B', goldBright: '#F0C66A', goldDeep: '#8A6A2A',
  hubu: '#3DD68C', amber: '#F5A524', danger: '#F43F5E', border: '#2A2350', vermilion: '#BE2E26',
};

// 极薄噪点层:去塑料感(playbook 唯一强建议新增、globals.css 没有的一层)。页面级 scoped,不碰冻结资产。
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const VERDICT_DOT: Record<string, string> = {
  approve: C.hubu, adjust: C.amber, hold: C.muted, reject: C.danger,
};

/** 标题清洗:把"请军机处围绕『真问题』…"提炼成真问题;过长截断。 */
function cleanTitle(raw: string): string {
  const quoted = raw.match(/[“"]([^”"]{4,})[”"]/);
  const base = (quoted ? quoted[1] : raw.replace(/^请[^，。：:、]{0,10}(围绕|就|对|审查|判断)\s*/, '')).trim();
  return base.length > 38 ? `${base.slice(0, 38)}…` : base;
}

export function HubuEdictHero() {
  const { overview } = useHubuOverview();

  // 只取真 API 行;样本/空数据不进震撼门(铁律9 + 贝索斯:别给空转飞轮镀金)。pickHeroProject 已单测。
  const top = pickHeroProject(overview?.projects ?? []);
  // memo ev:稳定引用,避免每渲染新对象→下游 runCourtUnifiedDecisionLoop 每帧重算六部(会审 HIGH-3)。
  const ev = useMemo(
    () => (top ? evaluateProject(top) : null),
    [top?.id, top?.updated_at, top?.requested_budget, top?.estimated_roi, top?.cash_flow_pressure, top?.risk_level],
  );
  if (!top || !ev) return null;
  const dot = VERDICT_DOT[ev.verdict] ?? C.muted;
  const isLive = overview?.summary?.source === 'turso';
  const groundPct = Math.round((ev.quality.grounded / ev.quality.total) * 100);

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {/* 御前金辉:唯一一处金光氛围(≤8% 预算) */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)',
          width: 720, height: 360, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(240,198,106,0.10), transparent 70%)',
        }}
      />

      <GlassPanel variant="gold" tone="deep" glow hudCorners padding="lg">
        {/* 极薄噪点景深层 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', borderRadius: 'inherit' }} />

        <div style={{ position: 'relative', padding: '4px 6px' }}>
          {/* 朱红户部官印·盖右上,微旋如真盖(复用冻结 DeptSeal) */}
          <div style={{ position: 'absolute', top: -6, right: -2, transform: 'rotate(-9deg)', opacity: 0.96, filter: 'drop-shadow(0 2px 8px rgba(190,46,38,0.4))' }}>
            <DeptSeal name="户部" kind="财政专用章" variant="vermilion" size={104} />
          </div>

          {/* 抬头 + 来源三态标 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.goldDeep }}>户部呈奏 · 御前一纸</span>
            <span style={{ fontSize: 10, color: isLive ? C.hubu : C.amber, border: `1px solid ${isLive ? C.hubu : C.amber}55`, borderRadius: 4, padding: '1px 7px' }}>
              {isLive ? '真·户部 LIVE' : '主库回退 · 成色待核'}
            </span>
          </div>

          <h1 className="display-serif metal-edge animate-shimmer-h" style={{ fontSize: 'clamp(1.6rem, 1.1rem + 1.6vw, 2.1rem)', lineHeight: 1.32, color: C.warm, margin: '10px 0 0', fontWeight: 600, maxWidth: 460 }}>
            {cleanTitle(top.title)}
          </h1>

          {/* 尚书 voice(替你把话说圆,不冷报数) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '18px 0 26px', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: `${C.hubu}22`, border: `1px solid ${C.hubu}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>户</span>
            <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.8, margin: 0, fontFamily: 'var(--font-serif)', maxWidth: 460 }}>
              <span style={{ color: C.warm }}>户部尚书启奏：</span>
              {top.recommendation?.trim() || overview?.summary?.recommendation?.trim() || '臣已为陛下核过这笔账,详见下方裁决。'}
            </p>
          </div>

          {/* 帝金巨数:真预算锚点(.animate-stat-bloom 入场) */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>申请预算</div>
              <div className="display-serif animate-stat-bloom" style={{ fontSize: 'clamp(2.6rem, 1.6rem + 3vw, 3.4rem)', lineHeight: 1, fontWeight: 700, background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold} 60%, ${C.goldDeep})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {top.requested_budget && top.requested_budget !== '—' ? top.requested_budget : '待补'}
              </div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>预期回报 / 回本</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: ev.roiMultiple != null ? C.hubu : C.amber }}>
                {ev.roiMultiple != null ? `${ev.roiMultiple}x` : '缺证'}
                <span style={{ color: C.faint, fontWeight: 400 }}> · {top.payback_window && top.payback_window !== '—' ? top.payback_window : '回本待补'}</span>
              </div>
            </div>
          </div>

          {/* 证据接地条(真信号:几项有据,绝不编造) */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.muted, marginBottom: 6 }}>
              <span>证据接地</span>
              <span style={{ color: ev.quality.missing ? C.amber : C.hubu }}>{ev.quality.grounded}/{ev.quality.total} 有据{ev.quality.missing ? ` · ${ev.quality.missing} 项缺证` : ' · 无编造'}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${groundPct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})` }} />
            </div>
          </div>

          {/* 七段缩影:圣裁 / 缺证 / 来源(详流程在下方安静房) */}
          <div style={{ borderTop: `1px solid ${C.gold}33`, paddingTop: 4 }}>
            <Row k="圣裁">
              <span style={{ color: dot, fontWeight: 600 }}>{ev.verdictCn}</span>
              <span style={{ color: C.muted }}> · 评分 {ev.score ?? '缺'} · 敞口 {ev.exposure ?? '缺'} · 风险 {FINANCE_RISK_LABEL[top.risk_level]}</span>
            </Row>
            {ev.oneWayDoor.oneWay && (
              <Row k="单向门" kColor={C.danger}>
                <span style={{ color: '#F6B9C2' }}>需陛下亲裁（{ev.oneWayDoor.reasons.join('、')}）· 禁一键静默准奏</span>
              </Row>
            )}
            <Row k="缺证" kColor={C.amber}>
              {ev.missing.length > 0
                ? <span style={{ color: '#F3D08A' }}>{ev.missing.join(' · ')}<span style={{ fontSize: 11.5, color: C.faint }}>　— 臣不敢编,缺即缺</span></span>
                : <span style={{ color: C.hubu }}>核到能核的,无缺证</span>}
            </Row>
            <Row k="来源" kColor={C.muted}>
              {isLive ? '主库 turso · /api/court/hubu/overview · 户部三引擎裁决' : '主库回退 · 成色待核 · 非编造'}
            </Row>
          </div>

          {/* 朱批落印(震撼门只做意向;真裁决/写回在下方安静房队列,铁律9) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11.5, color: C.faint, fontFamily: 'var(--font-serif)' }}>户部尚书 谨呈 · 待陛下朱批 · 详裁见下</span>
            <a href="#hubu-decision-queue" style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold} 55%, ${C.goldDeep})`, color: '#1A1206', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 6px 18px ${C.gold}33`, textDecoration: 'none' }}>
              下方拍板 ↓
            </a>
          </div>
        </div>
      </GlassPanel>

      {/* 丞相参谋:卷轴下方的「先压判断与缺证」+ 跨部会审(借鉴 Claude Code 交互 DNA) */}
      <ChancellorAnalysis project={top} ev={ev} live={isLive} />
    </div>
  );
}

function Row({ k, children, kColor }: { k: string; children: React.ReactNode; kColor?: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: `1px solid ${C.border}66`, fontSize: 13.5, lineHeight: 1.7 }}>
      <span style={{ width: 44, flexShrink: 0, color: kColor ?? C.goldDeep, fontFamily: 'var(--font-serif)', letterSpacing: '0.18em' }}>{k}</span>
      <div style={{ flex: 1, color: C.dim }}>{children}</div>
    </div>
  );
}
