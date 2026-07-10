'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Image as ImageIcon, X } from 'lucide-react';

import { assetUrl } from '@/lib/asset';

type ResourceItem = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  href?: string;
  tag: string;
};

const PRD_RESOURCES: ResourceItem[] = [
  { id: 'prd-shangshufang', title: '上书房', subtitle: '最终入口 · 御前下旨与问策', src: '/prd/01-shangshufang.webp', href: '/shangshufang', tag: '主入口' },
  { id: 'prd-dadian', title: '大殿', subtitle: '经营总览与中枢态势', src: '/prd/02-dadian.webp', href: '/dadian', tag: '总览' },
  { id: 'prd-zhuangyuan', title: '庄园', subtitle: '业务域与增长资产', src: '/prd/03-zhuangyuan.webp', href: '/zhuanshu', tag: '业务' },
  { id: 'prd-shiguan', title: '史馆', subtitle: '归档、复盘、长期记忆', src: '/prd/04-shiguan.webp', href: '/shiguan', tag: '复盘' },
  { id: 'prd-junjichu', title: '军机处', subtitle: '任务拆解与群臣会审', src: '/prd/05-junjichu.webp', href: '/junjichu', tag: '执行' },
  { id: 'prd-jinyiwei', title: '锦衣卫', subtitle: '情报、竞品、风险侦察', src: '/prd/06-jinyiwei.webp', href: '/zhuanshu/jinyiwei', tag: '情报' },
  { id: 'prd-hubu', title: '户部', subtitle: '预算、现金流与经营测算', src: '/prd/07-hubu.webp', href: '/liubu/hubu', tag: '财务' },
  { id: 'prd-bingbu', title: '兵部', subtitle: '运营、市场与战役调度', src: '/prd/08-bingbu.webp', href: '/liubu/bingbu', tag: '运营' },
  { id: 'prd-taiyi', title: '太医院', subtitle: '系统健康与诊断', src: '/prd/09-taiyi.webp', href: '/liubu', tag: '健康' },
];

const SCENE_RESOURCES: ResourceItem[] = [
  { id: 'scene-shangshufang', title: '上书房全景', subtitle: '主场景背景原画', src: '/shangshufang/bg-shangshufang-full.webp', href: '/shangshufang', tag: '场景' },
  { id: 'scene-dadian', title: '大殿舞台', subtitle: '朝堂总览视觉资产', src: '/assets/dadian/hall-stage-tang.webp', href: '/dadian', tag: '场景' },
  { id: 'scene-junjichu', title: '军机处战情室', subtitle: '会审与执行场景', src: '/assets/junjichu/war-room-full.webp', href: '/junjichu', tag: '场景' },
  { id: 'scene-hubu', title: '户部账房', subtitle: '预算与现金流场景', src: '/assets/hubu/scene-full.webp', href: '/liubu/hubu', tag: '场景' },
  { id: 'scene-gongbu', title: '工部营造', subtitle: '项目与工程场景', src: '/assets/gongbu/gongbu.webp', href: '/liubu/gongbu', tag: '场景' },
  { id: 'scene-bingbu', title: '兵部沙盘', subtitle: '运营战役场景', src: '/assets/bingbu/scene-full.webp', href: '/liubu/bingbu', tag: '场景' },
  { id: 'scene-jinyiwei', title: '锦衣卫密探', subtitle: '情报风险场景', src: '/assets/jinyiwei/scene-full.webp', href: '/zhuanshu/jinyiwei', tag: '场景' },
  { id: 'scene-taiyi', title: '太医院诊断', subtitle: '系统健康场景', src: '/assets/taiyi/scene-full.webp', href: '/liubu', tag: '场景' },
  { id: 'scene-shiguan', title: '史馆卷宗', subtitle: '复盘与归档视觉资产', src: '/assets/shiguan/shiguan.webp', href: '/shiguan', tag: '场景' },
];

