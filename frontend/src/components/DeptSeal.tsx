'use client';

/**
 * 朝堂官印体系 · DeptSeal（2026-06-29）
 *
 * 设计方向：帝金朱印——朱红印泥(真公章信号) + 帝金描边(朝堂品牌)，皇家中式官印。
 * 圆章=世界500强公章的庄重 + 中式官印的权威。纯 SVG，矢量无损，可嵌文档/UI/印章页。
 *
 * 复用冻结帝金系统色值（design-tokens）：gold #D4A84B / goldBright #F0C66A / goldDeep #8A6A2A。
 * 朱红印泥 #BE2E26（官印标准朱砂红），在暗金背景上 POP，红金=帝制配色。
 *
 * 弧字用逐字 rotate 定位（非 textPath）——librsvg/浏览器/文档全渲染器兼容（textPath 在 librsvg 不渲）。
 * 字体走仓内 var(--font-serif)(Noto Serif SC)，不自 import next/font（AGENTS.md §3）。
 */

export type SealVariant = 'vermilion' | 'gold';

export interface DeptSealProps {
  /** 部门中文名，2 字最佳（户部/工部/钦天监）。 */
  name: string;
  /** 机构名，绕上弧（默认 陕西铭硕新能源）。 */
  org?: string;
  /** 章别，绕下弧（默认 专用章；可填 之印/财政专用章）。 */
  kind?: string;
  size?: number;
  /** vermilion=朱红印泥(文档/正式) | gold=帝金线(暗金UI内嵌)。 */
  variant?: SealVariant;
  className?: string;
}

const INK = {
  vermilion: { ring: '#BE2E26', text: '#BE2E26', star: '#D4A84B', glow: 'rgba(190,46,38,0.35)' },
  gold: { ring: '#D4A84B', text: '#F0C66A', star: '#F0C66A', glow: 'rgba(212,168,75,0.35)' },
} as const;

interface ArcChar {
  ch: string;
  x: number;
  y: number;
  deg: number;
}

/** 逐字沿弧定位（rotate transform，全渲染器兼容）。 */
function arcChars(
  text: string,
  cx: number,
  cy: number,
  r: number,
  centerDeg: number,
  dir: number,
  rotOff: number,
  step: number,
): ArcChar[] {
  const n = text.length;
  return [...text].map((ch, i) => {
    const ang = centerDeg + dir * (i - (n - 1) / 2) * step;
    const rad = (ang * Math.PI) / 180;
    return { ch, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), deg: ang + rotOff };
  });
}

/** 五角星 path（cx,cy 中心，r 外径，innerRatio 内径比）。 */
function fivePointStar(cx: number, cy: number, r: number, innerRatio = 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * innerRatio;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

export function DeptSeal({
  name,
  org = '陕西铭硕新能源',
  kind = '专用章',
  size = 160,
  variant = 'vermilion',
  className,
}: DeptSealProps) {
  const ink = INK[variant];
  const nameSize = name.length >= 3 ? 34 : 46;
  const serif = { fontFamily: 'var(--font-serif)' };
  const orgArc = arcChars(org, 100, 100, 72, -90, 1, 90, 17);
  const kindArc = arcChars(kind, 100, 100, 66, 90, -1, -90, 16);

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${org}${name}${kind}`}
      style={{ filter: `drop-shadow(0 0 ${size * 0.04}px ${ink.glow})` }}
    >
      <circle cx="100" cy="100" r="94" fill="none" stroke={ink.ring} strokeWidth="5" />
      <circle cx="100" cy="100" r="82" fill="none" stroke={ink.ring} strokeWidth="2" />

      {orgArc.map((c, i) => (
        <text
          key={`o${i}`}
          x={c.x}
          y={c.y}
          fill={ink.text}
          fontSize="14"
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(${c.deg.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`}
          style={serif}
        >
          {c.ch}
        </text>
      ))}

      {kindArc.map((c, i) => (
        <text
          key={`k${i}`}
          x={c.x}
          y={c.y}
          fill={ink.text}
          fontSize="12"
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(${c.deg.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`}
          style={serif}
        >
          {c.ch}
        </text>
      ))}

      <path d={fivePointStar(100, 54, 11)} fill={ink.star} stroke={ink.ring} strokeWidth="0.5" />

      <text
        x="100"
        y="116"
        fill={ink.text}
        fontSize={nameSize}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        letterSpacing={name.length >= 3 ? '0' : '4'}
        style={serif}
      >
        {name}
      </text>
    </svg>
  );
}

/** 11 部门官印规范配置（章别按部门职能命名，世界500强"专用章"惯例）。 */
export interface SealSpec {
  code: string;
  name: string;
  kind: string;
}

export const DEPT_SEALS: SealSpec[] = [
  { code: 'prime_minister', name: '军机处', kind: '中枢专用章' },
  { code: 'hu_bu', name: '户部', kind: '财政专用章' },
  { code: 'bing_bu', name: '兵部', kind: '销售专用章' },
  { code: 'gong_bu', name: '工部', kind: '研发专用章' },
  { code: 'xing_bu', name: '刑部', kind: '法务专用章' },
  { code: 'li_bu', name: '吏部', kind: '人事专用章' },
  { code: 'li_bu_rites', name: '礼部', kind: '市场专用章' },
  { code: 'qin_tian_jian', name: '钦天监', kind: '预测专用章' },
  { code: 'jin_yi_wei', name: '锦衣卫', kind: '情报专用章' },
  { code: 'tai_yi_yuan', name: '太医院', kind: '健康专用章' },
  { code: 'scribe', name: '史馆', kind: '归档专用章' },
];
