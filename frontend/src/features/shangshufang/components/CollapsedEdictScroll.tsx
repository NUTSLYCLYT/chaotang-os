import { Maximize2 } from 'lucide-react';

export function CollapsedEdictScroll({
  title,
  status,
  sourceLabel,
  departmentCount,
  onOpen,
}: {
  title: string;
  status: string;
  sourceLabel: string;
  departmentCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-three-axis-scroll
      data-testid="collapsed-edict-scroll"
      className="group relative mx-auto block w-full max-w-[900px] px-2 text-left transition duration-[260ms] hover:-translate-y-0.5 md:px-8"
      aria-label="展开圣旨"
    >
      <span
        aria-hidden
        className="absolute inset-x-10 top-1/2 hidden h-16 -translate-y-1/2 rounded-full blur-2xl md:block"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(240,198,106,0.24), rgba(185,246,210,0.08) 42%, transparent 72%)',
        }}
      />
      <span className="relative grid h-[58px] grid-cols-[30px_minmax(0,1fr)_30px] items-center md:h-[64px] md:grid-cols-[46px_minmax(0,1fr)_46px]">
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            aria-hidden
            className={`relative z-20 flex h-[58px] items-center justify-center md:h-[64px] ${side === 'left' ? 'order-1' : 'order-3'}`}
          >
            <span
              className="absolute h-[46px] w-[19px] rounded-full md:h-[54px] md:w-[23px]"
              style={{
                background:
                  'linear-gradient(90deg, #2b1a07 0%, #8a6426 22%, #f0c66a 48%, #6f4a16 78%, #1a1005 100%)',
                boxShadow:
                  'inset 0 0 10px rgba(255,242,184,0.32), 0 14px 28px rgba(0,0,0,0.42)',
              }}
            />
            <span
              className="absolute top-1/2 h-[25px] w-[25px] -translate-y-1/2 rounded-full md:h-[32px] md:w-[32px]"
              style={{
                background:
                  'radial-gradient(circle at 35% 28%, #f5fff0 0%, #bfd9bd 24%, #7d9f7f 56%, #263629 100%)',
                boxShadow:
                  'inset -5px -7px 12px rgba(11,28,18,0.40), inset 5px 5px 10px rgba(255,255,255,0.32), 0 0 22px rgba(213,239,206,0.20)',
              }}
            />
          </span>
        ))}

        <span
          className="relative order-2 z-10 mx-[-10px] flex h-[44px] min-w-0 items-center overflow-hidden rounded-full border px-4 md:mx-[-15px] md:h-[50px] md:px-7"
          style={{
            borderColor: 'rgba(140,92,36,0.62)',
            background:
              'radial-gradient(ellipse at 50% 18%, rgba(255,249,226,0.98), rgba(239,211,151,0.96) 58%, rgba(194,137,58,0.95) 100%), repeating-linear-gradient(90deg, rgba(120,74,22,0.11) 0 1px, transparent 1px 14px)',
            boxShadow:
              'inset 0 1px 0 rgba(255,250,232,0.82), inset 0 -12px 22px rgba(110,64,18,0.18), 0 20px 52px rgba(0,0,0,0.50), 0 0 32px rgba(240,198,106,0.10)',
          }}
        >
          <span
            aria-hidden
            className="absolute inset-y-2 left-4 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(122,74,8,0.34), transparent)' }}
          />
          <span
            aria-hidden
            className="absolute inset-y-2 right-4 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(122,74,8,0.34), transparent)' }}
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-0 h-full w-[58%] -translate-x-1/2 opacity-55"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(255,248,224,0.72), transparent 72%)',
            }}
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 grid h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] place-items-center rounded-full border text-[16px] font-black opacity-80 md:h-[50px] md:w-[50px]"
            style={{
              borderColor: 'rgba(122,36,30,0.22)',
              color: 'rgba(122,36,30,0.18)',
              fontFamily: 'var(--font-serif)',
            }}
          >
            旨
          </span>
          <span
            aria-hidden
            className="absolute inset-x-8 top-2 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(122,74,8,0.30), transparent)' }}
          />
          <span
            aria-hidden
            className="absolute inset-x-8 bottom-2 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(122,74,8,0.30), transparent)' }}
          />
          <span className="relative z-10 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="min-w-0">
              <span
                className="block truncate text-[14px] font-black leading-none md:text-[16px]"
                style={{
                  color: '#211406',
                  fontFamily: '"LiSu", "STLiti", "STKaiti", "KaiTi", var(--font-serif)',
                  letterSpacing: title.length <= 8 ? '0.08em' : 0,
                  textShadow: '0 1px 0 rgba(255,250,232,0.58), 0 8px 18px rgba(80,45,12,0.14)',
                }}
              >
                {title}
              </span>
              <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold" style={{ color: 'rgba(63,44,18,0.78)', fontFamily: 'var(--font-serif)' }}>
                <span>{status}</span>
                <span aria-hidden>·</span>
                <span className="max-w-[120px] truncate md:max-w-[190px]">{sourceLabel}</span>
                <span aria-hidden>·</span>
                <span>{departmentCount} 部门</span>
              </span>
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition group-hover:border-[#7a4a08]/45 group-hover:bg-[#7a4a08]/10 md:px-2.5"
              style={{ borderColor: 'rgba(122,74,8,0.24)', color: '#7a4a08', background: 'rgba(122,74,8,0.06)', fontFamily: 'var(--font-serif)' }}
            >
              展卷
              <Maximize2 size={12} />
            </span>
          </span>
          <span
            aria-hidden
            className="absolute right-8 top-1/2 z-10 hidden h-9 w-7 -translate-y-1/2 rotate-[-8deg] place-items-center rounded-[5px] border text-[12px] font-black text-[#7A241E] md:grid"
            style={{
              borderColor: 'rgba(122,36,30,0.42)',
              background: 'rgba(122,36,30,0.07)',
              fontFamily: 'var(--font-serif)',
              boxShadow: 'inset 0 0 0 1px rgba(255,248,224,0.24)',
            }}
          >
            封
          </span>
        </span>
      </span>
    </button>
  );
}
