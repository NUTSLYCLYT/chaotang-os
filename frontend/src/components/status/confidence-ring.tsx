/**
 * ConfidenceRing — 置信度圆环
 *
 * 通用组件：任何 0-1 的概率/置信度都可以用它展示
 * 颜色按值自动映射：
 *   ≥ 0.8  绿 · ≥ 0.6  金 · ≥ 0.4  橙 · < 0.4  红
 */

export interface ConfidenceRingProps {
  /** 0.0 - 1.0 */
  value: number;
  /** 外径 px，默认 48 */
  size?: number;
  /** 描边粗度，默认按 size 推算 */
  thickness?: number;
  /** 是否在圆心显示百分比文本 */
  showLabel?: boolean;
  /** 自定义覆盖颜色（忽略自动映射） */
  colorOverride?: string;
}

function colorFor(value: number): string {
  if (value >= 0.8) return '#3DD68C';
  if (value >= 0.6) return '#F0C66A';
  if (value >= 0.4) return '#F5A524';
  return '#F43F5E';
}

export function ConfidenceRing({
  value,
  size = 48,
  thickness,
  showLabel = true,
  colorOverride,
}: ConfidenceRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const stroke = thickness ?? Math.max(3, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLength = clamped * circumference;
  const color = colorOverride ?? colorFor(clamped);

  const pct = Math.round(clamped * 100);
  const labelFont = Math.round(size / 3.2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'inline-block' }}
    >
      {/* 背景圆 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(26, 33, 66, 0.9)"
        strokeWidth={stroke}
      />
      {/* 进度弧 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          filter: `drop-shadow(0 0 6px ${color}88)`,
          transition: 'stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      {/* 中心文字 */}
      {showLabel && (
        <text
          x={size / 2}
          y={size / 2}
          fontSize={labelFont}
          fontFamily="monospace"
          fontWeight="700"
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {pct}
        </text>
      )}
    </svg>
  );
}
