'use client';

import type { SourceLabel } from '@/core/courtos/types';

/**
 * 把握度 + 来源 合成徽(吏部产品语言试纸 · 2026-06-22 · 会审 Jobs/张小龙)
 *
 * 一个徽,两层信息合一:**数字 = 把握度,颜色 = 来源真假**。
 * 老板学读一个信号,不是两个标签——把握度高但来源是 DEMO(灰),一眼看穿"假的"。
 * 这是验证"把握度产品语言老板买不买账"的最小试纸:塞进 seed 卡,看老板会不会追问。
 */

type Tone = { ring: string; text: string; label: string };

const SOURCE_TONE: Record<SourceLabel, Tone> = {
  LIVE: { ring: '#F0C66A', text: '#F0C66A', label: 'LIVE' },
  LIVE_SWARM: { ring: '#F0C66A', text: '#F0C66A', label: 'LIVE·蜂群' },
  MIXED: { ring: '#F5A524', text: '#F5A524', label: 'MIXED' },
  FALLBACK: { ring: '#6A7299', text: '#9AA3BD', label: 'FALLBACK' },
  DEMO: { ring: '#6A7299', text: '#9AA3BD', label: 'DEMO·沙盘' },
};

/** 把后端/种子的 source 串(seed/turso/fallback…)归一到产品面 5 标签。 */
export function sourceToLabel(source: string | undefined): SourceLabel {
  switch ((source ?? '').toLowerCase()) {
    case 'turso':
    case 'live':
      return 'LIVE';
    case 'live_swarm':
    case 'swarm':
      return 'LIVE_SWARM';
    case 'mixed':
      return 'MIXED';
    case 'fallback':
      return 'FALLBACK';
    default:
      return 'DEMO'; // seed / mock / 未知 一律当 DEMO,绝不冒充真
  }
}

interface ConfidenceSourceBadgeProps {
  /** 0–1 把握度 */
  confidence: number;
  sourceLabel: SourceLabel;
  /** 把握度来源:'default' = 兜底值非实测 → 不显伪百分比,显「未测」(会审 MEDIUM:别拿默认 0.5 冒充真把握度)。 */
  confidenceSource?: 'measured' | 'default';
}

export function ConfidenceSourceBadge({ confidence, sourceLabel, confidenceSource = 'measured' }: ConfidenceSourceBadgeProps) {
  const baseTone = SOURCE_TONE[sourceLabel] ?? SOURCE_TONE.DEMO;
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const fake = sourceLabel === 'DEMO' || sourceLabel === 'FALLBACK';
  const unmeasured = confidenceSource === 'default';
  // 未测:整徽转灰(边框/底/圆点/标签全降级),别让帝金外壳与灰「未测」打架——
  // 会审 HIGH:只灰文字、外壳仍帝金,老板看轮廓仍读成"LIVE 真"。来源标签留着但也转灰。
  const tone = unmeasured ? { ring: '#6A7299', text: '#9AA3BD', label: baseTone.label } : baseTone;
  return (
    <span
      title={
        unmeasured
          ? `把握度未测(蜂群未返质量分) · 来源 ${tone.label}`
          : `把握度 ${pct}% · 来源 ${tone.label}${fake ? '(非真实数据,仅供参考)' : ''}`
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${tone.ring}55`,
        background: `${tone.ring}14`,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: tone.ring, fontSize: 9 }}>◉</span>
      <span style={{ color: tone.text, fontWeight: 700 }}>{unmeasured ? '未测' : `${pct}%`}</span>
      <span style={{ color: tone.text, opacity: 0.78, fontSize: 9.5 }}>{tone.label}</span>
    </span>
  );
}
