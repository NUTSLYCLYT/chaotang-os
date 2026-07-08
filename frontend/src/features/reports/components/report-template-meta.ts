/**
 * 报告模板元数据（颜色、标签、图标），共用
 */

import { Crown, Globe, Heart, Telescope, FileText } from 'lucide-react';
import type { ReportTemplate } from '@/types/report';

export interface ReportTemplateMeta {
  label: string;
  sublabel: string;
  color: string;
  Icon: typeof Crown;
}

export const REPORT_TEMPLATE_META: Record<ReportTemplate, ReportTemplateMeta> = {
  executive_digest: {
    label: '高管摘要',
    sublabel: 'Executive Digest',
    color: '#F0C66A',
    Icon: Crown,
  },
  strategy_report: {
    label: '战略报告',
    sublabel: 'Strategy Report',
    color: '#B794F4',
    Icon: FileText,
  },
  intel_brief: {
    label: '情报简报',
    sublabel: 'Intel Brief',
    color: '#FB923C',
    Icon: Globe,
  },
  health_report: {
    label: '健康报告',
    sublabel: 'Health Report',
    color: '#34D399',
    Icon: Heart,
  },
  forecast_memo: {
    label: '预测备忘',
    sublabel: 'Forecast Memo',
    color: '#60A5FA',
    Icon: Telescope,
  },
};
