'use client';

/**
 * 辅臣立柱 · AdvisorRail
 *
 * 御座室两侧常驻的辅臣(左=丞相·辅政,右=钦天监·训诲)。
 * 关键天才设计:默认是 56px 窄立柱(只露立像缩影 + 竖排名 + 一行当前态),
 * 点一下才滑出完整浮层 —— 覆盖在上层,**不挤压中央舞台**。
 * 这样"随时待命"(一直在、一键到) 与 "中间留出画面"(不展开时中央吃满) 同时成立。
 *
 * 冻结 token:帝金 #F0C66A / serif / 玻璃描边。
 */

import { type ReactNode } from 'react';

export interface AdvisorRailConfig {
  /** 丞相 / 钦天监 */
  name: string;
  /** 辅政 / 训诲 */
  role: string;
  /** 徽印字形(◆ / ◈),无立像资产时的视觉锚 */
  glyph: string;
  /** 可选立像资产 url(展开头部用) */
  portrait?: string;
  /** 立像裁切焦点 */
  portraitPosition?: string;
  /** 折叠态一行当前态(如"3 部门已表态" / "不懂就问") */
  statusLine: string;
  /** 强调色,默认帝金 */
  accent?: string;
  /** 展开浮层标题,默认 `${name} · ${role}` */
  expandedTitle?: string;
  /** 展开浮层正文 */
  children: ReactNode;
}

export interface AdvisorRailProps {
  side: 'left' | 'right';
  config: AdvisorRailConfig;
  railWidth: number;
  /** 底部对话栏高度(立柱下边留出,不压住对话栏) */
  bottomInset: number;
  expanded: boolean;
  onToggle: () => void;
}

export function AdvisorRail({ side, config, railWidth, bottomInset, expanded, onToggle }: AdvisorRailProps) {
  const accent = config.accent ?? '#F0C66A';
  const isLeft = side === 'left';
  const portraitPosition = config.portraitPosition ?? 'center top';

  return (
    <>
      {/* ── 折叠态:窄立柱(常驻待命) ── */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${config.name} · ${config.role}（点击展开）`}
        aria-expanded={expanded}
        style={{
          position: 'absolute',
          top: 0,
          bottom: bottomInset,
          left: isLeft ? 0 : undefined,
          right: isLeft ? undefined : 0,
          width: railWidth,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0 18px',
          border: 'none',
          borderRight: isLeft ? `1px solid ${accent}33` : 'none',
          borderLeft: isLeft ? 'none' : `1px solid ${accent}33`,
          background: 'linear-gradient(180deg, rgba(7,11,20,0.72), rgba(4,6,14,0.52))',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          outline: expanded ? `1px solid ${accent}55` : 'none',
        }}
      >
        {/* 立像缩影 / 徽印 */}
        <span style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 40,
              height: 44,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              border: `1px solid ${accent}66`,
              background: config.portrait
                ? `${portraitPosition}/cover url(${config.portrait})`
                : `radial-gradient(circle at 50% 35%, ${accent}28, rgba(7,11,20,0.6))`,
              color: accent,
              fontSize: 15,
              boxShadow: `0 0 18px ${accent}28, inset 0 -18px 20px rgba(2,5,10,0.32)`,
              overflow: 'hidden',
            }}
          >
            {config.portrait ? '' : config.glyph}
          </span>
          {/* 竖排名 */}
          <span
            style={{
              writingMode: 'vertical-rl',
              color: '#F4E8C7',
              fontFamily: 'var(--font-serif)',
              fontSize: 15,
              letterSpacing: '0.14em',
              fontWeight: 700,
            }}
          >
            {config.name}
          </span>
        </span>

        {/* 当前态点 + 一字 */}
        <span style={{ display: 'grid', justifyItems: 'center', gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span style={{ writingMode: 'vertical-rl', color: '#8E96AF', fontSize: 9, letterSpacing: '0.08em' }}>{config.role}</span>
        </span>
      </button>

      {/* ── 展开态:浮层(覆盖上层,不挤压中央) ── */}
      {expanded && (
        <section
          aria-label={`${config.name} · ${config.role}`}
          style={{
            position: 'absolute',
            top: 12,
            bottom: bottomInset + 8,
            left: isLeft ? railWidth : undefined,
            right: isLeft ? undefined : railWidth,
            width: 340,
            maxWidth: 'calc(100% - 80px)',
            zIndex: 39,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${accent}3a`,
            borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(8,14,24,0.95), rgba(5,8,16,0.92))',
            boxShadow: `0 18px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`,
            backdropFilter: 'blur(14px)',
            overflow: 'hidden',
          }}
        >
          {/* 头部 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: `1px solid ${accent}22` }}>
            <span
              style={{
                width: 58,
                height: 68,
                borderRadius: 12,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${accent}66`,
                background: config.portrait
                  ? `${portraitPosition}/cover url(${config.portrait})`
                  : `radial-gradient(circle at 50% 35%, ${accent}28, rgba(7,11,20,0.6))`,
                color: accent,
                fontSize: 18,
                boxShadow: `0 0 22px ${accent}22, inset 0 -24px 24px rgba(2,5,10,0.36)`,
                overflow: 'hidden',
              }}
            >
              {config.portrait ? '' : config.glyph}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, letterSpacing: '0.04em' }}>
                {config.expandedTitle ?? `${config.name} · ${config.role}`}
              </div>
              <div style={{ color: '#AEB7D4', fontSize: 11, marginTop: 5, lineHeight: 1.45 }}>{config.statusLine}</div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="收起"
              style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: `1px solid ${accent}33`, background: 'rgba(255,255,255,0.04)', color: '#C8CDD8', fontSize: 13, cursor: 'pointer' }}
            >
              {isLeft ? '‹' : '›'}
            </button>
          </div>
          {/* 正文 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
            {config.children}
          </div>
        </section>
      )}
    </>
  );
}
