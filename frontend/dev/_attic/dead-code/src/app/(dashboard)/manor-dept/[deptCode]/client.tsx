'use client';

/**
 * 朝堂 OS V2 · 4 核心部门详情页 — 客户端主体
 * page.tsx 负责 generateStaticParams(server); 此文件负责 UI + 数据(client)。
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';
import { chaotang } from '@/lib/api/chaotang';
import { assetUrl } from '@/lib/asset';
import type { DeptOverview } from '@/lib/contracts/dept';
import { DeptAgentDock } from '@/features/swarm/components/dept-agent-dock';
import { hasDeptAgent } from '@/lib/swarm/dept-agent-meta';
import {
  DEPT_DISPLAY,
  DEPT_STATUS_LABEL,
  DEPT_STATUS_COLOR,
  RISK_LEVEL_COLOR,
  type DeptCode,
} from '@/lib/contracts/dept';

// ─── 世界地图情报节点(锦衣卫专用) ─────────────────────────────────────────────
// 坐标按等距柱状投影换算(equirectangular):
//   x% = (lon + 180) / 360 * 100
//   y% = (90 - lat) / 180 * 100
const INTEL_NODES = [
  { id: 'beijing',   label: '北京',    x: '82.3%', y: '27.8%', pulse: true  }, // 116.4°E 39.9°N
  { id: 'tokyo',     label: '东京',    x: '88.8%', y: '30.2%', pulse: true  }, // 139.7°E 35.7°N
  { id: 'singapore', label: '新加坡',  x: '78.8%', y: '49.2%', pulse: true  }, // 103.8°E  1.4°N
  { id: 'dubai',     label: '迪拜',    x: '65.4%', y: '36.0%', pulse: false }, // 55.3°E  25.2°N
  { id: 'frankfurt', label: '法兰克福',x: '52.4%', y: '22.2%', pulse: false }, // 8.7°E   50.1°N
  { id: 'london',    label: '伦敦',    x: '50.0%', y: '21.4%', pulse: false }, // -0.1°W  51.5°N
  { id: 'washington',label: '华盛顿',  x: '28.6%', y: '28.4%', pulse: true  }, // -77°W   38.9°N
  { id: 'newyork',   label: '纽约',    x: '29.4%', y: '27.4%', pulse: false }, // -74°W   40.7°N
] as const;

// ─── 世界地图背景(锦衣卫专用)
// 使用 public/world-map.svg(等距柱状投影大陆轮廓,无需 API key)铺满中栏
// 大陆 fill 暗蓝 #1a2535, 描边 #2a4060,叠上橙色雷达环+扫描弧
function WorldMapBg({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 深色底 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, #070d15 0%, #060a10 60%, #08101a 100%)' }}
      />

      {/* 世界地图 SVG — 大陆轮廓,铺满整个中栏 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl('/world-map.svg')}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: 'fill', opacity: 0.9 }}
      />

      {/* 蓝色海洋光晕叠层 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 85% 70% at 50% 50%, rgba(20,50,90,0.35) 0%, transparent 70%)' }}
      />

      {/* 雷达扫描圈:以亚太为中心叠加橙色同心椭圆 */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        {/* 同心椭圆 — 大中小三圈 */}
        <ellipse cx="78" cy="30" rx="14" ry="14" fill="none" stroke={color} strokeWidth="0.25" opacity="0.30" />
        <ellipse cx="78" cy="30" rx="24" ry="20" fill="none" stroke={color} strokeWidth="0.20" opacity="0.18" />
        <ellipse cx="78" cy="30" rx="36" ry="30" fill="none" stroke={color} strokeWidth="0.15" opacity="0.10" />
        {/* 中心十字准星 */}
        <line x1="78" y1="22" x2="78" y2="38" stroke={color} strokeWidth="0.3" opacity="0.35" />
        <line x1="70" y1="30" x2="86" y2="30" stroke={color} strokeWidth="0.3" opacity="0.35" />
        {/* 华盛顿第二中心 */}
        <circle cx="28.6" cy="28.4" r="6" fill="none" stroke={color} strokeWidth="0.2" opacity="0.20" />
        {/* 伦敦-法兰克福欧洲圈 */}
        <circle cx="51" cy="22" r="5" fill="none" stroke={color} strokeWidth="0.2" opacity="0.18" />
      </svg>

      {/* 旋转扫描弧(CSS spin,以亚太区为圆心) */}
      <div
        className="absolute rounded-full"
        style={{
          width: '30%',
          height: '60%',
          top: '8%',
          left: '63%',
          border: `1px solid ${color}20`,
          borderTopColor: `${color}80`,
          borderRightColor: `${color}40`,
          animation: 'spin 6s linear infinite',
        }}
      />
    </div>
  );
}

