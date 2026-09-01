import Link from "next/link";

import { LogoutButton } from "./LogoutButton";
import styles from "./ChaotangHeader.module.css";

type VisualNavItem = {
  label: string;
  href: "/dadian" | "/study" | "/junjichu" | "/liubu" | "/zhuanshu" | "/honglusi" | "/shiguan";
};

const VISUAL_NAV_ITEMS: readonly VisualNavItem[] = [
  { label: "大殿", href: "/dadian" },
  { label: "上书房", href: "/study" },
  { label: "军机处", href: "/junjichu" },
  { label: "六部", href: "/liubu" },
  { label: "专署", href: "/zhuanshu" },
  { label: "鸿胪寺", href: "/honglusi" },
  { label: "史馆", href: "/shiguan" },
] as const;

function HeaderIcon({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button className={styles.iconButton} type="button" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export function ChaotangHeader({ currentLabel, currentPath = "/study" }: { currentLabel: string; currentPath?: string }) {
  return (
    <header
      className={styles.header}
      data-three-axis-topnav
      aria-label="朝堂主导航"
      title={currentLabel}
    >
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
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <Link key={item.label} href={item.href} className={navWidthClass} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.utilities} aria-label="当前朝堂视角">
        <span className={styles.date}>
          <span>甲申年 · 五月初八</span>
          <time>辰时</time>
        </span>
        <button className={`${styles.utilityChip} ${styles.capability}`} type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 19 6v5c0 4.7-2.7 7.8-7 10-4.3-2.2-7-5.3-7-10V6l7-3Z" />
            <path d="m9 12 2 2 4-5" />
          </svg>
          能力边界
        </button>
        <span className={styles.audiences}>
          <Link className={styles.utilityChip} href="/study">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20V9l8-5 8 5v11M9 20v-5h6v5M7 11h.01M17 11h.01" />
            </svg>
            企业家
          </Link>
          <Link className={styles.utilityChip} href="/study?audience=ai_enthusiast">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3M9 4v14M15 4v14M9 8h6M9 14h6" />
            </svg>
            AI爱好者
          </Link>
          <Link className={styles.utilityChip} href="/study?audience=ai_geek">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="7" width="14" height="11" rx="2" />
              <path d="M9 3v4M15 3v4M8 12h.01M16 12h.01M9 16h6" />
            </svg>
            AI极客
          </Link>
        </span>
        <HeaderIcon label="通知">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </HeaderIcon>
        <HeaderIcon label="帮助 · 钦天监导师">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
        </HeaderIcon>
        <button className={styles.emperor} type="button" aria-label="皇上" title="皇上">
          皇
        </button>
        <LogoutButton className={styles.logoutButton} />
      </div>
    </header>
  );
}
