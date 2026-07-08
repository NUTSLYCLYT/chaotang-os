/**
 * 朝堂 OS V2 · 部门代言人 · 经典卡牌（右上悬挂）
 *
 * 炉石 / 三国杀 / 永劫无间 卡牌美学：
 *   - 3:4 竖版 · 金色镶边 · 顶部云纹 · 底部玉牌名号
 *   - 右上悬挂式放置，不占主内容位置
 *   - 人物真人图 · 年代战绩徽章 · hover 放大 1.02
 */

'use client';

import { useState } from 'react';
import { assetUrl } from '@/lib/asset';

export interface DeptHeroCardProps {
  heroImage: string;
  heroAlt: string;
  tag: string;
  accent: string;
  title: string;
  meta: string;
  metric: { label: string; value: string };
  personaName: string;
  personaEra: string;
  hookHtml: string;
  /** 控制图像裁剪位置，横幅图可指定 'right center' 等让人物居中 */
  imageObjectPosition?: string;
}

export function DeptHeroCard({
  heroImage,
  heroAlt,
  tag,
  accent,
  title,
  meta,
  metric,
  personaName,
  personaEra,
  hookHtml,
  imageObjectPosition = 'center top',
}: DeptHeroCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative inline-block w-[240px] shrink-0 select-none transition-transform duration-300"
      style={{
        transform: hovered ? 'translateY(-4px) scale(1.015)' : 'translateY(0) scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 外发光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[14px] blur-[10px] transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, ${accent}55, transparent 75%)`,
          opacity: hovered ? 0.75 : 0.35,
        }}
      />

      {/* 卡牌主体 · 3:4 */}
      <div
        className="relative overflow-hidden rounded-[10px] border-2"
        style={{
          aspectRatio: '3/4',
          borderColor: accent,
          background: 'linear-gradient(180deg, #1c160a 0%, #0a0704 100%)',
          boxShadow: `0 8px 28px rgba(0,0,0,0.6), inset 0 0 0 1px ${accent}aa, inset 0 0 12px ${accent}22`,
        }}
      >
        {/* 顶部金色云纹带 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[6px]"
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}bb 50%, ${accent} 100%)`,
            boxShadow: `0 1px 4px ${accent}88`,
          }}
        />

        {/* 四角金角装饰 */}
        {[
          'top-2 left-2 border-l-2 border-t-2',
          'top-2 right-2 border-r-2 border-t-2',
          'bottom-14 left-2 border-l-2 border-b-2',
          'bottom-14 right-2 border-r-2 border-b-2',
        ].map((cls, i) => (
          <span
            key={i}
            aria-hidden
            className={`pointer-events-none absolute z-20 h-3 w-3 ${cls}`}
            style={{ borderColor: accent, opacity: 0.9 }}
          />
        ))}

        {/* 人物图 · 60% 占位 */}
        <div className="relative h-[60%] w-full overflow-hidden">
          <img
            src={assetUrl(heroImage)}
            alt={heroAlt}
            loading="eager"
            className="h-full w-full object-cover"
            style={{
              objectPosition: imageObjectPosition,
              transform: hovered ? 'scale(1.03)' : 'scale(1)',
              transition: 'transform 0.4s ease-out',
            }}
          />
          {/* 下沿暗色过渡 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, transparent 55%, rgba(28,22,10,0.6) 85%, rgba(10,7,4,0.95) 100%)',
            }}
          />
          {/* 左上 tag */}
          <div
            className="absolute left-2 top-3 z-10 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md"
            style={{
              background: 'rgba(10,7,4,0.8)',
              border: `0.5px solid ${accent}88`,
              color: accent,
            }}
          >
            {tag.split(' · ')[0]}
          </div>
          {/* 右上 metric */}
          <div
            className="absolute right-2 top-3 z-10 rounded-md px-2 py-1 backdrop-blur-md"
            style={{
              background: `linear-gradient(135deg, ${accent}44, rgba(10,7,4,0.85))`,
              border: `1px solid ${accent}`,
            }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: accent }}
            >
              {metric.label}
            </div>
            <div
              className="-mt-0.5 text-center font-mono text-[18px] font-black leading-none"
              style={{ color: '#F5E9C9', textShadow: `0 0 6px ${accent}` }}
            >
              {metric.value}
            </div>
          </div>
        </div>

        {/* 分隔金带 */}
        <div
          aria-hidden
          className="absolute inset-x-0 h-[4px]"
          style={{
            top: '60%',
            background: `linear-gradient(90deg, transparent 5%, ${accent} 25%, ${accent} 75%, transparent 95%)`,
            boxShadow: `0 0 6px ${accent}66`,
          }}
        />

        {/* 下部玉牌文字区 40% */}
        <div className="relative flex h-[40%] flex-col items-center justify-between px-3 pb-4 pt-3 text-center">
          {/* 人名 + 年代 */}
          <div>
            <div
              className="text-[18px] font-black tracking-[0.06em]"
              style={{
                color: '#F5E9C9',
                textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 8px ${accent}55`,
                fontFamily: 'var(--font-serif)',
              }}
            >
              {personaName}
            </div>
            <div
              className="mt-0.5 text-[11px] font-medium tracking-[0.06em]"
              style={{ color: accent, opacity: 0.85 }}
            >
              {personaEra}
            </div>
          </div>

          {/* 标题（副） */}
          <div
            className="text-[11px] font-semibold tracking-[0.02em]"
            style={{ color: '#D6CCB0' }}
          >
            {title}
          </div>

          {/* Hook · 短卷书 */}
          <div
            className="line-clamp-2 text-[11px] leading-[14px] tracking-[0.04em]"
            style={{ color: '#C8CDD8' }}
            dangerouslySetInnerHTML={{
              __html: hookHtml.replace(
                /<strong>/g,
                `<strong style="color:${accent};font-weight:700">`,
              ),
            }}
          />
        </div>

        {/* 底部金带 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px]"
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 50%, ${accent} 100%)`,
            boxShadow: `0 -1px 4px ${accent}66`,
          }}
        />
      </div>

      {/* hover meta 小字 */}
      <div
        className="pointer-events-none mt-2 text-center text-[11px] tracking-[0.1em] transition-opacity"
        style={{ color: '#6A7299', opacity: hovered ? 1 : 0 }}
      >
        {meta}
      </div>
    </div>
  );
}