// ─── 情报节点 ─────────────────────────────────────────────────────────────────
function IntelNode({ node, color }: { node: typeof INTEL_NODES[number]; color: string }) {
  return (
    <div
      className="absolute"
      style={{ left: node.x, top: node.y, transform: 'translate(-50%,-50%)', zIndex: 2 }}
    >
      {node.pulse && (
        <div
          className="absolute rounded-full animate-ping"
          style={{ width: 18, height: 18, top: -5, left: -5, background: `${color}18`, border: `1px solid ${color}55` }}
        />
      )}
      <div
        className="relative h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}60` }}
      />
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-medium"
        style={{ color, background: 'rgba(6,10,15,0.8)' }}
      >
        {node.label}
      </div>
    </div>
  );
}

// ─── 情报节点连线 SVG ─────────────────────────────────────────────────────────
function ConnectionLines({ color }: { color: string }) {
  const pairs: [string, string, string, string][] = [
    ['72%', '32%', '82%', '35%'],
    ['72%', '32%', '60%', '42%'],
    ['46%', '28%', '50%', '28%'],
    ['22%', '35%', '46%', '28%'],
    ['76%', '50%', '60%', '42%'],
    ['72%', '32%', '76%', '50%'],
  ];
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ zIndex: 1 }}>
      {pairs.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth="0.7"
          strokeOpacity="0.4"
          strokeDasharray="4 5"
        />
      ))}
    </svg>
  );
}

// ─── 左栏 ─────────────────────────────────────────────────────────────────────
function LeftPanel({
  overview,
  deptDisplay,
}: {
  overview: DeptOverview | null;
  deptDisplay: typeof DEPT_DISPLAY['guard'];
}) {
  const color = deptDisplay.color;
  const metrics = overview?.keyMetrics ?? [];
  const tasks = overview?.activeTasks ?? [];

  return (
    <div className="flex h-full flex-col gap-4 py-4 pl-5 pr-3">
      {/* 部门标识 */}
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${color}, ${color}60)`,
            boxShadow: `0 0 12px ${color}50`,
          }}
        >
          {deptDisplay.emoji}
        </span>
        <div>
          <div className="font-serif text-[16px] font-bold text-[#F5E9C9]">{deptDisplay.nameCn}</div>
          <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color }}>{deptDisplay.nameEn}</div>
        </div>
      </div>

      {/* 部门状态 */}
      {overview && (
        <div
          className="rounded-xl border px-3 py-2"
          style={{ borderColor: `${DEPT_STATUS_COLOR[overview.status]}44`, background: `${DEPT_STATUS_COLOR[overview.status]}0a` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8F835F]">当前状态</span>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: `${DEPT_STATUS_COLOR[overview.status]}22`, color: DEPT_STATUS_COLOR[overview.status] }}
            >
              {DEPT_STATUS_LABEL[overview.status]}
            </span>
          </div>
          {overview.minister && (
            <div className="mt-1.5 text-[10px] text-[#C8CDD8]">{overview.minister.name} · {overview.minister.role}</div>
          )}
        </div>
      )}

      {/* 关键指标 */}
      <div>
        <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">
          {deptDisplay.nameCn === '锦衣卫' ? '主要监察对象' : '关键指标'}
          {metrics.length === 0 && <span className="ml-2 text-[#F0C66A]">演示数据</span>}
        </div>
        {metrics.length > 0 ? (
          <div className="space-y-2">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-baseline justify-between">
                <span className="text-[10px] text-[#8F835F]">{m.label}</span>
                <span className="font-mono text-[14px] font-bold" style={{ color }}>
                  {m.value}
                  {m.unit && <span className="ml-0.5 text-[9px] text-[#6A7299]">{m.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[#6A7299]">—</div>
        )}
      </div>

      {/* 进行中任务 */}
      {tasks.length > 0 && (
        <div>
          <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">进行中任务</div>
          <div className="space-y-1.5">
            {tasks.slice(0, 4).map((t) => (
              <div key={t.taskId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="line-clamp-1 flex-1 text-[10px] text-[#C8CDD8]">{t.title}</span>
                  <span className="font-mono text-[10px]" style={{ color }}>{t.progressPct}%</span>
                </div>
                <div className="mt-1 h-0.5 rounded-full bg-white/[0.06]">
                  <div className="h-0.5 rounded-full" style={{ width: `${t.progressPct}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 导航 */}
      <div className="mt-auto space-y-1.5">
        <Link
          href="/manors"
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[10px] text-[#C8CDD8] transition hover:border-[#F0C66A]/25 hover:text-[#F0C66A]"
        >
          ← 回庄园地图
        </Link>
        <Link
          href="/manors"
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[10px] text-[#C8CDD8] transition hover:border-white/15"
        >
          ← 六部大厅
        </Link>
      </div>
    </div>
  );
}

