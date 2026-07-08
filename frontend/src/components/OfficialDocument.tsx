'use client';

import { DeptSeal, type SealVariant } from './DeptSeal';

/**
 * 朝堂公文模板 · OfficialDocument（2026-06-29）
 *
 * 按《朝堂公文与用印标准》渲染任意决策为正式盖章公文。
 * 世界500强 BLUF 结论先行 + 中式官印落款 + 朝堂帝金视觉。复用 DeptSeal + 帝金 utility class。
 *
 * 双主题：dark=暗金驾驶舱(屏幕品牌) / paper=白纸朱印(打印/PDF·公文标准)。
 */

export type SourceTone = 'real' | 'est' | 'missing';
export type DocTheme = 'dark' | 'paper';

const SOURCE_META: Record<SourceTone, { dot: string; label: string }> = {
  real: { dot: '#3FA45B', label: '真' },
  est: { dot: '#C08A1E', label: '估' },
  missing: { dot: '#D14B4B', label: '缺' },
};

interface ThemePalette {
  bg: string;
  border: string;
  rule: string;
  heading: string;
  title: string;
  body: string;
  meta: string;
  blufBg: string;
  blufText: string;
  divider: string;
  topSeal: SealVariant;
}

const THEMES: Record<DocTheme, ThemePalette> = {
  dark: {
    bg: 'linear-gradient(180deg,#0A0E1E 0%,#0F1428 100%)',
    border: '#2C3560',
    rule: '#F0C66A',
    heading: '#F0C66A',
    title: '#FBF7EC',
    body: '#c6bb9d',
    meta: '#b6ab8c',
    blufBg: 'rgba(240,198,106,0.05)',
    blufText: '#EAEEFB',
    divider: '#1A2142',
    topSeal: 'gold',
  },
  paper: {
    bg: '#FCFBF6',
    border: '#DAD3C0',
    rule: '#9A6A1E',
    heading: '#8A5E1A',
    title: '#1A1611',
    body: '#3A352B',
    meta: '#897F64',
    blufBg: 'rgba(154,106,30,0.07)',
    blufText: '#241F16',
    divider: '#E5DFCE',
    topSeal: 'vermilion',
  },
};

export interface DocSection {
  heading: string;
  body: string | string[];
}

export interface DocEvidence {
  text: string;
  source: SourceTone;
}

export interface OfficialDocumentProps {
  org?: string;
  deptName: string;
  deptKind: string;
  docNo: string;
  classification?: string;
  date: string;
  title: string;
  /** BLUF 执行摘要：结论先行，3-5 句。 */
  bluf: string;
  sections?: DocSection[];
  evidence?: DocEvidence[];
  risks?: string[];
  nextSteps?: string[];
  handler: string;
  reviewers?: string[];
  theme?: DocTheme;
  /** 醒目状态横幅（如「草案·待联审朱批·未生效·禁外发」）——高风险报价/承诺必标，防"看着像定稿"误发。 */
  statusBanner?: string;
}

