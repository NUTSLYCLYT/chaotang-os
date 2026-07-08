import {
  Archive,
  Bell,
  BookOpenText,
  BrainCircuit,
  Building2,
  Clock3,
  FileText,
  Gavel,
  Landmark,
  MessageSquareText,
  Network,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StatusTone = 'healthy' | 'warning' | 'danger' | 'processing' | 'neutral';

export interface NavItem {
  label: string;
  href: string;
}

export interface StatItem {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}

export interface AlertItem {
  title: string;
  body: string;
  tone: StatusTone;
  meta: string;
  icon: LucideIcon;
}

export interface DepartmentStatus {
  name: string;
  role: string;
  status: string;
  tone: StatusTone;
  load: string;
}

export interface SandTableNode {
  name: string;
  role: string;
  status: string;
  tone: StatusTone;
  href: string;
  positionClass: string;
  line: string;
  memorialTitle: string;
  memorialBody: string;
  risk: string;
  counsel: string;
}

export interface ActionItem {
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}

export const dadianNavItems: NavItem[] = [
  { label: '上书房', href: '/court-briefing' },
  { label: '大殿', href: '/overview' },
  { label: '六部', href: '/departments' },
  { label: '军机处', href: '/command-center' },
  { label: '锦衣卫', href: '/intel' },
  { label: '史馆', href: '/archive' },
];

export const todayStats: StatItem[] = [
  { label: '今日朝议', value: '9', detail: '3 件已归档', tone: 'healthy' },
  { label: '待裁决事项', value: '4', detail: '2 件需老板签核', tone: 'processing' },
  { label: '风险预警', value: '2', detail: '锦衣卫已标红', tone: 'danger' },
];

export const decisionAlerts: AlertItem[] = [
  {
    title: '客户报价边界待裁',
    body: '户部建议先锁毛利底线，刑部要求补合同责任条款。',
    tone: 'warning',
    meta: '军机处 · 18 分钟前',
    icon: Gavel,
  },
  {
    title: '新供应商交付风险',
    body: '工部发现测试样件缺少低温循环证据，建议暂缓对外承诺。',
    tone: 'danger',
    meta: '工部 / 锦衣卫 · 34 分钟前',
    icon: ShieldAlert,
  },
  {
    title: 'AI 招商话术已成稿',
    body: '礼部完成三版对外话术，等待老板选择语气与优先渠道。',
    tone: 'healthy',
    meta: '礼部 · 今日',
    icon: Sparkles,
  },
];

export const departmentStatuses: DepartmentStatus[] = [
  { name: '户部', role: '预算 / ROI / 资源', status: '核算中', tone: 'processing', load: '76%' },
  { name: '兵部', role: '竞争 / 战场 / 销售', status: '巡防中', tone: 'healthy', load: '63%' },
  { name: '工部', role: '交付 / 工期 / 质量', status: '压测中', tone: 'warning', load: '82%' },
  { name: '刑部', role: '合规 / 合同 / 风险', status: '复核中', tone: 'danger', load: '69%' },
  { name: '礼部', role: '传播 / 客户 / 对外', status: '待定稿', tone: 'processing', load: '55%' },
  { name: '史馆', role: '归档 / 复盘 / 旧案', status: '已入史', tone: 'healthy', load: '41%' },
];

export const sandTableNodes: SandTableNode[] = [
  {
    name: '户部',
    role: '预算与报价',
    status: '核算中',
    tone: 'processing',
    href: '/departments',
    positionClass: 'left-[13%] top-[56%]',
    line: '请先定毛利红线。',
    memorialTitle: '报价底线需先定夺',
    memorialBody: '户部测算显示当前报价仍有 8% 安全垫，但若叠加交付延期条款，毛利会被压缩。',
    risk: '未锁底价前不宜对外承诺。',
    counsel: '建议先下旨：锁定毛利红线，再让兵部回访关键客户。',
  },
  {
    name: '兵部',
    role: '市场与竞争',
    status: '巡防中',
    tone: 'healthy',
    href: '/departments',
    positionClass: 'left-[25%] top-[46%]',
    line: '竞品正在试探底价。',
    memorialTitle: '竞品降价正在试探',
    memorialBody: '兵部识别到两条客户侧询价变化，疑似竞品在以短期折扣换渠道口径。',
    risk: '若直接跟降，会破坏高端定位。',
    counsel: '建议由锦衣卫补证，再让礼部准备价值型回应话术。',
  },
  {
    name: '工部',
    role: '交付与质量',
    status: '压测中',
    tone: 'warning',
    href: '/departments',
    positionClass: 'left-[39%] top-[38%]',
    line: '低温证据还缺一环。',
    memorialTitle: '交付证据仍缺一环',
    memorialBody: '工部完成主要压测，但低温循环样件记录尚未形成可归档证据。',
    risk: '对外承诺交期会增加售后争议。',
    counsel: '建议暂缓最终交期承诺，先补齐测试记录并交史馆归档。',
  },
  {
    name: '刑部',
    role: '合同与风险',
    status: '复核中',
    tone: 'danger',
    href: '/departments',
    positionClass: 'right-[36%] top-[41%]',
    line: '验收口径有漂移。',
    memorialTitle: '合同责任边界待复核',
    memorialBody: '刑部发现客户补充条款中存在验收口径漂移，需老板明确可接受责任半径。',
    risk: '签约后容易出现无限验收。',
    counsel: '建议在军机处开启会审，先裁定违约金和验收标准。',
  },
  {
    name: '礼部',
    role: '传播与客户',
    status: '待定稿',
    tone: 'processing',
    href: '/departments',
    positionClass: 'right-[16%] top-[55%]',
    line: '话术可定一版主调。',
    memorialTitle: '对外话术可定稿',
    memorialBody: '礼部已形成三版客户沟通口径：稳健版、进攻版、伙伴版。',
    risk: '语气不统一会让销售团队各说各话。',
    counsel: '建议老板选择一种主语气，再由上书房生成下发圣旨。',
  },
  {
    name: '史馆',
    role: '归档与复盘',
    status: '已入史',
    tone: 'healthy',
    href: '/archive',
    positionClass: 'right-[27%] top-[47%]',
    line: '旧案已有三条可用。',
    memorialTitle: '旧案可复用',
    memorialBody: '史馆找到 3 条相似报价与交付案例，其中一条复盘显示先锁证据链能降低返工。',
    risk: '若不引用旧案，会重复踩同类坑。',
    counsel: '建议将旧案作为本次军机处会审的默认依据。',
  },
];

export const swarmStats: StatItem[] = [
  { label: '蜂群执行中', value: '18', detail: '5 路等待证据', tone: 'processing' },
  { label: 'AI 群臣在线', value: '42', detail: '六部 + 外廷智囊', tone: 'healthy' },
  { label: '归档完成率', value: '91%', detail: '近 7 日奏折闭环', tone: 'healthy' },
];

export const intelligenceAlerts: AlertItem[] = [
  {
    title: '竞品开始降价试探',
    body: '锦衣卫建议兵部复核客户线索，户部同步测算底价空间。',
    tone: 'warning',
    meta: '情报可信度 0.78',
    icon: Bell,
  },
  {
    title: '老客户复购窗口打开',
    body: '销售侧出现三条采购意向，可由上书房生成跟进圣旨。',
    tone: 'healthy',
    meta: '可转军机处',
    icon: ShieldCheck,
  },
];

export const quickActions: ActionItem[] = [
  {
    title: '一键下旨',
    body: '把老板一句话交给丞相拆解。',
    href: '/court-briefing',
    icon: MessageSquareText,
    primary: true,
  },
  { title: '进入军机处', body: '查看会审、分歧与执行链路。', href: '/command-center', icon: Swords },
  { title: '查看史馆', body: '翻旧案、看复盘、复用经验。', href: '/archive', icon: Archive },
  { title: '调度六部', body: '进入部门总览，分派承接人。', href: '/departments', icon: Building2 },
];

export const heroProofPoints = [
  { label: '丞相拆解', icon: BrainCircuit },
  { label: '群臣会审', icon: UsersRound },
  { label: '蜂群执行', icon: Network },
  { label: '史馆成卷', icon: BookOpenText },
];

export const courtTimeline = [
  { label: '下旨', icon: ScrollText },
  { label: '会审', icon: Landmark },
  { label: '执行', icon: Clock3 },
  { label: '奏折', icon: FileText },
];