/**
 * 8 部门卡牌默认配置
 */
export const DEPT_HERO_CONFIG = {
  overview: {
    heroImage: '/heroes/7-throne.webp',
    heroAlt: '九龙御座 · 大殿',
    tag: 'GREAT HALL · 大殿',
    accent: '#F0C66A',
    title: '九龙御座 · 陛下登朝',
    meta: '紫禁城俯仰 · 百官垂首 · 万物在座下',
    metric: { label: 'HALL', value: '97' },
    personaName: '陛下登朝',
    personaEra: 'SOVEREIGN · 御座视角',
    hookHtml: '百官皆安 · 惟 <strong>户部一件急</strong>',
    imageObjectPosition: 'center 42%',
  },
  'command-center': {
    heroImage: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
    heroAlt: '诸葛亮 · 军机处',
    tag: 'COMMAND · 军机处',
    accent: '#3DD68C',
    title: '丞相定计 · 羽扇纶巾',
    meta: '谈笑间樯橹灰飞烟灭 · 决策分派',
    metric: { label: 'ACTIVE', value: '12' },
    personaName: '诸葛 亮',
    personaEra: '181-234 · 三国',
    hookHtml: '要批一个方向 · <strong>臣即分派</strong>',
    imageObjectPosition: '62% 32%',
  },
  archive: {
    heroImage: '/heroes/9-direnjie.webp',
    heroAlt: '狄仁杰 · 御巡台',
    tag: 'INSPECTION · 御巡台',
    accent: '#6BA0FF',
    title: '神探夜察 · 六部辨异',
    meta: '断案如神 · 铁面清正 · 唐室砥柱',
    metric: { label: 'ANOMALY', value: '3' },
    personaName: '狄仁杰',
    personaEra: '630-700 · 唐',
    hookHtml: '巡察六部 · <strong>三处有异</strong>',
  },
  governance: {
    heroImage: '/heroes/character-roster/v5-governance-wei-zheng.webp',
    heroAlt: '魏徵 · 三省',
    tag: '3 CHANCELLERIES · 三省',
    accent: '#F43F5E',
    title: '谏官议政 · 三印流转',
    meta: '中书起草 · 门下复核 · 尚书下发',
    metric: { label: 'PENDING', value: '12' },
    personaName: '魏 徵',
    personaEra: '580-643 · 唐',
    hookHtml: '一案候审 · <strong>中书未定稿</strong>',
    imageObjectPosition: '62% 32%',
  },
  manors: {
    heroImage: '/heroes/character-roster/v5-manors-su-qin.webp',
    heroAlt: '苏秦 · 庄园',
    tag: 'MANORS · 庄园',
    accent: '#FB923C',
    title: '纵横捭阖 · 六印加身',
    meta: '合纵连横 · 一人佩六印 · 八庄齐动',
    metric: { label: 'SWARM', value: '23' },
    personaName: '苏 秦',
    personaEra: '? - 前284 · 战国',
    hookHtml: '外交在攻 · <strong>远洋遇阻</strong>',
    imageObjectPosition: '62% 32%',
  },
  intel: {
    heroImage: '/heroes/character-roster/v5-intel-qi-jiguang.webp',
    heroAlt: '戚继光 · 情报',
    tag: 'INTEL · 锦衣卫',
    accent: '#FB923C',
    title: '锦衣夜巡 · 烽火飞鸽',
    meta: '夜驰千里 · 铠甲风尘 · 烽火为号',
    metric: { label: 'MONITOR', value: '47' },
    personaName: '戚继光',
    personaEra: '1528-1588 · 明',
    hookHtml: '西北 <strong>3 烽火</strong> · 东南 8 机',
    imageObjectPosition: '62% 32%',
  },
  reports: {
    heroImage: '/heroes/character-roster/v5-reports-ouyang-xiu.webp',
    heroAlt: '欧阳修 · 礼部',
    tag: 'REPORTS · 战报库',
    accent: '#F0C66A',
    title: '玉玺落印 · 文章典籍',
    meta: '修文柄典 · 玺出为凭 · 千载一印',
    metric: { label: 'ARCHIVE', value: '48' },
    personaName: '欧阳修',
    personaEra: '1007-1072 · 北宋',
    hookHtml: '年终总报 · <strong>待玺印</strong>',
    imageObjectPosition: '62% 32%',
  },
  departments: {
    heroImage: '/heroes/8-ministers.webp',
    heroAlt: '历代名臣 · 群臣',
    tag: 'MINISTERS · 群臣',
    accent: '#F0C66A',
    title: '朝贺班列 · 千古名臣',
    meta: '十一宰辅列队 · 朝堂齐贺',
    metric: { label: 'IN COURT', value: '10/11' },
    personaName: '国士无双',
    personaEra: 'ACROSS DYNASTIES · 千古群臣',
    hookHtml: '户部求见 · <strong>事关春粮</strong>',
    imageObjectPosition: 'center 45%',
  },
  health: {
    heroImage: '/heroes/10-lishizhen.webp',
    heroAlt: '李时珍 · 太医院',
    tag: 'HEALTH · 太医院',
    accent: '#3DD68C',
    title: '本草钩沉 · 脉象洞明',
    meta: '遍尝百草 · 著本草纲目 · 活人无数',
    metric: { label: 'VITALS', value: '97' },
    personaName: '李时珍',
    personaEra: '1518-1593 · 明',
    hookHtml: '六部体征平稳 · <strong>户部有隐症</strong>',
    imageObjectPosition: '50% 35%',
  },
  forecast: {
    heroImage: '/heroes/character-roster/forecast-zhang-heng.webp',
    heroAlt: '张衡 · 钦天监',
    tag: 'OBSERVATORY · 钦天监',
    accent: '#D4A84B',
    title: '观象授时 · 推算有节',
    meta: '浑天仪测星 · 地动仪感地 · 前知三百年',
    metric: { label: 'SCENARIOS', value: '12' },
    personaName: '张 衡',
    personaEra: '78-139 · 东汉',
    hookHtml: '北方 <strong>90 天</strong> 内变局窗口已开',
    imageObjectPosition: '62% 32%',
  },
  scribe: {
    heroImage: '/heroes/v4-shiguan-simaqian.webp',
    heroAlt: '司马迁 · 史馆',
    tag: 'ANNALS · 史馆',
    accent: '#F0C66A',
    title: '秉笔直书 · 千载留名',
    meta: '究天人之际 · 通古今之变 · 成一家之言',
    metric: { label: 'RECORDS', value: '1k+' },
    personaName: '司马迁',
    personaEra: '前145-前86 · 西汉',
    hookHtml: '史馆已存 <strong>1,247 件</strong> 御批档案',
    imageObjectPosition: '65% 30%',
  },
  'grand-council': {
    heroImage: '/heroes/v4-grand-council-zhangliang.webp',
    heroAlt: '张良 · 军机处会议',
    tag: 'COUNCIL · 群臣会议',
    accent: '#A78BFA',
    title: '运筹帷幄 · 决胜千里',
    meta: '料敌机先 · 不战而屈人之兵 · 汉家谋圣',
    metric: { label: 'IN SESSION', value: '7' },
    personaName: '张 良',
    personaEra: '前250-前186 · 西汉',
    hookHtml: '会议进行 · <strong>三项争议收敛中</strong>',
  },
  study: {
    heroImage: '/heroes/character-roster/study-wang-yangming.webp',
    heroAlt: '王阳明 · 上书房',
    tag: 'STUDY · 上书房',
    accent: '#60A5FA',
    title: '知行合一 · 致良知',
    meta: '立功立德立言 · 三不朽 · 心学宗师',
    metric: { label: 'OFFICIALS', value: '6' },
    personaName: '王阳明',
    personaEra: '1472-1529 · 明',
    hookHtml: '单独召见 · <strong>先读 dossier 再批示</strong>',
    imageObjectPosition: '62% 32%',
  },
  hanlin: {
    heroImage: '/heroes/character-roster/hanlin-su-shi.webp',
    heroAlt: '苏轼 · 翰林学士',
    tag: 'HANLIN · 翰林院',
    accent: '#A78BFA',
    title: '储君研判 · 未来孵化',
    meta: '翰林学士 · 东坡通才 · 一代文宗',
    metric: { label: 'INSIGHTS', value: '24' },
    personaName: '翰林 · 苏轼',
    personaEra: '1037-1101 · 北宋',
    hookHtml: '太子主持 · <strong>储君之学 · 未来之选</strong>',
    imageObjectPosition: '62% 32%',
  },
  bingbu: {
    heroImage: '/heroes/character-roster/bingbu-sun-wu.webp',
    heroAlt: '孙武 · 兵部',
    tag: 'MILITARY · 兵部',
    accent: '#F43F5E',
    title: '知彼知己 · 百战不殆',
    meta: '竞品情报 · 攻防推演 · 市场战局',
    metric: { label: 'MONITOR', value: '3' },
    personaName: '孙 武',
    personaEra: '约前544-前496 · 春秋',
    hookHtml: '竞品甲 <strong>高危告急</strong> · 请即定攻防',
    imageObjectPosition: '62% 32%',
  },
} as const satisfies Record<string, DeptHeroCardProps>;