export function OfficialDocument({
  org = '陕西铭硕新能源',
  deptName,
  deptKind,
  docNo,
  classification = '内部',
  date,
  title,
  bluf,
  sections = [],
  evidence = [],
  risks = [],
  nextSteps = [],
  handler,
  reviewers = [],
  theme = 'dark',
  statusBanner,
}: OfficialDocumentProps) {
  const t = THEMES[theme];
  let n = 0;
  const num = () => String(++n).padStart(2, '0');
  const serif = { fontFamily: 'var(--font-serif)' } as const;

  return (
    <article
      style={{
        maxWidth: 720,
        margin: '0 auto',
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: '40px 48px 48px',
        position: 'relative',
        boxShadow: theme === 'dark' ? '0 24px 80px rgba(0,0,0,0.5)' : '0 8px 32px rgba(120,100,60,0.12)',
      }}
    >
      {/* ① 抬头区 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 18, borderBottom: `1.5px solid ${t.rule}`, marginBottom: 24 }}>
        <div>
          <div className="page-eyebrow" style={{ marginBottom: 6, color: t.meta }}>CHAOTANG · OFFICIAL DOCUMENT</div>
          <div className="display-serif" style={{ fontSize: 22, fontWeight: 700, color: t.heading }}>{org}</div>
          <div style={{ marginTop: 6, fontSize: 11, color: t.meta }}>
            {deptName} · 文号 {docNo} · 密级 {classification} · {date}
          </div>
        </div>
        <DeptSeal name={deptName} kind={deptKind} variant={t.topSeal} size={72} />
      </header>

      {/* 高风险状态横幅（草案/未生效）——红条+斜纹，防误当定稿外发 */}
      {statusBanner && (
        <div
          style={{
            margin: '0 0 18px',
            padding: '9px 16px',
            borderRadius: 8,
            border: '1px solid #D14B4B',
            background: 'repeating-linear-gradient(45deg,rgba(209,75,75,0.14),rgba(209,75,75,0.14) 10px,rgba(209,75,75,0.05) 10px,rgba(209,75,75,0.05) 20px)',
            color: '#E5604D',
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}
        >
          ⚠ {statusBanner}
        </div>
      )}

      {/* ② 标题 */}
      <h1 className="display-serif" style={{ fontSize: 26, fontWeight: 700, color: t.title, textAlign: 'center', margin: '8px 0 22px', lineHeight: 1.4 }}>
        {title}
      </h1>

      {/* ③ 执行摘要 BLUF */}
      <section style={{ border: `1px solid ${t.rule}`, borderRadius: 10, padding: '16px 20px', marginBottom: 26, background: t.blufBg }}>
        <div className="section-eyebrow" style={{ color: t.heading, marginBottom: 8 }}>执行摘要 · 结论先行</div>
        <p style={{ margin: 0, color: t.blufText, fontSize: 14, lineHeight: 1.85 }}>{bluf}</p>
      </section>

      {/* ④⑤ 正文段落 */}
      {sections.map((s, i) => (
        <section key={i} style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8, color: t.heading, ...serif }}>
            {num()} · {s.heading}
          </div>
          {(Array.isArray(s.body) ? s.body : [s.body]).map((p, j) => (
            <p key={j} style={{ margin: '0 0 8px', color: t.body, fontSize: 13, lineHeight: 1.85 }}>{p}</p>
          ))}
        </section>
      ))}

      {/* 分析依据 · 三色来源标 */}
      {evidence.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 10, color: t.heading, ...serif }}>{num()} · 分析与依据</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {evidence.map((e, i) => {
              const m = SOURCE_META[e.source];
              return (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', margin: '0 0 7px', color: t.body, fontSize: 13, lineHeight: 1.7 }}>
                  <span style={{ flexShrink: 0, width: 22, height: 18, borderRadius: 4, background: `${m.dot}22`, color: m.dot, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{m.label}</span>
                  <span>{e.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ⑦ 风险与缺证 */}
      {risks.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8, color: SOURCE_META.missing.dot, ...serif }}>{num()} · 风险与缺证</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {risks.map((r, i) => (
              <li key={i} style={{ margin: '0 0 6px', color: t.body, fontSize: 13, lineHeight: 1.7 }}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ⑧ 后续与质门 */}
      {nextSteps.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-title" style={{ marginBottom: 8, color: t.heading, ...serif }}>{num()} · 后续与质门</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {nextSteps.map((s, i) => (
              <li key={i} style={{ margin: '0 0 6px', color: t.body, fontSize: 13, lineHeight: 1.7 }}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ⑨ 落款区 · 朱红官印盖在右下 */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20, borderTop: `1px solid ${t.divider}`, marginTop: 8 }}>
        <div style={{ lineHeight: 1.9, color: t.meta, fontSize: 11 }}>
          <div>承办：{deptName} · {handler}</div>
          {reviewers.length > 0 && <div>会审：{reviewers.join(' · ')}</div>}
          <div>日期：{date}</div>
        </div>
        <div style={{ transform: 'rotate(-8deg)', marginRight: 8 }}>
          <DeptSeal name={deptName} kind={deptKind} variant="vermilion" size={104} />
        </div>
      </footer>
    </article>
  );
}