const HERO_RESOURCES: ResourceItem[] = [
  { id: 'hero-zhuge', title: '诸葛亮', subtitle: '丞相辅政形象', src: '/heroes/v4-1-zhuge.webp', tag: '人物' },
  { id: 'hero-baozheng', title: '包拯', subtitle: '法度审查形象', src: '/heroes/v4-2-baozheng.webp', tag: '人物' },
  { id: 'hero-weizheng', title: '魏征', subtitle: '谏议与风控形象', src: '/heroes/v4-3-weizheng.webp', tag: '人物' },
  { id: 'hero-suqin', title: '苏秦', subtitle: '纵横市场形象', src: '/heroes/v4-4-suqin.webp', tag: '人物' },
  { id: 'hero-qijiguang', title: '戚继光', subtitle: '战役执行形象', src: '/heroes/v4-5-qijiguang.webp', tag: '人物' },
  { id: 'hero-ouyang', title: '欧阳修', subtitle: '史馆复盘形象', src: '/heroes/v4-6-ouyang.webp', tag: '人物' },
  { id: 'hero-simaqian', title: '司马迁', subtitle: '史馆秉笔形象', src: '/heroes/v4-shiguan-simaqian.webp', tag: '人物' },
  { id: 'hero-throne', title: '御座', subtitle: '朝堂主视觉', src: '/heroes/v4-7-throne.webp', tag: '人物' },
  { id: 'hero-ministers', title: '群臣', subtitle: '多智能体会审形象', src: '/heroes/v4-8-ministers.webp', tag: '人物' },
  { id: 'hero-zhangliang', title: '张良', subtitle: '群臣会议谋圣形象', src: '/heroes/v4-grand-council-zhangliang.webp', tag: '人物' },
];

const GROUPS = [
  { key: 'prd', title: '九司总览', items: PRD_RESOURCES },
  { key: 'scene', title: '场景全景', items: SCENE_RESOURCES },
  { key: 'hero', title: '人物资料', items: HERO_RESOURCES },
] as const;

export function ResourceGallery({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState(PRD_RESOURCES[0]!.id);
  const allItems = useMemo(() => GROUPS.flatMap((group) => group.items), []);
  const active = allItems.find((item) => item.id === activeId) ?? allItems[0]!;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-3 md:p-5" role="dialog" aria-modal="true" aria-label="朝堂资源阁">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative grid h-[min(860px,92vh)] w-full max-w-[1280px] overflow-hidden rounded-2xl lg:grid-cols-[360px_1fr]"
        style={{
          background: 'linear-gradient(180deg, rgba(12,16,34,0.98), rgba(5,8,18,0.99))',
          border: '1px solid rgba(240,198,106,0.32)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.68), inset 0 1px 0 rgba(240,198,106,0.08)',
        }}
      >
        <aside className="flex min-h-0 flex-col border-b border-[#F0C66A]/15 lg:border-b-0 lg:border-r">
          <header className="flex items-start justify-between gap-3 px-4 py-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">COURT ASSETS</div>
              <h2 className="mt-1 text-[18px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                朝堂资源阁
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-[#9AA3C4]">
                已整合产品图、部门场景、人物资料；点击预览，进入对应模块。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#9AA3C4] transition hover:bg-white/10 hover:text-[#F0C66A]"
              aria-label="关闭资源阁"
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {GROUPS.map((group) => (
              <section key={group.key} className="mt-3 first:mt-0">
                <div className="mb-2 px-1 text-[11px] font-semibold tracking-[0.18em] text-[#8F835F]">{group.title}</div>
                <div className="grid gap-2">
                  {group.items.map((item) => {
                    const activeItem = item.id === active.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className="grid grid-cols-[78px_1fr] items-center gap-3 rounded-xl border p-2 text-left transition"
                        style={{
                          borderColor: activeItem ? 'rgba(240,198,106,0.55)' : 'rgba(255,255,255,0.08)',
                          background: activeItem ? 'rgba(240,198,106,0.08)' : 'rgba(255,255,255,0.025)',
                        }}
                      >
                        <span className="relative block aspect-[16/10] overflow-hidden rounded-lg bg-black/30">
                          <img src={assetUrl(item.src)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-[#EAEEFB]">{item.title}</span>
                            <span className="rounded border border-[#F0C66A]/25 px-1.5 py-0.5 text-[9px] text-[#F0C66A]/80">{item.tag}</span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-[#9AA3C4]">{item.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[#F0C66A]/15 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-[#F0C66A]">
                <ImageIcon size={13} />
                <span className="tracking-[0.14em]">{active.tag}</span>
              </div>
              <h3 className="mt-1 truncate text-[17px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                {active.title}
              </h3>
              <p className="text-[12px] text-[#9AA3C4]">{active.subtitle}</p>
            </div>
            {active.href ? (
              <Link
                href={active.href}
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#FFE09A] to-[#F0C66A] px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.04em] text-[#1B1306] shadow-[0_4px_18px_rgba(240,198,106,0.28)] transition hover:brightness-110"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                <ExternalLink size={13} />
                进入
              </Link>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-black/30 p-3 md:p-5">
            <div className="flex min-h-full items-center justify-center">
              <img
                src={assetUrl(active.src)}
                alt={`${active.title} · ${active.subtitle}`}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                style={{ border: '1px solid rgba(240,198,106,0.18)' }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
