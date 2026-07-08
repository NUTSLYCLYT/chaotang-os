import type { Memorial } from './types';
import type { BlastRadius } from '@/features/governance/lib/gate';

/**
 * 圣旨展示平台(EdictStage)的统一内容契约。
 * 「一个舞台,三路调用」:奏折 / 丞相 / 钦天监 各自把内容适配成 EdictView 投入同一卷轴,
 * 平台只认这一份判别结构,不为任何一路特例化(日后第四路只加一个 seal 类型即可)。
 */

/** 钤印随调用方适配:御览(奏折)/ 辅政(丞相)/ 训诲(钦天监教学)/ 监国(东宫)/ 機密(群臣硬冲突·伏候圣裁) */
export type EdictSeal = 'imperial' | 'chancellor' | 'tutorial' | 'prince' | 'secret';

export interface EdictRow {
  label: string;
  body: string;
}

export interface EdictView {
  /** 切换内容时用于重挂载、重演展卷·落墨·钤印仪式 */
  id: string;
  title: string;
  subtitle?: string;
  /** 卷轴抬头，默认"奉天承运"；东宫可传"监国听政"。 */
  headerKicker?: string;
  /** 发文语，默认"皇帝诏曰"；东宫可传"东宫令曰"。 */
  issuerLine?: string;
  /** 皇上原问/下旨原文(raw_command 或 refined_edict):正文 Hero 锚点,即「此折所裁的那一句」。
      区别于 title(折子类型,如「蜂群回奏·质门阻塞」)。缺则不渲染 Hero。 */
  question?: string;
  meta?: {
    petitioner?: string;
    reporter?: string;
    priority?: Memorial['priority'];
    /** 严厉度(blast_radius):风险分级 SSOT，源自 governance gate（御史/尚书省推导，禁自造启发式）。
        裁决责任徽据此判红/中性；缺则徽章保持中性「待人工确认」，不伪造「高风险」。 */
    blastRadius?: BlastRadius;
    badges?: Array<{
      label: string;
      tone?: 'green' | 'amber' | 'red' | 'blue';
    }>;
    downloads?: Array<{
      label: string;
      href?: string;
      kind?: 'attachment' | 'evidence_pack' | 'report';
      disabledReason?: string;
    }>;
    /** Optional scroll theme accent. Used by department/court pages without changing the default Shangshufang gold scroll. */
    accent?: string;
    accentSoft?: string;
  };
  rows: EdictRow[];
  sealDate?: string;
  seal: EdictSeal;
}

export const EDICT_SCROLL_THEME = {
  shangshufang: { accent: '#D4A84B', accentSoft: '#F0C66A' },
  junjichu: { accent: '#D4A84B', accentSoft: '#F0C66A' },
  donggong: { accent: '#7A3F1F', accentSoft: '#F0C66A' },
  jinyiwei: { accent: '#9B3A4D', accentSoft: '#E8A3B0' },
  tianyiyuan: { accent: '#3E8E9C', accentSoft: '#86D5DE' },
} as const;

/**
 * 各钤印的字样(中央水印 + 角印)与印色。
 * color 为朱砂/暗红印泥色,EdictStage 据此参数化印章描边、角印与纸面基调。
 * secret(機密)用暗血红 + 深色封缄纸,以肃穆区别于朱砂三印。
 */
export const EDICT_SEAL: Record<EdictSeal, { glyph: string; a: string; b: string; color: string }> = {
  imperial: { glyph: '御览', a: '御', b: '览', color: '#962820' },
  chancellor: { glyph: '辅政', a: '辅', b: '政', color: '#962820' },
  tutorial: { glyph: '训诲', a: '训', b: '诲', color: '#962820' },
  prince: { glyph: '监国', a: '监', b: '国', color: '#7a3f1f' },
  secret: { glyph: '機密', a: '機', b: '密', color: '#6b2d27' },
};
