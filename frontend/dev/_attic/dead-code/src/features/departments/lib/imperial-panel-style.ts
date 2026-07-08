import type { CSSProperties } from 'react';

export const DETAIL_PANEL_BASE =
  'linear-gradient(180deg, rgba(21,18,10,0.96) 0%, rgba(10,7,4,0.97) 100%)';

export function detailPanelBackground(accent: string, strength: 'soft' | 'strong' = 'soft') {
  const radialAlpha = strength === 'strong' ? '28' : '1c';
  return [
    `radial-gradient(circle at 22% 0%, ${accent}${radialAlpha}, transparent 56%)`,
    'linear-gradient(180deg, rgba(240,198,106,0.08) 0%, transparent 34%)',
    DETAIL_PANEL_BASE,
  ].join(', ');
}

export function detailPanelStyle(accent: string, strength: 'soft' | 'strong' = 'soft'): CSSProperties {
  return {
    background: detailPanelBackground(accent, strength),
    borderColor: `${accent}${strength === 'strong' ? '66' : '4d'}`,
    borderRadius: 16,
    boxShadow:
      `0 0 0 1px ${accent}18 inset, 0 18px 50px rgba(0,0,0,0.44), 0 0 30px ${accent}12`,
  };
}

export function detailInnerTileStyle(accent: string): CSSProperties {
  return {
    background:
      `radial-gradient(circle at 22% 0%, ${accent}1a, transparent 54%), linear-gradient(180deg, rgba(21,18,10,0.82), rgba(10,7,4,0.90))`,
    borderColor: `${accent}30`,
    borderRadius: 12,
    boxShadow: `0 0 0 1px ${accent}0f inset, 0 10px 28px rgba(0,0,0,0.28)`,
  };
}

export function imperialModulePanelStyle(
  accent: string,
  strength: 'soft' | 'strong' = 'soft',
): CSSProperties {
  return {
    background: 'linear-gradient(180deg, rgba(9,13,28,0.92) 0%, rgba(5,8,18,0.97) 100%)',
    borderColor: `${accent}${strength === 'strong' ? '4d' : '34'}`,
    borderRadius: 16,
    boxShadow:
      `0 20px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,233,201,0.045), inset 0 0 34px rgba(240,198,106,0.025), inset 0 0 42px ${accent}08`,
  };
}

export function imperialModuleTileStyle(accent: string): CSSProperties {
  return {
    background: 'linear-gradient(180deg, rgba(9,13,28,0.82) 0%, rgba(5,8,18,0.94) 100%)',
    borderColor: `${accent}26`,
    borderRadius: 12,
    boxShadow: `0 12px 32px rgba(0,0,0,0.36), inset 0 1px 0 rgba(245,233,201,0.04), inset 0 0 24px ${accent}08`,
  };
}
