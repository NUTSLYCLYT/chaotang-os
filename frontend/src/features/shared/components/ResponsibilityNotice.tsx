'use client';

/**
 * 责任边界声明(2026-06-25 · 法律护盾 / 决策系统命脉)。
 *
 * 本系统出"决策建议",客户照做亏了找谁担责=能搞垮公司的风险。护盾=人工确认门 + 白纸黑字定性:
 *   "丞相建议·陛下裁决——本系统提供咨询建议,最终决策与责任在裁决者本人。"
 * 必须常驻在每个出奏折/给建议的界面(奏折底/圣裁旁/今日要务下)。配套:交付合同同条款 + 圣裁审计留痕
 * (谁/何时/对哪份奏折拍的板——证明是人决策非 AI,见史馆归档)。
 *
 * variant:
 *   - 'inline' 一行轻量(英雄位/卡底)
 *   - 'gate'   圣裁动作旁的强调版(裁决前提醒"责任在你")
 */

interface Props {
  variant?: 'inline' | 'gate';
  accent?: string;
}

export function ResponsibilityNotice({ variant = 'inline', accent = '#F0C66A' }: Props) {
  if (variant === 'gate') {
    return (
      <div
        className="rounded-lg border px-3 py-2 text-[11px] leading-5"
        style={{ borderColor: `${accent}33`, background: `${accent}0a`, color: '#C6BB9D' }}
      >
        <span className="mr-1 font-semibold" style={{ color: accent }}>裁决前知悉：</span>
        丞相只提供咨询建议，<span className="font-semibold">最终决策与责任在陛下本人</span>。本系统不替你拍板、不担经营/法律后果。
      </div>
    );
  }
  return (
    <p className="mt-2 text-[10px] leading-4 text-[#8A8470]">
      丞相建议·陛下裁决 —— 本系统提供咨询建议，最终决策与责任在裁决者本人。
    </p>
  );
}
