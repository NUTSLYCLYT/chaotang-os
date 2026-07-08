'use client';

type CourtAmbientTheme =
  | 'default'
  | 'shangshufang'
  | 'rites'
  | 'finance'
  | 'legal'
  | 'ops'
  | 'personnel'
  | 'manor'
  | 'command';

type CourtAmbientLayerProps = {
  theme?: CourtAmbientTheme;
  accent?: string;
  active?: boolean;
  density?: 'quiet' | 'normal' | 'rich';
};

const THEME_ACCENT: Record<CourtAmbientTheme, string> = {
  default: '#F0C66A',
  shangshufang: '#F0C66A',
  rites: '#6FD0D8',
  finance: '#EBCB7B',
  legal: '#F43F5E',
  ops: '#6BA0FF',
  personnel: '#B9F6D2',
  manor: '#3DD68C',
  command: '#F0C66A',
};

const PARTICLES = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 19) % 84)}%`,
  top: `${12 + ((index * 29) % 68)}%`,
  delay: `${(index % 8) * 0.9}s`,
  duration: `${12 + (index % 5) * 2}s`,
  size: `${2 + (index % 3)}px`,
}));

function themeLabel(theme: CourtAmbientTheme) {
  if (theme === 'finance') return '账流';
  if (theme === 'rites') return '审稿';
  if (theme === 'legal') return '红线';
  if (theme === 'ops') return '战线';
  if (theme === 'personnel') return '名册';
  if (theme === 'manor') return '地块';
  if (theme === 'command') return '会审';
  if (theme === 'shangshufang') return '候旨';
  return '运转';
}

export function CourtAmbientLayer({
  theme = 'default',
  accent,
  active = true,
  density = 'normal',
}: CourtAmbientLayerProps) {
  const color = accent ?? THEME_ACCENT[theme];
  const particleCount = density === 'quiet' ? 7 : density === 'rich' ? PARTICLES.length : 11;
  const particles = PARTICLES.slice(0, particleCount);
  const opacityScale = density === 'quiet' ? 0.52 : density === 'rich' ? 0.86 : 0.68;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: active ? 1 : 0.62 }}
      data-ambient-theme={theme}
    >
      <style>{`
        @keyframes court-ambient-breathe {
          0%, 100% { opacity: .48; transform: scale(1); }
          50% { opacity: .82; transform: scale(1.035); }
        }
        @keyframes court-ambient-drift {
          0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(.85); }
          18% { opacity: .72; }
          82% { opacity: .36; }
          100% { opacity: 0; transform: translate3d(22px, -36px, 0) scale(1.08); }
        }
        @keyframes court-ambient-flow {
          0% { opacity: 0; transform: translateX(-18%) scaleX(.62); }
          22% { opacity: .44; }
          100% { opacity: 0; transform: translateX(22%) scaleX(1); }
        }
        @keyframes court-ambient-desk-pulse {
          0%, 100% { opacity: .28; transform: scale(.92); }
          48% { opacity: .74; transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ambient-theme] .court-ambient-animated { animation: none !important; }
        }
      `}</style>

      <span
        className="court-ambient-animated absolute left-1/2 top-[18%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${color}24, transparent 68%)`,
          animation: 'court-ambient-breathe 14s ease-in-out infinite',
          opacity: 0.58 * opacityScale,
        }}
      />

      <span
        className="court-ambient-animated absolute left-[12%] right-[12%] top-[31%] h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}8A, transparent)`,
          filter: 'drop-shadow(0 0 12px rgba(240,198,106,0.22))',
          animation: 'court-ambient-flow 16s ease-in-out infinite',
          opacity: 0.52 * opacityScale,
        }}
      />

      <span
        className="court-ambient-animated absolute bottom-[12%] left-[16%] right-[16%] h-[22%] rounded-[50%] border"
        style={{
          borderColor: `${color}22`,
          transform: 'perspective(900px) rotateX(68deg)',
          boxShadow: `0 0 44px ${color}12, inset 0 0 34px ${color}10`,
          animation: 'court-ambient-breathe 18s ease-in-out infinite',
          opacity: 0.64 * opacityScale,
        }}
      />

      {particles.map((particle) => (
        <span
          key={particle.id}
          className="court-ambient-animated absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            background: particle.id % 3 === 0 ? '#F5E9C9' : color,
            boxShadow: `0 0 10px ${color}70`,
            animation: `court-ambient-drift ${particle.duration} ease-in-out ${particle.delay} infinite`,
            opacity: 0,
          }}
        />
      ))}

      <div className="absolute bottom-[10%] right-[9%] hidden grid-cols-3 gap-2 lg:grid">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="court-ambient-animated h-2.5 w-2.5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 14px ${color}`,
              animation: `court-ambient-desk-pulse ${5 + item}s ease-in-out ${item * 0.6}s infinite`,
              opacity: 0.32,
            }}
            title={themeLabel(theme)}
          />
        ))}
      </div>
    </div>
  );
}
