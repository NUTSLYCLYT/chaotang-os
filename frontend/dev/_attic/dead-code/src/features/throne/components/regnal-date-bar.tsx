'use client';

/**
 * 朝堂 OS · 年号时辰栏
 *
 * 顶部一行："启元元年 · 三月廿一 · 酉时"
 * 右侧小字显示现代时间，点击 toggle 主次。
 *
 * 让每页都有仪式感，是"这不是 dashboard"的第一条视觉证据。
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const SHICHEN = [
  '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
  '午时', '未时', '申时', '酉时', '戌时', '亥时',
];

const ERA_NAME = '启元';
const ERA_EPOCH_YEAR = 2026;

function toChineseNumeral(n: number): string {
  const cn = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n === 0) return '〇';
  if (n < 10) return cn[n]!;
  if (n < 20) return '十' + (n === 10 ? '' : cn[n - 10]!);
  if (n < 30) return '廿' + (n === 20 ? '' : cn[n - 20]!);
  return '卅' + (n === 30 ? '' : cn[n - 30]!);
}

function shichenOf(hour: number): string {
  const idx = Math.floor(((hour + 1) % 24) / 2);
  return SHICHEN[idx] ?? '子时';
}

function stemBranchYear(year: number): string {
  const base = year - 4;
  const stem = HEAVENLY_STEMS[base % 10];
  const branch = EARTHLY_BRANCHES[base % 12];
  return `${stem}${branch}`;
}

export function RegnalDateBar({ className = '' }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [modernFirst, setModernFirst] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    return (
      <div className={`h-[18px] ${className}`} aria-hidden />
    );
  }

  const regnalYearNum = now.getFullYear() - ERA_EPOCH_YEAR + 1;
  const regnalYear = regnalYearNum === 1 ? '元' : toChineseNumeral(regnalYearNum);
  const stemBranch = stemBranchYear(now.getFullYear());
  const month = LUNAR_MONTHS[now.getMonth()] ?? '正';
  const day = toChineseNumeral(now.getDate());
  const hour = shichenOf(now.getHours());

  const ceremonial = `${ERA_NAME}${regnalYear}年 · ${stemBranch} · ${month}月${day} · ${hour}`;
  const modern = now.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      type="button"
      onClick={() => setModernFirst((v) => !v)}
      className={`group flex items-center gap-2 text-left transition-colors ${className}`}
      aria-label="切换年号/公历时间"
    >
      <Clock size={11} className="text-[#8F835F] group-hover:text-[#F0C66A]" />
      <span
        className="display-serif tracking-[0.18em]"
        style={{
          fontSize: 11,
          color: modernFirst ? '#6A7299' : '#F0C66A',
        }}
      >
        {modernFirst ? modern : ceremonial}
      </span>
      <span
        className="tracking-[0.22em]"
        style={{
          fontSize: 11,
          color: modernFirst ? '#F0C66A' : '#6A7299',
          textTransform: 'uppercase',
        }}
      >
        {modernFirst ? ceremonial : modern}
      </span>
    </button>
  );
}
