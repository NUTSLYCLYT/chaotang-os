'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Landmark,
  LibraryBig,
  ShieldCheck,
} from 'lucide-react';

import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import type { EdictView } from '@/features/shangshufang/edict-content';
import {
  ShangshufangLayoutShell,
  ShangshufangRailPanel,
} from '@/features/shared/components/shangshufang-layout-shell';
import {
  getDepartmentBureaus,
  getDepartmentBureauSlug,
  getSixDepartmentLinks,
  getSixDepartmentScrollTheme,
  type SixDepartmentContent,
} from '@/features/departments/lib/six-departments-content';

function sealForDepartment(code: SixDepartmentContent['code']): EdictView['seal'] {
  return code === 'legal' ? 'secret' : 'imperial';
}

function priorityForDepartment(code: SixDepartmentContent['code']): NonNullable<EdictView['meta']>['priority'] {
  return code === 'finance' || code === 'legal' ? 'high' : 'medium';
}

function departmentToEdict(department: SixDepartmentContent): EdictView {
  const scrollTheme = getSixDepartmentScrollTheme(department.code);
  return {
    id: `six-department:${department.code}`,
    title: `${department.name}经营案卷`,
    subtitle: department.bossLine,
    headerKicker: 'SIX MINISTRIES',
    issuerLine: `${department.name} · 上书房式部门主卷`,
    question: department.positioning,
    seal: sealForDepartment(department.code),
    meta: {
      accent: scrollTheme.accent,
      accentSoft: scrollTheme.accentSoft,
      reporter: department.name,
      priority: priorityForDepartment(department.code),
      badges: [
        { label: department.maturity, tone: 'amber' },
        { label: `${department.bureauCount}司`, tone: 'blue' },
        { label: '主卷', tone: 'green' },
      ],
    },
    rows: [
      { label: '圣裁', body: department.bossLine },
      { label: '职掌', body: department.positioning },
      { label: '现状', body: department.statusNote },
      { label: '能力', body: department.capabilities.join('\n') },
      {
        label: '结构',
        body: department.panelSections
          .map((section) => `${section.title}\n${section.items.join('\n')}`)
          .join('\n\n'),
      },
      { label: '落地判断', body: department.currentState.join('\n') },
      { label: '后令', body: department.nextFocus },
    ],
  };
}

type BackendDisplayItem = {
  label: string;
  body: string;
};

const BACKEND_DISPLAY_BY_DEPARTMENT: Record<
  SixDepartmentContent['code'],
  {
    status: string;
    summary: string;
    items: BackendDisplayItem[];
  }