// ─── 右栏 ─────────────────────────────────────────────────────────────────────
const OTHER_DEPT_LINKS = [
  { code: 'finance',   nameCn: '户部',   emoji: '💰' },
  { code: 'legal',     nameCn: '刑部',   emoji: '⚖️' },
  { code: 'market',    nameCn: '礼部',   emoji: '🎨' },
  { code: 'guard',     nameCn: '锦衣卫', emoji: '🛰' },
  { code: 'ops',       nameCn: '兵部',   emoji: '⚔️' },
  { code: 'physician', nameCn: '太医院', emoji: '🩺' },
];

function RightPanel({
  overview,
  deptDisplay,
}: {
  overview: DeptOverview | null;
  deptDisplay: typeof DEPT_DISPLAY['guard'];
}) {
  const color = deptDisplay.color;
  const risks = overview?.risks ?? [];
  const memorials = overview?.recentMemorials ?? [];

  const riskCounts = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.level] = (acc[r.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col gap-4 py-4 pl-3 pr-5">
      {/* 风险统计三格 */}
      <div>
        <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">风险预警</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['critical', 'high', 'medium'] as const).map((level) => {
            const c = RISK_LEVEL_COLOR[level];
            const cnt = riskCounts[level] ?? 0;
            const labels = { critical: '严重', high: '高危', medium: '中危' };
            return (
              <div key={level} className="rounded-xl border py-2 text-center" style={{ borderColor: `${c}44`, background: `${c}0a` }}>
                <div className="font-mono text-[20px] font-bold" style={{ color: c }}>{cnt}</div>
                <div className="text-[8px]" style={{ color: c }}>{labels[level]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 奏折/情报事件列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mb-2 border-b border-white/[0.06] pb-1.5 text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">
          {deptDisplay.nameCn === '锦衣卫' ? '异常事件 / 情报' : '近期奏折'}
        </div>
        {memorials.length > 0 ? (
          <div className="space-y-2">
            {memorials.map((m) => {
              // F-5: 后端产 urgent/high/normal/low,normal 对齐金色
              const priorityColor: Record<string, string> = {
                urgent: '#F43F5E', high: '#FB923C', normal: '#F0C66A', medium: '#F0C66A', low: '#6A7299',
              };
              // F-4: memorial status 中文映射
              const statusLabel: Record<string, string> = {
                approved: '已批', pending: '待批', running: '进行中',
              };
              const pc = priorityColor[m.priority] ?? '#6A7299';
              return (
                <div
                  key={m.id}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ borderColor: `${pc}33`, background: `${pc}08` }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex-1">
                      <div className="text-[10px] font-semibold leading-5 text-[#F5E9C9]">{m.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-[#8F835F]">{m.summary}</div>
                    </div>
                    <span
                      className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold"
                      style={{ background: `${pc}22`, color: pc }}
                    >
                      {statusLabel[m.status] ?? m.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : overview ? (
          <div className="py-4 text-center text-[10px] text-[#6A7299]">暂无近期事件</div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            ))}
          </div>
        )}
      </div>

      {/* 风险明细 */}
      {risks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">
            <AlertTriangle size={9} className="text-[#F43F5E]" />
            风险明细
          </div>
          <div className="space-y-1">
            {risks.slice(0, 6).map((r, i) => {
              const rc = RISK_LEVEL_COLOR[r.level];
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: `${rc}33`, background: `${rc}08` }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: rc }} />
                  <span className="flex-1 text-[10px] text-[#C8CDD8]">{r.label}</span>
                  <span className="shrink-0 rounded px-1 text-[8px] font-bold uppercase" style={{ background: `${rc}22`, color: rc }}>
                    {r.level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 其他部门跳转 */}
      <div className="border-t border-white/[0.06] pt-2">
        <div className="mb-1.5 text-[9px] text-[#6A7299]">其他核心部门</div>
        <div className="grid grid-cols-3 gap-1">
          {OTHER_DEPT_LINKS.filter((d) => d.code !== deptDisplay.nameEn.toLowerCase().replace(' ', '_')).slice(0, 3).map((d) => (
            <Link
              key={d.code}
              href={`/manor-dept/${d.code}`}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 transition hover:border-[#F0C66A]/20"
            >
              <span className="text-[12px]">{d.emoji}</span>
              <span className="text-[8px] text-[#6A7299]">{d.nameCn}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 锦衣卫世界地图中心:视觉核心占满中栏 ────────────────────────────────────
function GuardMapCenter({
  overview,
  deptDisplay,
}: {
  overview: DeptOverview | null;
  deptDisplay: typeof DEPT_DISPLAY['guard'];
}) {
  const color = deptDisplay.color;
  return (
    <div className="relative h-full w-full">
      {/* 世界地图背景(含经纬网格 + 雷达环) */}
      <WorldMapBg color={color} />
      {/* 节点连线 */}
      <ConnectionLines color={color} />
      {/* 情报热点节点 */}
      {INTEL_NODES.map((node) => (
        <IntelNode key={node.id} node={node} color={color} />
      ))}
      {/* 标题栏(悬浮在中上) */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-5 text-center">
        <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color }}>
          Imperial Guard · 全球情报雷达
        </div>
        <h1 className="mt-1 font-serif text-[22px] font-bold text-[#F5E9C9]" style={{ textShadow: `0 0 24px ${color}70` }}>
          锦衣卫
        </h1>
        <div className="mt-0.5 text-[11px] text-[#8F835F]">全球监察与情报聚合</div>
      </div>
      {/* 底部四面板 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 grid grid-cols-4 gap-0 border-t border-white/[0.06]">
        {[
          { label: '监察区分析', icon: '🔍' },
          { label: '实时动态',   icon: '📡' },
          { label: '情报汇聚点', icon: '🌐' },
          { label: '舆情监控',   icon: '📊' },
        ].map((panel) => (
          <div
            key={panel.label}
            className="flex flex-col items-center gap-1 border-r border-white/[0.06] py-2.5 last:border-r-0"
            style={{ background: 'rgba(6,10,15,0.75)' }}
          >
            <span className="text-[14px]">{panel.icon}</span>
            <span className="text-[8px]" style={{ color }}>{panel.label}</span>
          </div>
        ))}
      </div>
      {/* 加载中 */}
      {!overview && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-[11px] text-[#6A7299]">情报载入中…</div>
        </div>
      )}
    </div>
  );
}

const DEPT_BG_IMAGE: Partial<Record<DeptCode, string>> = {
  legal: '/prd/xingbu.webp',
};

// ─── 通用部门中心(户部/刑部/礼部) ─────────────────────────────────────────────
function GenericDeptCenter({
  overview,
  deptDisplay,
  code,
}: {
  overview: DeptOverview | null;
  deptDisplay: typeof DEPT_DISPLAY['finance'];
  code: DeptCode;
}) {
  const color = deptDisplay.color;
  const metrics = overview?.keyMetrics ?? [];
  const bgImage = DEPT_BG_IMAGE[code];

  return (
    <div className="relative flex h-full flex-col">
      {bgImage && (
        <img
          src={assetUrl(bgImage)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${color}08 0%, transparent 70%), linear-gradient(160deg, ${bgImage ? 'rgba(13,10,5,0.45) 0%, rgba(17,12,3,0.55) 100%' : '#0D0A05 0%, #110C03 100%'})`,
        }}
      />
      {/* 装饰网格 */}
      <div className="absolute inset-0 opacity-[0.04]">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[15, 30, 45, 60, 75, 90].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke={color} strokeWidth="0.3" />
          ))}
          {[15, 30, 45, 60, 75, 90].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke={color} strokeWidth="0.3" />
          ))}
        </svg>
      </div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 text-[36px]"
          style={{
            borderColor: `${color}60`,
            background: `radial-gradient(circle at 35% 35%, ${color}22, transparent)`,
            boxShadow: `0 0 30px ${color}30, inset 0 0 20px ${color}10`,
          }}
        >
          {deptDisplay.emoji}
        </div>
        <h1 className="mt-4 font-serif text-[26px] font-bold text-[#F5E9C9]">{deptDisplay.nameCn}</h1>
        <div className="mt-0.5 text-[11px] uppercase tracking-[0.24em]" style={{ color }}>{deptDisplay.nameEn}</div>
        {metrics.length > 0 && (
          <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
            {metrics.slice(0, 4).map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border px-4 py-3 text-center"
                style={{ borderColor: `${color}33`, background: `${color}0a` }}
              >
                <div className="font-mono text-[24px] font-bold" style={{ color }}>{m.value}</div>
                <div className="mt-0.5 text-[10px] text-[#8F835F]">{m.label}{m.unit ? ` (${m.unit})` : ''}</div>
              </div>
            ))}
          </div>
        )}
        {!overview && <div className="mt-8 text-[11px] text-[#6A7299]">数据载入中…</div>}
      </div>
    </div>
  );
}

// ─── 主客户端组件 ──────────────────────────────────────────────────────────────
export default function ManorDeptClient({ deptCode }: { deptCode: string }) {
  const code = deptCode as DeptCode;
  const deptDisplay = DEPT_DISPLAY[code];

  const [overview, setOverview] = useState<DeptOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    chaotang
      .deptOverview(code)
      .then(setOverview)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '部门数据加载失败');
      });
  }, [code]);

  useEffect(() => { loadData(); }, [loadData]);

  const isGuard = code === 'guard';
  const showAgentDock = hasDeptAgent(code); // 该部门已配置单 agent → 挂底部问责坞

  return (
    <div className="relative h-full overflow-hidden" style={{ background: '#060A0F' }}>
      {/* 错误条 */}
      {error && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2 text-[11px]"
          style={{ background: 'rgba(244,63,94,0.15)', borderBottom: '1px solid rgba(244,63,94,0.3)' }}
        >
          <span className="text-[#F43F5E]">{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-[#EAEEFB] hover:bg-white/5"
          >
            重试
          </button>
        </div>
      )}

      {/* 三栏主体 */}
      <div className="flex h-full">
        <div
          className="w-[200px] shrink-0 overflow-y-auto border-r"
          style={{ borderColor: `${deptDisplay.color}22`, background: 'rgba(6,10,15,0.85)' }}
        >
          <LeftPanel overview={overview} deptDisplay={deptDisplay} />
        </div>

        <div className="relative flex-1">
          {isGuard ? (
            <GuardMapCenter overview={overview} deptDisplay={deptDisplay} />
          ) : (
            <GenericDeptCenter overview={overview} deptDisplay={deptDisplay} code={code} />
          )}
        </div>

        <div
          className="w-[220px] shrink-0 overflow-y-auto border-l"
          style={{ borderColor: `${deptDisplay.color}22`, background: 'rgba(6,10,15,0.85)' }}
        >
          <RightPanel overview={overview} deptDisplay={deptDisplay} />
        </div>
      </div>

      {/* 底部状态栏（挂了问责坞的部门改用坞，不再叠状态栏，避免遮挡） */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-2 text-[10px]"
        style={{
          background: 'rgba(6,10,15,0.9)',
          borderTop: `1px solid ${deptDisplay.color}22`,
          display: showAgentDock ? 'none' : undefined,
        }}
      >
        <div className="flex items-center gap-3 text-[#6A7299]">
          <span style={{ color: deptDisplay.color }}>{deptDisplay.emoji} {deptDisplay.nameCn}</span>
          {overview && (
            <span style={{ color: DEPT_STATUS_COLOR[overview.status] }}>
              {DEPT_STATUS_LABEL[overview.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[#6A7299]">
          {overview && (
            <>
              <span>{overview.recentMemorials.length} 近期奏折</span>
              <span>{overview.activeTasks.length} 进行任务</span>
            </>
          )}
          <Link href="/command-center" className="transition" style={{ color: deptDisplay.color }}>
            发起任务 →
          </Link>
        </div>
      </div>

      {/* 部门问责坞（仅 dept-agent-meta 注册的部门） */}
      {showAgentDock && <DeptAgentDock code={code} />}
    </div>
  );
}
