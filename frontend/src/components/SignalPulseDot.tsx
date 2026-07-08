export type SignalLevel = 'info' | 'watch' | 'warning' | 'critical';

export interface SignalPulseDotProps {
  level: SignalLevel;
  size?: number;
  withPulse?: boolean;
  colorOverride?: string;
  onClick?: () => void;
  label?: string;
}

const LEVEL_COLOR: Record<SignalLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

export function SignalPulseDot({
  level,
  size = 8,
  withPulse = true,
  colorOverride,
  onClick,
  label,
}: SignalPulseDotProps) {
  const color = colorOverride ?? LEVEL_COLOR[level];
  const container = size * 3;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{ width: label ? undefined : container, height: container }}
    >
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: container, height: container }}
      >
        {withPulse && (
          <span
            className="animate-breathe absolute inset-0 rounded-full"
            style={{ backgroundColor: color, opacity: 0.25, filter: 'blur(4px)' }}
          />
        )}
        <span
          className="absolute rounded-full border"
          style={{ width: size * 2, height: size * 2, borderColor: color, opacity: 0.5 }}
        />
        <span
          className="relative rounded-full"
          style={{ width: size, height: size, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
      </span>
      {label && (
        <span className="font-mono text-[11px]" style={{ color, opacity: 0.85 }}>
          {label}
        </span>
      )}
    </span>
  );
}