> = {
  finance: {
    status: '真链较完整',
    summary: '户部后端已经能支撑财政总览、预算项目、付款裁决预览、财报审计预览和金融情报闭环，适合在右侧展示“钱够不够、值不值、险不险”。',
    items: [
      { label: '财政总览', body: '申请预算、已批金额、待批数、平均 ROI、现金储备、项目列表和数据来源状态。' },
      { label: '项目裁决', body: '预算、ROI、回收期、现金流压力、风险等级、优先级、建议和验收标准。' },
      { label: '审计预览', body: '付款三道门、三表草稿、审计异常、融资材料、证据链和归档草稿。' },
      { label: '情报闭环', body: '公开来源取证、户部测算奏折、上书房 brief、授权裁决、执行回报和史馆归档。' },
    ],
  },
  ops: {
    status: '规则引擎较完整',
    summary: '兵部后端已具备 CRO / Sales Office 判断：能把商机、报价、渠道、客户与增长动作拆成可审的销售营收意见。',
    items: [
      { label: '销售问题分类', body: '识别商机推进、报价策略、渠道伙伴、客户关系、销售组织、增长实验等问题类型。' },
      { label: '跨部复核', body: '正式报价、折扣、毛利、ROI、分成会触发户部；对外承诺会触发刑部；销售组织会触发吏部。' },
      { label: '质量门', body: '正式报价必须户部和刑部复核，避免直接外发；高风险动作进入人工确认。' },
      { label: '可展示结果', body: '兵部立场、缺失证据、风险登记、下一步动作、参审部门和质量门状态。' },
    ],
  },
  gongbu: {
    status: '工程链路成型',
    summary: '工部后端围绕可交付性、工程可行性、PACK 蜂群建设和质量门展开，适合展示“能不能做、多久做、卡在哪里”。',
    items: [
      { label: '可行性判断', body: '从需求、技术方案、依赖、排期、验收门和风险项判断工程能否落地。' },
      { label: 'PACK 建设', body: '拆模块、能力依赖、资源需求、工期、质量门，并与户部预算上限联动。' },
      { label: '交付风险', body: '展示阻塞依赖、测试补证、发布门禁、BOM/供应链和质量异常。' },
      { label: '可展示结果', body: '模块计划、验收标准、风险清单、下一步工程动作和跨部门卡点。' },
    ],
  },
  legal: {
    status: '真链较完整',
    summary: '刑部后端已有 CLO / CCO Office：能对合同、付款、股权、劳动、知识产权、争议和授权动作做红线判断。',
    items: [
      { label: '法务分类', body: '识别合同审查、对外承诺、付款违约、股权治理、劳动动作、争议诉讼、知识产权和签章授权。' },
      { label: '红线门禁', body: '无合同正文不得建议签署；对外承诺必须有授权；不可逆法律动作必须人工确认。' },
      { label: '跨部复核', body: '付款、保证金、违约金联动户部；劳动动作联动吏部；报价和客户承诺联动兵部/户部。' },
      { label: '可展示结果', body: '刑部立场、适用缺口、缺失证据、禁止动作、风险登记、法务下一步。' },
    ],
  },
  market: {
    status: '前端能力丰富，后端半沙盘',
    summary: '礼部当前更偏品牌传播与对外表达编排，后端可支撑传播口径、发布边界、客户沟通和跨部复核提示，但主业务数据仍待接真。',
    items: [
      { label: '表达边界', body: '区分事实、承诺和愿景；对外说法需要证据、法务或业务依据。' },
      { label: '传播案卷', body: '可展示客户沟通、危机公关、品牌口径、会议纪要、对外声明和内容发布事项。' },
      { label: '跨部联动', body: '对外承诺、报价数字、法律风险分别联动刑部、户部和兵部。' },
      { label: '可展示结果', body: '发布建议、缺证素材、风险提示、可公开/需修改/禁止表达的边界。' },
    ],
  },
  personnel: {
    status: '招聘真链已落地，组织数据半沙盘',
    summary: '吏部后端已能承接招聘和组织责任链，适合展示“谁负责、谁过载、谁需要补位、什么动作要人工确认”。',
    items: [
      { label: '招聘把关', body: '可展示招聘需求、岗位画像、候选匹配、补位建议和人才执行入口。' },
      { label: '责任链', body: '把任务拆成 DRI、RACI、截止时间、交接关系和组织能力缺口。' },
      { label: '劳动联动', body: '辞退、调岗、降薪、提成等动作会被刑部要求吏部复核。' },
      { label: '可展示结果', body: '关键岗位风险、过载团队、继任缺口、招聘优先级和下一步组织动作。' },
    ],
  },
};

