'use client';

/**
 * 御前对话栏 · CourtDialogueBar
 *
 * 统一的底部命令面 —— 每个朝堂页面都挂同一个,样式一致。
 * 天才设计(采纳):它**带着当前裁决对象的上下文**(你在军机处它显当前作战案、
 * 在史馆显当前卷宗),同一个御口跟着你在哪间屋走。所以"每页都有"不是复制三个框,
 * 而是同一道御前对话栏在不同舞台自动换语境。
 *
 * 纯表现 + 回调,不耦合任何后端;各页把 actions 接到自己已有的真实 handler。
 * 冻结 token:帝金 #F0C66A / serif / 玻璃描边,均与 page 内既有面板一致。
 */

import { useState, type ReactNode } from 'react';

export type CourtObjectTone = 'live' | 'demo' | 'pending';

const TONE_STYLE: Record<CourtObjectTone, { border: string; bg: string; color: string; label: string }> = {
  live: { border: 'rgba(61,214,140,0.34)', bg: 'rgba(61,214,140,0.10)', color: '#8BE4B4', label: 'LIVE' },
  demo: { border: 'rgba(143,155,178,0.34)', bg: 'rgba(143,155,178,0.10)', color: '#9AA3C4', label: 'DEMO' },
  pending: { border: 'rgba(240,198,106,0.32)', bg: 'rgba(240,198,106,0.09)', color: '#F0C66A', label: '待回写' },
};

export interface CourtDialogueAction {
  key: string;
  /** 按钮主字(问 / 旨 / 密) */
  glyph: string;
  /** 完整标签(问丞相 / 发圣旨 / 密旨) */
  label: string;
  tone?: 'gold' | 'plain' | 'danger';
  onClick: (draft: string) => void;
}

export interface CourtDialogueBarProps {
  /** 当前裁决对象标题(跟随所在舞台) */
  objectLabel: string;
  /** 对象来源态 */
  objectTone?: CourtObjectTone;
  /** 自定义态文案(覆盖 tone 默认 label) */
  objectStatusText?: string;
  /** 上下文行(证据/下一步) */
  contextLine?: string;
  /** 右侧附加上下文(如"史馆、军机处、户部") */
  contextRight?: ReactNode;
  placeholder?: string;
  actions: CourtDialogueAction[];
}

const ACTION_TONE: Record<NonNullable<CourtDialogueAction['tone']>, { border: string; bg: string; color: string }> = {
  gold: { border: 'rgba(255,224,154,0.55)', bg: 'linear-gradient(180deg, rgba(240,198,106,0.92), rgba(201,149,71,0.92))', color: '#211404' },
  plain: { border: 'rgba(255,255,255,0.16)', bg: 'rgba(255,255,255,0.05)', color: '#C8CDD8' },
  danger: { border: 'rgba(245,139,139,0.45)', bg: 'rgba(245,139,139,0.10)', color: '#F5A0A0' },
};

export function CourtDialogueBar({
  objectLabel,
  objectTone = 'demo',
  objectStatusText,
  contextLine,
  contextRight,
  placeholder = '问丞相：这件事该先准、先驳回，还是先补证？',
  actions,
}: CourtDialogueBarProps) {
  const [draft, setDraft] = useState('');
  const tone = TONE_STYLE[objectTone];

  return (
    <section
      aria-label="御前对话栏"
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px',
        border: '1px solid rgba(240,198,106,0.28)',
        borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(7,11,20,0.86), rgba(4,6,14,0.72))',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* 当前裁决对象 — 跟随舞台 */}
      <div style={{ minWidth: 0, flex: '0 1 280px', display: 'grid', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: '#7E8AA6', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>当前裁决对象</span>
          <span style={{ border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color, borderRadius: 999, padding: '2px 7px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            {objectStatusText ?? tone.label}
          </span>
        </div>
        <div style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {objectLabel}
        </div>
        {contextLine && (
          <div style={{ color: '#8E96AF', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contextLine}</div>
        )}
      </div>

      <span aria-hidden style={{ width: 1, alignSelf: 'stretch', margin: '12px 0', background: 'linear-gradient(180deg, transparent, rgba(240,198,106,0.22), transparent)' }} />

      {/* 御口 — 输入 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label="御前输入"
          style={{
            flex: 1,
            minWidth: 0,
            height: 38,
            borderRadius: 9,
            border: '1px solid rgba(240,198,106,0.20)',
            background: 'rgba(2,8,14,0.55)',
            color: '#E7DFC8',
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            padding: '0 12px',
            outline: 'none',
          }}
        />
        {contextRight && (
          <span style={{ color: '#8E96AF', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{contextRight}</span>
        )}
      </div>

      {/* 三动作 — 问丞相 / 发圣旨 / 密旨 */}
      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
        {actions.map((a) => {
          const at = ACTION_TONE[a.tone ?? 'plain'];
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => a.onClick(draft)}
              title={a.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 38,
                padding: '0 13px',
                border: `1px solid ${at.border}`,
                borderRadius: 9,
                background: at.bg,
                color: at.color,
                fontFamily: 'var(--font-serif)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800 }}>{a.glyph}</span>
              {a.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
