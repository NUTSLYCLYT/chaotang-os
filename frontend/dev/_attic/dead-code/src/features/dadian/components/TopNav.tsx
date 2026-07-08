import Link from "next/link";
import { NAV_ITEMS, NAV_HREF, REALM_DATE, NOTIF_COUNT } from "@/features/dadian/lib/dadian";

export default function TopNav({
  active = "大殿",
  subtitle,
  realmDate = REALM_DATE,
  notif = NOTIF_COUNT,
}: {
  active?: string;
  subtitle?: string;
  realmDate?: string;
  notif?: number;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 h-[52px] border-b border-[#d8b76a]/30 bg-[#06111f]/70 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 hairline-gold opacity-60" />
      <div className="flex h-full items-center gap-6 px-5">
        {/* logo + 可选副标题 */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <SealMark />
          <span className="text-[17px] font-semibold tracking-wide text-gold-200">
            朝堂&nbsp;OS
          </span>
        </Link>
        {subtitle && (
          <span className="hidden border-l border-gold-400/20 pl-4 text-micro tracking-wide text-parchment-200/70 xl:block">
            {subtitle}
          </span>
        )}

        {/* 主导航 */}
        <nav className="flex items-center gap-5">
          {NAV_ITEMS.map((item) => {
            const isActive = item === active;
            return (
              <Link
                key={item}
                href={NAV_HREF[item] ?? "#"}
                className={`relative py-4 text-[15px] tracking-wide transition ${
                  isActive
                    ? "text-gold-200"
                    : "text-parchment-100/70 hover:text-gold-100"
                }`}
              >
                {item}
                {isActive && (
                  <>
                    <span className="absolute -bottom-px left-1/2 h-1 w-1 -translate-x-1/2 rotate-45 bg-gold-300" />
                    <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 右侧时辰 + 操作 */}
        <div className="ml-auto flex shrink-0 items-center gap-5">
          <span className="hidden text-micro text-parchment-200/70 lg:block">
            {realmDate}
          </span>
          <button
            type="button"
            aria-label="通报"
            className="relative text-gold-200/80 transition hover:text-gold-100"
          >
            <BellIcon />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold leading-none text-white">
              {notif}
            </span>
          </button>
          <button
            type="button"
            aria-label="帮助"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-parchment-200/40 text-[11px] text-parchment-200/70 transition hover:border-gold-300 hover:text-gold-100"
          >
            ?
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-gold-400/55 bg-gradient-to-b from-gold-400/35 to-ink-800 text-[13px] font-semibold text-gold-100">
              皇
            </span>
            <span className="hidden text-base2 text-parchment-50 md:block">
              皇上
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function SealMark() {
  return (
    <span className="relative flex h-7 w-7 items-center justify-center">
      <svg viewBox="0 0 28 28" className="h-7 w-7">
        <rect x="6" y="6" width="16" height="16" rx="2" transform="rotate(45 14 14)" fill="none" stroke="#C9A55C" strokeWidth="1.3" />
        <rect x="9.5" y="9.5" width="9" height="9" rx="1" transform="rotate(45 14 14)" fill="none" stroke="#C9A55C" strokeWidth="1" opacity="0.6" />
        <circle cx="14" cy="14" r="2" fill="#E6CB85" />
      </svg>
    </span>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
      <path d="M6 9a6 6 0 0 1 12 0v4l1.4 2.6H4.6L6 13V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