export function SixDepartmentOverviewPage({ department }: { department: SixDepartmentContent }) {
  const bureaus = getDepartmentBureaus(department.code);
  const quickLinks = getSixDepartmentLinks();
  const edict = departmentToEdict(department);
  const backendDisplay = BACKEND_DISPLAY_BY_DEPARTMENT[department.code];

  return (
    <ShangshufangLayoutShell
      eyebrow={`${department.titleEn} · DEPARTMENT DETAIL`}
      title={`${department.name}详情`}
      subtitle="按上书房布局展示：左侧为部门身份和职责，中央为可裁断主卷，右侧为能力、司局、快捷去向和验收口。"
      accent={department.accent}
      background={department.background}
      breadcrumb={
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8F98B8]">
          <Link href="/liubu" className="transition hover:text-[#F0C66A]">
            六部大厅
          </Link>
          <span className="text-[#4E5878]">/</span>
          <span className="text-[#D7DFF2]">{department.name}详情</span>
        </div>
      }
      actions={
        <>
          <Link
            href="/shangshufang"
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition hover:brightness-110"
            style={{
              borderColor: `${department.accent}58`,
              color: department.accent,
              background: `${department.accent}10`,
            }}
          >
            <Landmark size={13} />
            回上书房
          </Link>
        </>
      }
      left={
        <ShangshufangRailPanel
          title={`${department.name}值房`}
          subtitle={department.bossLine}
          accent={department.accent}
        >
          <div className="space-y-3">
            <div
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: 'rgba(5,7,13,0.56)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <LibraryBig size={13} />
                下设各司
              </div>
              <div className="mt-2 space-y-1.5">
                {bureaus.map((bureau, index) => (
                  <Link
                    key={`${bureau.name}-${index}`}
                    href={`/liubu/${department.code}/${getDepartmentBureauSlug(index, department.code)}`}
                    className="group flex items-start justify-between gap-2 rounded-[8px] border px-3 py-2 transition hover:bg-white/[0.04]"
                    style={{ borderColor: `${department.accent}24`, background: `${department.accent}08` }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-[#F5E9C9]">{bureau.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: department.accent }}>
                        {bureau.role}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-[#C8CDD8]">
                        {bureau.scope}
                      </span>
                    </span>
                    <ArrowRight
                      size={12}
                      className="mt-1 shrink-0 text-[#7C86A6] transition group-hover:translate-x-0.5"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </ShangshufangRailPanel>
      }
      center={
        <div className="h-full min-h-0">
          <EdictStage
            view={edict}
            customBodyScroll="styled"
            footer={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/shangshufang"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    borderColor: `${department.accent}44`,
                    color: '#5b3410',
                    background: `${department.accent}28`,
                  }}
                >
                  <Landmark size={13} />
                  下旨
                </Link>
              </div>
            }
          />
        </div>
      }
      right={
        <ShangshufangRailPanel
          title={`${department.name}右批`}
          subtitle="能力、去向和验收口集中在这里。"
          accent={department.accent}
        >
          <div className="space-y-3">
            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}30`, background: `${department.accent}0F` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                  <ShieldCheck size={13} />
                  后端可展示
                </div>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px]"
                  style={{ borderColor: `${department.accent}34`, color: department.accent, background: `${department.accent}10` }}
                >
                  {backendDisplay.status}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-6 text-[#D7DFF2]">{backendDisplay.summary}</p>
              <div className="mt-3 space-y-2">
                {backendDisplay.items.map((item) => (
                  <div key={item.label} className="rounded-[8px] border px-2.5 py-2" style={{ borderColor: `${department.accent}20`, background: 'rgba(5,7,13,0.42)' }}>
                    <div className="text-[11px] font-semibold text-[#F5E9C9]">{item.label}</div>
                    <p className="mt-1 text-[11px] leading-5 text-[#AEB7CC]">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: `${department.accent}08` }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <ShieldCheck size={13} />
                能做什么
              </div>
              <div className="mt-2 space-y-2">
                {department.capabilities.slice(0, 5).map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="mt-1 shrink-0" style={{ color: department.accent }} />
                    <p className="text-[11px] leading-5 text-[#D7DFF2]">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: 'rgba(5,7,13,0.56)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <Building2 size={13} />
                快捷去向
              </div>
              <div className="mt-2 space-y-1.5">
                {quickLinks.map((item) => (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className="flex items-center justify-between rounded border px-2.5 py-1.5 text-[10px] transition hover:bg-white/[0.03]"
                    style={{ borderColor: `${department.accent}30`, color: department.accent }}
                  >
                    <span>{item.label}</span>
                    <ArrowRight size={11} />
                  </Link>
                ))}
              </div>
            </section>

            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}26`, background: 'rgba(0,0,0,0.22)' }}
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">
                下一条最值得补的链
              </div>
              <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">{department.nextFocus}</p>
            </section>
          </div>
        </ShangshufangRailPanel>
      }
      footer={
        <div className="text-center text-[10px] tracking-[0.22em] text-[#5a5340]">
          朝堂 OS · {department.name} · 上书房式三轴详情页
        </div>
      }
    />
  );
}