export type DeptHeroKey = keyof typeof DEPT_HERO_CONFIG;

/* ==========================================================================
 * DeptHeroBanner · 通栏大片（上线品质 hook）
 *
 * 两种变体：
 *   - split    左图 50% + 右文 50%，高度 ~360px（8 部门默认）
 *   - panorama 整幅铺满 + 底部文字叠层，高度 ~480px（群臣 / 御座）
 *
 * 替代原来的右上浮动小卡牌。左主右辅，强 hook。
 * ========================================================================== */

export interface DeptHeroBannerProps extends DeptHeroCardProps {
  /** split = 左图右文；panorama = 整幅横幅 */
  variant?: 'split' | 'panorama';
  /** 控制 banner 高度与文字密度 */
  density?: 'default' | 'compact' | 'slim';
  /** 副 metric 列，至多 3 个 */
  secondaryMetrics?: Array<{ label: string; value: string }>;
  /** 右下 CTA（可选） */
  cta?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

export function DeptHeroBanner({
  variant = 'split',
  density = 'default',
  heroImage,
  heroAlt,
  tag,
  accent,
  title,
  meta,
  metric,
  personaName,
  personaEra,
  hookHtml,
  imageObjectPosition,
  secondaryMetrics,
  className,
}: DeptHeroBannerProps) {
  const hookRendered = hookHtml.replace(
    /<strong>/g,
    `<strong style="color:${accent};font-weight:700">`,
  );

  if (variant === 'panorama') {
    const compact = density === 'compact';
    const slim = density === 'slim';
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border-2 ${className ?? ''}`}
        style={{
          borderColor: `${accent}66`,
          boxShadow: `0 14px 40px rgba(0,0,0,0.55), inset 0 0 0 1px ${accent}33`,
        }}
      >
        <div
          className={`relative w-full ${
            slim
              ? 'h-[172px] md:h-[196px]'
              : compact
                ? 'h-[240px] md:h-[270px]'
                : 'h-[320px] md:h-[380px]'
          }`}
        >
          <img
            src={assetUrl(heroImage)}
            alt={heroAlt}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: imageObjectPosition ?? 'center 35%' }}
          />
          {/* 底部到黑的大渐隐 */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[75%]"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(10,7,4,0.55) 45%, rgba(8,5,2,0.95) 100%)',
            }}
          />
          {/* 左右两侧轻 vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)',
            }}
          />

          {/* 左上 tag */}
          <div
            className={`absolute z-10 rounded-md font-semibold uppercase backdrop-blur-md ${
              slim
                ? 'left-4 top-4 px-2.5 py-1 text-[10px] tracking-[0.08em]'
                : 'left-6 top-6 px-3 py-1.5 text-[11px] tracking-[0.08em]'
            }`}
            style={{
              background: 'rgba(10,7,4,0.6)',
              border: `1px solid ${accent}88`,
              color: accent,
            }}
          >
            {tag}
          </div>

          {/* 右上主 metric 金印 */}
          <div
            className={`absolute z-10 rounded-lg backdrop-blur-md ${
              slim ? 'right-4 top-4 px-3 py-1.5' : 'right-6 top-6 px-4 py-2.5'
            }`}
            style={{
              background: `linear-gradient(135deg, ${accent}3a, rgba(10,7,4,0.88))`,
              border: `1px solid ${accent}`,
              boxShadow: `0 6px 20px rgba(0,0,0,0.55), inset 0 0 12px ${accent}33`,
            }}
          >
            <div
              className={`font-semibold uppercase ${slim ? 'text-[10px] tracking-[0.08em]' : 'text-[11px] tracking-[0.08em]'}`}
              style={{ color: accent }}
            >
              {metric.label}
            </div>
            <div
              className={`text-center font-mono font-black leading-none ${slim ? 'text-[22px]' : 'text-[28px]'}`}
              style={{ color: '#F5E9C9', textShadow: `0 0 10px ${accent}88` }}
            >
              {metric.value}
            </div>
          </div>

          {/* 底部大字名号 + hook */}
          <div
            className={`absolute inset-x-0 bottom-0 z-10 ${
              slim
                ? 'px-4 pb-3 md:px-6 md:pb-4'
                : compact
                  ? 'px-6 pb-6 md:px-8 md:pb-7'
                  : 'px-8 pb-8 md:px-12 md:pb-10'
            }`}
          >
            <div
              className={`font-semibold tracking-[0.06em] ${
                slim ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-[11px]'
              }`}
              style={{ color: accent, opacity: 0.9 }}
            >
              {personaEra}
            </div>
            <div
              className={`font-black leading-[1.02] tracking-[0.06em] ${
                slim
                  ? 'mt-1 text-[22px] md:text-[26px]'
                  : compact
                    ? 'mt-2 text-[28px] md:text-[34px]'
                    : 'mt-2 text-[36px] md:text-[48px]'
              }`}
              style={{
                color: '#F5E9C9',
                textShadow: `0 2px 14px rgba(0,0,0,0.95), 0 0 28px ${accent}44`,
                fontFamily: 'var(--font-serif)',
              }}
            >
              {personaName}
            </div>
            <div
              className={`font-semibold tracking-[0.02em] ${
                slim
                  ? 'mt-1 text-[11px] md:text-[12px]'
                  : compact
                    ? 'mt-2 text-[13px] md:text-[15px]'
                    : 'mt-3 text-[16px] md:text-[18px]'
              }`}
              style={{ color: '#E6DBBC' }}
            >
              {title}
            </div>
            <div
              className={`max-w-3xl ${
                slim
                  ? 'mt-1 line-clamp-1 text-[11px] leading-5 md:text-[12px]'
                  : compact
                    ? 'mt-2 text-[12px] leading-6 md:text-[13px] md:leading-7'
                    : 'mt-4 text-[13px] leading-7 md:text-[14px] md:leading-8'
              }`}
              style={{ color: '#C8CDD8' }}
              dangerouslySetInnerHTML={{ __html: hookRendered }}
            />
            <div
              className={`flex flex-wrap items-end ${
                slim ? 'mt-1.5 gap-3' : compact ? 'mt-3 gap-5' : 'mt-4 gap-8'
              }`}
              style={{ color: '#C8CDD8' }}
            >
              <div
                className={`${
                  slim ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-[11px]'
                } font-medium tracking-[0.04em]`}
                style={{ color: '#8A92AC' }}
              >
                {meta}
              </div>
              {secondaryMetrics?.map((m, i) => (
                <div key={i}>
                  <div
                    className={`${
                      slim ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-[11px]'
                    } font-semibold uppercase tracking-[0.08em]`}
                    style={{ color: `${accent}dd` }}
                  >
                    {m.label}
                  </div>
                  <div
                    className={`font-mono font-black leading-none text-[#F5E9C9] ${
                      slim ? 'text-[13px]' : compact ? 'text-[16px]' : 'text-[20px]'
                    }`}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 顶/底金带 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent} 50%, transparent)`,
            boxShadow: `0 1px 6px ${accent}88`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}aa 50%, transparent)`,
          }}
        />
      </div>
    );
  }

  // ============= split variant =============
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 ${className ?? ''}`}
      style={{
        borderColor: `${accent}55`,
        boxShadow: `0 12px 32px rgba(0,0,0,0.5), inset 0 0 0 1px ${accent}22`,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* 左：人像 */}
        <div className="relative min-h-[260px] md:min-h-[380px]">
          <img
            src={assetUrl(heroImage)}
            alt={heroAlt}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: imageObjectPosition ?? 'center 18%' }}
          />
          {/* 右边渐变到文字区 */}
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-44 md:block"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(12,10,6,0.7) 60%, rgba(10,7,4,0.98) 100%)',
            }}
          />
          {/* 底部渐变（窄屏） */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-32 md:hidden"
            style={{
              background:
                'linear-gradient(180deg, transparent, rgba(10,7,4,0.96))',
            }}
          />
          {/* 左上 tag */}
          <div
            className="absolute left-5 top-5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md"
            style={{
              background: 'rgba(10,7,4,0.65)',
              border: `1px solid ${accent}88`,
              color: accent,
            }}
          >
            {tag}
          </div>
          {/* 四角装饰 */}
          {[
            'top-2 left-2 border-l-2 border-t-2',
            'top-2 right-2 border-r-2 border-t-2 md:hidden',
            'bottom-2 left-2 border-l-2 border-b-2',
            'bottom-2 right-2 border-r-2 border-b-2 md:hidden',
          ].map((cls, i) => (
            <span
              key={i}
              aria-hidden
              className={`pointer-events-none absolute z-20 h-3 w-3 ${cls}`}
              style={{ borderColor: accent, opacity: 0.75 }}
            />
          ))}
        </div>

        {/* 右：文字区 */}
        <div
          className="relative flex flex-col justify-center gap-3 p-6 md:p-9"
          style={{
            background: 'linear-gradient(135deg, #15120a 0%, #0a0704 60%, #07050f 100%)',
          }}
        >
          {/* 年代 eyebrow */}
          <div
            className="text-[11px] font-semibold tracking-[0.06em]"
            style={{ color: accent, opacity: 0.92 }}
          >
            {personaEra}
          </div>

          {/* 人名 — 视觉级标题，但不是页面 H1（页面 H1 留给真实页名/价值陈述）。
              用 div + role="heading" aria-level="2"，screen reader 把它读作二级 */}
          <div
            role="heading"
            aria-level={2}
            className="text-[34px] font-black leading-[1.05] tracking-[0.06em] md:text-[42px]"
            style={{
              color: '#F5E9C9',
              textShadow: `0 2px 10px rgba(0,0,0,0.85), 0 0 22px ${accent}44`,
              fontFamily: 'var(--font-serif)',
            }}
          >
            {personaName}
          </div>

          {/* 副标题 */}
          <div
            className="text-[15px] font-semibold tracking-[0.02em] md:text-[17px]"
            style={{ color: '#E6DBBC' }}
          >
            {title}
          </div>

          {/* Hook 长句 */}
          <p
            className="mt-1 max-w-xl text-[13px] leading-7 md:text-[14px] md:leading-8"
            style={{ color: '#C8CDD8' }}
            dangerouslySetInnerHTML={{ __html: hookRendered }}
          />

          {/* meta 补充小字 */}
          <div
            className="text-[11px] font-medium tracking-[0.04em]"
            style={{ color: '#7A8299' }}
          >
            {meta}
          </div>

          {/* metric row */}
          <div className="mt-3 flex flex-wrap items-end gap-7">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: accent, opacity: 0.92 }}
              >
                {metric.label}
              </div>
              <div
                className="font-mono text-[30px] font-black leading-none"
                style={{ color: '#F5E9C9', textShadow: `0 0 10px ${accent}66` }}
              >
                {metric.value}
              </div>
            </div>
            {secondaryMetrics?.map((m, i) => (
              <div key={i}>
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: `${accent}cc` }}
                >
                  {m.label}
                </div>
                <div
                  className="font-mono text-[20px] font-bold leading-none"
                  style={{ color: '#F5E9C9' }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 顶/底金带 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
      />
    </div>
  );
}
