import Link from "next/link";

import styles from "./ChaotangHeader.module.css";

type VisualNavItem = {
  label: string;
  href?: "/study" | "/shiguan";
  current?: boolean;
};

const VISUAL_NAV_ITEMS: readonly VisualNavItem[] = [
  { label: "大殿" },
  { label: "上书房", href: "/study", current: true },
  { label: "军机处" },
  { label: "六部" },
  { label: "专署" },
  { label: "史馆", href: "/shiguan" },
] as const;

export function ChaotangHeader({ currentLabel }: { currentLabel: string }) {
  return (
    <header className={styles.header} data-three-axis-topnav aria-label="朝堂主导航">
      <Link className={styles.brand} href="/study" aria-label="返回上书房">
        <span className={styles.emblem} aria-hidden>
          <svg viewBox="0 0 64 64">
            <defs>
              <linearGradient id="chaotang-emblem-gold" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFE9B8" />
                <stop offset="0.5" stopColor="#F0C66A" />
                <stop offset="1" stopColor="#C99A3F" />
              </linearGradient>
              <radialGradient id="chaotang-emblem-pearl" cx="0.4" cy="0.35" r="0.65">
                <stop stopColor="#FFF7E2" />
                <stop offset="1" stopColor="#E3B259" />
              </radialGradient>
            </defs>
            <path className={styles.dragonStroke} d="M44 27C55 31 56 45 46 51C36 56 23 54 18 44C14 36 17 28 26 27" />
            <path className={styles.dragonStroke} d="M26 27C30 26 33 29 31 33" strokeWidth="4" />
            <path className={styles.dragonDetail} d="M52 33l4.5-1.5M53 46l4 2M34 55l.5 4.5" />
            <path className={styles.dragonHead} d="M44 27C49 22 49 13 42 10.5C36 8 29 10 28.5 16C24 16 21 19 23 23C20 24 20 28 24 28C24 31 28 32 31 30C36 31 41 30 44 27Z" />
            <path className={styles.dragonMouth} d="M23 23C26 24 30 24 33 22" />
            <path className={styles.dragonDetail} d="M42 10.5C46 5 53 5 54 10M35 10C36 4.5 41 3.5 43.5 6.5M22 25C16 27 12 25 10 20M24 28.5C20 31 17 31 14 29" />
            <circle cx="38" cy="17" r="2.1" className={styles.eye} />
            <circle cx="26" cy="21.5" r="1" className={styles.eye} />
            <circle cx="10" cy="32" r="3.8" className={styles.pearl} />
          </svg>
        </span>
        <span className={styles.brandCopy}>
          <b>朝堂 OS</b>
          <small>上值朝 · AI 智能办公</small>
        </span>
      </Link>
      <nav className={styles.nav} aria-label="部门导航">
        {VISUAL_NAV_ITEMS.map((item) => {
          const navWidthClass = item.label.length >= 3 ? styles.navWide : undefined;
          return item.href ? (
            <Link key={item.label} href={item.href} className={navWidthClass} aria-current={item.current ? "page" : undefined}>
              {item.label}
            </Link>
          ) : (
            <span className={`${styles.navDisabled} ${navWidthClass ?? ""}`} aria-disabled="true" key={item.label}>
              {item.label}
            </span>
          );
        })}
      </nav>
      <p className={styles.location}>内廷 · {currentLabel}</p>
    </header>
  );
}
