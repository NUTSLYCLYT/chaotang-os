import { navItems, activeNavKey, courtDate } from "@/features/shiguan-ui/lib/shiguan-data";

function Crest() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 2l3.6 7.6L28 11l-6 6 1.6 9L16 21.8 8.4 26 10 17l-6-6 8.4-1.4L16 2z"
        stroke="url(#g)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="rgba(220,180,86,0.10)"
      />
      <circle cx="16" cy="15" r="2.4" fill="#e3c074" />
      <defs>
        <linearGradient id="g" x1="4" y1="2" x2="28" y2="30">
          <stop stopColor="#f6e6b8" />
          <stop offset="1" stopColor="#c79a3c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a6 6 0 0 0-6 6c0 4-1.5 5.5-2 6.5h16c-.5-1-2-2.5-2-6.5a6 6 0 0 0-6-6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-gold-300/15 bg-[#05080f]/85 backdrop-blur-md">
      <div className="gold-hairline absolute inset-x-0 bottom-0 opacity-70" />
      <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-6 px-5">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Crest />
          <span className="font-serif text-[19px] font-semibold tracking-wide text-gold-gradient">
            朝堂 OS
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 items-center justify-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const active = item.key === activeNavKey;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-lg border border-gold-300/45 bg-gold-300/10 px-3.5 py-1.5 text-[14px] font-semibold text-gold-100 shadow-[0_0_18px_-8px_rgba(220,180,86,0.6)]"
                    : "rounded-lg border border-transparent px-3 py-1.5 text-[14px] text-jade-100/75 transition-colors hover:text-gold-100 hover:border-gold-300/20"
                }
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-[12.5px] tracking-wide text-slatey-300 lg:inline">
            {courtDate}
          </span>
          <button
            type="button"
            className="relative text-slatey-300 transition-colors hover:text-gold-100"
            aria-label="通知"
          >
            <BellIcon />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600/90 px-1 text-[10px] font-semibold text-white">
              12
            </span>
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slatey-400/40 text-[11px] text-slatey-300 transition-colors hover:border-gold-300/50 hover:text-gold-100"
            aria-label="帮助"
          >
            ?
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-300/40 bg-gradient-to-b from-ink-600 to-ink-800 font-serif text-[13px] text-gold-100">
              皇
            </span>
            <span className="hidden text-[13.5px] text-jade-100/90 sm:inline">
              皇上
            </span>
            <span className="text-slatey-400">▾</span>
          </div>
        </div>
      </div>
    </header>
  );
}
