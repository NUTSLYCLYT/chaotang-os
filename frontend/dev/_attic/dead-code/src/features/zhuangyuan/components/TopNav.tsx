import Link from "next/link";
import { BrandMark, IconBell, IconHelp, IconChevronDown } from "./Glyphs";

interface NavItem {
  id: string;
  label: string;
  href: string;
}

const NAV: NavItem[] = [
  { id: "shangshufang", label: "上书房", href: "#shangshufang" },
  { id: "dadian", label: "大殿", href: "#dadian" },
  { id: "hubu", label: "户部", href: "#hubu" },
  { id: "bingbu", label: "兵部", href: "#bingbu" },
  { id: "taiyi", label: "太医", href: "#taiyi" },
  { id: "junjichu", label: "军机处", href: "#junjichu" },
  { id: "jinyiwei", label: "锦衣卫", href: "#jinyiwei" },
  { id: "shiguan", label: "史馆", href: "#shiguan" },
  { id: "zhuangyuan", label: "庄园", href: "#zhuangyuan" },
];
const ACTIVE = "zhuangyuan";

export default function TopNav() {
  return (
    <header
      className="topbar anim-drop"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1672,
        height: 56,
        zIndex: 30,
        animationDelay: "0.08s",
      }}
    >
      <div className="flex h-full items-center pl-[18px] pr-[20px]">
        {/* 品牌 */}
        <Link
          href="#zhuangyuan"
          aria-label="朝堂 OS · 首页"
          className="glow flex shrink-0 items-center gap-[10px] rounded-[8px] px-[6px] py-[4px]"
        >
          <BrandMark size={30} />
          <span className="font-serif text-[20px] font-bold tracking-[0.14em]">
            <span className="text-gold-shimmer">朝堂</span>
            <span className="text-gold-bright"> OS</span>
          </span>
        </Link>

        {/* 九部导航 */}
        <nav className="flex flex-1 items-center justify-center gap-[2px]">
          {NAV.map((n, i) => {
            const active = n.id === ACTIVE;
            return (
              <Link
                key={n.id}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`glow anim-rise relative rounded-[6px] px-[14px] py-[7px] font-serif text-[15px] tracking-[0.08em] ${
                  active ? "text-gold-bright" : "text-jade-muted hover:text-jade"
                }`}
                style={{ animationDelay: `${180 + i * 45}ms` }}
              >
                {n.label}
                {active ? (
                  <>
                    <span
                      className="absolute inset-x-[10px] -bottom-[1px] h-[2px] rounded-full bg-gold-bright"
                      style={{ boxShadow: "0 0 12px rgba(235,203,123,0.85)" }}
                    />
                    {/* 当前页：左右各一个小金点 */}
                    <span
                      aria-hidden="true"
                      className="absolute left-[2px] top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-gold-bright"
                      style={{ boxShadow: "0 0 6px rgba(235,203,123,0.9)" }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute right-[2px] top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-gold-bright"
                      style={{ boxShadow: "0 0 6px rgba(235,203,123,0.9)" }}
                    />
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* 右侧：日期 + 通知 + 帮助 + 头像 */}
        <div
          className="anim-slide-l flex shrink-0 items-center gap-[12px]"
          style={{ animationDelay: "0.42s" }}
        >
          <span className="tnum text-[12px] tracking-[0.06em] text-jade-muted">
            2026年 甲辰年 五月初八 巳时
          </span>
          <button
            type="button"
            aria-label="通知 12 条"
            className="glow relative grid h-[32px] w-[32px] place-items-center rounded-full border border-[rgba(212,168,75,0.3)] text-[16px] text-jade-muted"
          >
            <IconBell />
            <span
              className="tnum pulse-zhusha absolute -right-[3px] -top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#c8503a] px-[3px] text-[9px] font-bold text-white"
            >
              12
            </span>
          </button>
          <button
            type="button"
            aria-label="帮助"
            className="glow grid h-[32px] w-[32px] place-items-center rounded-full border border-[rgba(212,168,75,0.3)] text-[16px] text-jade-muted"
          >
            <IconHelp />
          </button>
          <button
            type="button"
            aria-label="皇上 · 账户"
            className="glow flex items-center gap-[7px] rounded-full border border-[rgba(212,168,75,0.4)] bg-[rgba(212,168,75,0.08)] py-[3px] pl-[3px] pr-[8px]"
          >
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-gradient-to-b from-[#d4a84b] to-[#8a6d2f] font-serif text-[13px] font-semibold text-[#1a1206]">
              龙
            </span>
            <span className="text-[13px] text-jade">皇上</span>
            <span className="text-[13px] text-jade-dim">
              <IconChevronDown />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
