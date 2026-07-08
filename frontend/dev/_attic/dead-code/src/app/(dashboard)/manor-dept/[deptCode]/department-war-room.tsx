'use client';

import Link from 'next/link';
import { assetUrl } from '@/lib/asset';
import { GongbuBottomDock } from '@/features/gongbu/components/gongbu-bottom-dock';
import { LibuBottomDock } from '@/features/libu/components/libu-bottom-dock';
import { DOCK_BOTTOM_PADDING } from '@/features/shared/components/bottom-dock';
import { DepartmentModuleCard } from '@/features/departments/components/department-module-card';
import { imperialModulePanelStyle, imperialModuleTileStyle } from './imperial-panel-style';

type Tone = 'works' | 'rites';

interface WarRoomMetric {
  label: string;
  value: string;
  unit?: string;
  trend: string;
}

interface PipelineStep {
  label: string;
  status: string;
  progress: number;
}

interface WorkItem {
  title: string;
  meta: string;
  impact: string;
}

interface SwarmInstance {
  deptCode: string;
  deptName: string;
  deptEmoji: string;
  deptColor: string;
  status: 'running' | 'busy' | 'idle' | 'blocked' | 'done';
  taskCount: number;
  summary: string;
}

interface WarRoomConfig {
  tone: Tone;
  deptName: string;
  deptEn: string;
  title: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  heroImage: string;
  heroPosition: string;
  operator: string;
  operatorRole: string;
  primaryAction: string;
  secondaryAction: string;
  bgImage?: string;
  metrics: WarRoomMetric[];
  pipeline: PipelineStep[];
  workbenchTitle: string;
  workbenchItems: WorkItem[];
  radarLabels: string[];
  rightTitle: string;
  rightItems: WorkItem[];
  commandInput: string;
  swarmInstances: SwarmInstance[];
}

const CONFIGS: Record<Tone, WarRoomConfig> = {
  works: {
    tone: 'works',
    deptName: '工部',
    deptEn: 'MINISTRY OF WORKS',
    title: '产品技术交付总控台',
    subtitle: '把奏折拆成 PRD、架构、排期与验收标准；同步代码仓库、CI、监控与跨部依赖。',
    accent: '#6BA0FF',
    accentSoft: '#2DD4BF',
    heroImage: '/heroes/character-roster/v5-intel-qi-jiguang.webp',
    heroPosition: '62% 32%',
    operator: '戚继光',
    operatorRole: '工程统领 · 架构审校',
    primaryAction: '生成技术方案',
    secondaryAction: '查看交付排期',
    metrics: [
      { label: '准时交付率', value: '92', unit: '%', trend: '+6.4%' },
      { label: '阻塞依赖', value: '7', trend: '需裁断' },
      { label: 'PRD 完备度', value: '84', unit: '%', trend: '+12%' },
      { label: '构建健康', value: 'A-', trend: '稳定' },
    ],
    pipeline: [
      { label: '需求澄清', status: '已定稿', progress: 100 },
      { label: '架构评审', status: '进行中', progress: 68 },
      { label: '接口契约', status: '待刑部核验', progress: 42 },
      { label: '交付排期', status: '候户部预算', progress: 36 },
    ],
    workbenchTitle: '工程沙盘',
    workbenchItems: [
      { title: '新能源报价系统 MVP', meta: '12 周 / 6 人 / 三阶段', impact: '第三方接口需 2 周验证' },
      { title: '客户域数据中台', meta: 'API 契约 23 项', impact: '推荐先封装读模型' },
      { title: '旧系统迁移窗口', meta: '双写 14 天', impact: '回滚预案待审' },
    ],
    radarLabels: ['PRD', 'ARCH', 'API', 'CI', 'SRE', 'QA'],
    rightTitle: '交付预警',
    rightItems: [
      { title: '工部 · 户部预算口径未合并', meta: '影响 2 个里程碑', impact: '建议丞相裁断' },
      { title: '供应商 API SLA 不足', meta: 'P95 910ms', impact: '预留降级通道' },
      { title: '测试环境容量偏低', meta: '压测峰值 71%', impact: '今晚扩容' },
    ],
    commandInput: '请工部给出 12 周 MVP 技术方案，并标出必须裁断的依赖。',
    swarmInstances: [
      { deptCode: 'works', deptName: '工部', deptEmoji: '🔧', deptColor: '#6BA0FF', status: 'running', taskCount: 5, summary: '新能源报价MVP架构评审中' },
      { deptCode: 'finance', deptName: '户部', deptEmoji: '💰', deptColor: '#F0C66A', status: 'busy', taskCount: 8, summary: '预算口径合并待裁断' },
      { deptCode: 'legal', deptName: '刑部', deptEmoji: '⚖️', deptColor: '#3DD68C', status: 'idle', taskCount: 2, summary: 'API合规核验待工部接口就绪' },
      { deptCode: 'market', deptName: '礼部', deptEmoji: '🎨', deptColor: '#6fd0d8', status: 'running', taskCount: 6, summary: '新品发布传播方案定调中' },
      { deptCode: 'guard', deptName: '锦衣卫', deptEmoji: '🛰', deptColor: '#FB923C', status: 'idle', taskCount: 3, summary: '舆情复核48h内出报' },
      { deptCode: 'ops', deptName: '兵部', deptEmoji: '⚔️', deptColor: '#6BA0FF', status: 'blocked', taskCount: 4, summary: '待户部预算确认后启动' },
    ],
  },
  rites: {
    tone: 'rites',
    deptName: '礼部',
    deptEn: 'MINISTRY OF RITES',
    bgImage: '/prd/libu-rites.webp',
    title: '品牌传播与对外表达台',
    subtitle: '把战略判断转成发布节奏、传播口径、高管摘要与危机响应；联动锦衣卫舆情与兵部攻防。',
    accent: '#6fd0d8',
    accentSoft: '#F0C66A',
    heroImage: '/heroes/character-roster/v5-reports-ouyang-xiu.webp',
    heroPosition: '62% 32%',
    operator: '欧阳修',
    operatorRole: '礼制修辞 · 品牌定调',
    primaryAction: '生成传播战役',
    secondaryAction: '查看品牌声量',
    metrics: [
      { label: '品牌健康度', value: '87', unit: '%', trend: '+9.1%' },
      { label: '本周声量', value: '320', unit: '万', trend: '+18%' },
      { label: '舆情风险', value: '2', trend: '低位' },
      { label: '内容命中率', value: '76', unit: '%', trend: '+5%' },
    ],
    pipeline: [
      { label: '受众分层', status: '已完成', progress: 100 },
      { label: '核心叙事', status: '定调中', progress: 74 },
      { label: '渠道排期', status: '待预算确认', progress: 55 },
      { label: '高管摘要', status: '待御览', progress: 48 },
    ],
    workbenchTitle: '传播沙盘',
    workbenchItems: [
      { title: '新品发布双渠道投放', meta: '小红书 + 抖音 / 21 天', impact: 'CAC 控制在 ¥285 内' },
      { title: 'CEO 致客户公开信', meta: '三版口径对照', impact: '偏稳健表达' },
      { title: '海外电商本地化', meta: '5 个市场素材包', impact: '需锦衣卫补政策信号' },
    ],
    radarLabels: ['BRAND', 'KOL', 'PR', 'LIVE', 'SEO', 'CRM'],
    rightTitle: '声量预警',
    rightItems: [
      { title: '竞品发布会抢占同档期', meta: '48 小时内', impact: '建议错峰或反制' },
      { title: '技术 Demo 素材未齐', meta: '依赖工部', impact: '先发概念版' },
      { title: '海外评论区疑似集中质疑', meta: '新增 148 条', impact: '锦衣卫复核来源' },
    ],
    commandInput: '请礼部生成新品发布传播方案，包含渠道节奏、核心口径和危机预案。',
    swarmInstances: [
      { deptCode: 'market', deptName: '礼部', deptEmoji: '🎨', deptColor: '#6fd0d8', status: 'running', taskCount: 6, summary: '新品发布双渠道投放执行中' },
      { deptCode: 'works', deptName: '工部', deptEmoji: '🔧', deptColor: '#6BA0FF', status: 'busy', taskCount: 7, summary: '技术Demo素材待交付礼部' },
      { deptCode: 'guard', deptName: '锦衣卫', deptEmoji: '🛰', deptColor: '#FB923C', status: 'running', taskCount: 5, summary: '海外评论区复核中·新增148条' },
      { deptCode: 'finance', deptName: '户部', deptEmoji: '💰', deptColor: '#F0C66A', status: 'idle', taskCount: 3, summary: 'CAC预算控制在¥285内' },
      { deptCode: 'ops', deptName: '兵部', deptEmoji: '⚔️', deptColor: '#6BA0FF', status: 'idle', taskCount: 4, summary: '竞品发布会攻防待策略' },
      { deptCode: 'legal', deptName: '刑部', deptEmoji: '⚖️', deptColor: '#3DD68C', status: 'idle', taskCount: 2, summary: '传播合规审核待叙事定稿' },
    ],
  },
};

function CornerFrame({ color }: { color: string }) {
  return (
    <>
      {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((cls) => (
        <span key={cls} className={`pointer-events-none absolute h-5 w-5 ${cls}`} style={{ borderColor: color }} />
      ))}
    </>
  );
}

function Glass({
  children,
  className = '',
  color,
}: {
  children: React.ReactNode;
  className?: string;
  color: string;
}) {
  return (
    <section
      className={`relative overflow-hidden border backdrop-blur-[8px] ${className}`}
      style={imperialModulePanelStyle(color, 'strong')}
    >
      <CornerFrame color={`${color}99`} />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />
      {children}
    </section>
  );
}

function MetricTile({ metric, color }: { metric: WarRoomMetric; color: string }) {
  return (
    <div className="rounded-md border px-3 py-3" style={imperialModuleTileStyle(color)}>
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color }}>{metric.label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="font-mono text-[28px] font-semibold leading-none text-[#F5E9C9]">
          {metric.value}
          {metric.unit && <span className="ml-1 text-[12px] text-[#8F9AB8]">{metric.unit}</span>}
        </div>
        <div className="text-[11px]" style={{ color }}>{metric.trend}</div>
      </div>
    </div>
  );
}

function CentralRadar({ config }: { config: WarRoomConfig }) {
  const count = config.radarLabels.length;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]">
      <div
        className="absolute inset-[11%] rounded-full border"
        style={{ borderColor: `${config.accent}3f`, boxShadow: `0 0 80px ${config.accent}18 inset` }}
      />
      <div className="absolute inset-[22%] rounded-full border border-white/[0.08]" />
      <div className="absolute inset-[34%] rounded-full border border-white/[0.07]" />
      <div
        className="absolute left-1/2 top-1/2 h-[42%] w-px origin-bottom animate-rotate-slow"
        style={{ background: `linear-gradient(180deg, ${config.accent}, transparent)`, transform: 'translate(-50%, -100%)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${config.accent}44 0%, ${config.accent}12 48%, transparent 70%)` }}
      />
      <div className="absolute left-1/2 top-1/2 flex h-[118px] w-[118px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0C66A]/30 bg-[#070A10]/80">
        <div className="text-center">
          <div className="gold-text font-serif text-[24px] font-semibold">{config.deptName}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-[#8F835F]">CONTROL</div>
        </div>
      </div>
      {config.radarLabels.map((label, index) => {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 42;
        const y = 50 + Math.sin(angle) * 42;
        return (
          <div
            key={label}
            className="absolute flex h-12 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-white/[0.08] bg-[#07101B]/88 font-mono text-[10px] tracking-[0.12em] text-[#DCE6F8]"
            style={{ left: `${x}%`, top: `${y}%`, boxShadow: `0 0 22px ${config.accent}16` }}
          >
            <span className="mr-1 h-1.5 w-1.5 rounded-full" style={{ background: config.accent }} />
            {label}
          </div>
        );
      })}
    </div>
  );
}

const SWARM_STATUS_META: Record<SwarmInstance['status'], { label: string; color: string }> = {
  running: { label: '办理中', color: '#E5C88A' },
  busy: { label: '忙碌', color: '#F0C66A' },
  idle: { label: '待命', color: '#6A7299' },
  blocked: { label: '阻塞', color: '#F43F5E' },
  done: { label: '完成', color: '#3DD68C' },
};

export function DepartmentWarRoom({ tone }: { tone: Tone }) {
  const config = CONFIGS[tone];
  const darkWash = tone === 'works' ? 'rgba(20,54,82,0.22)' : 'rgba(28,84,92,0.22)';
  const moduleTitleColor = tone === 'rites' ? config.accent : undefined;

  return (
    <main className={`h-full overflow-y-auto bg-[#03060B] text-[#EAEEFB] ${DOCK_BOTTOM_PADDING}`}>
      <div className="relative min-h-full overflow-hidden">
        <div className="absolute inset-0">
          {config.bgImage && (
            <img
              src={assetUrl(config.bgImage)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <img
            src={assetUrl(config.heroImage)}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-[0.18]"
            style={{ objectPosition: config.heroPosition }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,11,0.72),rgba(3,6,11,0.94)_46%,#03060B_100%)]" style={config.bgImage ? { opacity: 0.55 } : undefined} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 26%, ${darkWash}, transparent 48%)` }} />
          <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(rgba(240,198,106,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(240,198,106,0.12) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        </div>

        <div className="relative mx-auto flex min-h-full w-full max-w-[1680px] flex-col gap-4 p-4 lg:p-5">
          <header className="flex flex-wrap items-center justify-between gap-3 border px-4 py-3 backdrop-blur-[8px]" style={imperialModulePanelStyle(config.accent, 'soft')}>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-[0.32em]" style={{ color: config.accent }}>{config.deptEn}</div>
                {/* RD-4: 本页数据为硬编码演示数据，不来自真实后端端点 */}
                <span
                  className="rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]"
                  style={{ borderColor: '#6A729966', color: '#6A7299', background: 'rgba(106,114,153,0.08)' }}
                >
                  演示数据
                </span>
              </div>
              <h1 className="mt-1 font-serif text-[24px] font-semibold tracking-[0.04em] text-[#F5E9C9] md:text-[30px]">{config.deptName} · {config.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <Link href="/departments" className="rounded-md border border-white/10 px-3 py-2 text-[#C8CDD8] hover:border-[#F0C66A]/35">六部大厅</Link>
              <Link href="/command-center" className="rounded-md border px-3 py-2" style={{ borderColor: `${config.accent}66`, color: config.accent }}>{config.primaryAction}</Link>
              <Link href="/reports" className="rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-2 text-[#F0C66A]">{config.secondaryAction}</Link>
            </div>
          </header>

          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[310px_minmax(560px,1fr)_330px]">
            <div className="space-y-4">
              <Glass color={config.accent} className="p-4">
                <div className="flex gap-4">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border" style={{ borderColor: `${config.accent}55` }}>
                    <img src={assetUrl(config.heroImage)} alt={config.operator} className="h-full w-full object-cover" style={{ objectPosition: config.heroPosition }} />
                  </div>
                  <div className="min-w-0">
                    <div className="section-eyebrow">值守主官</div>
                    <div className="mt-1 font-serif text-[20px] text-[#F5E9C9]">{config.operator}</div>
                    <div className="mt-1 text-[12px] leading-5 text-[#9AA3C4]">{config.operatorRole}</div>
                    <div className="mt-3 inline-flex rounded border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2 py-1 text-[10px] text-[#F0C66A]">实时在线 · 已接入后端契约</div>
                  </div>
                </div>
                <p className="mt-4 text-[12px] leading-6 text-[#C8CDD8]">{config.subtitle}</p>
              </Glass>

              <Glass color={config.accent} className="p-4">
                <div className="section-eyebrow">核心指标</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {config.metrics.map((metric) => (
                    <MetricTile key={metric.label} metric={metric} color={config.accent} />
                  ))}
                </div>
              </Glass>

              <Glass color={config.accent} className="p-4">
                <div className="section-eyebrow">流水线</div>
                <div className="mt-3 space-y-3">
                  {config.pipeline.map((step) => (
                    <div key={step.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#EAEEFB]">{step.label}</span>
                        <span className="text-[#8F9AB8]">{step.status}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full" style={{ width: `${step.progress}%`, background: `linear-gradient(90deg, ${config.accent}, ${config.accentSoft})` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Glass>
            </div>

            <div className="space-y-4">
              {tone !== 'rites' && (
                <>
                  <Glass color={config.accent} className="min-h-[560px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="section-eyebrow">Central Theater</div>
                        <h2 className="mt-1 font-serif text-[22px] text-[#F5E9C9]">{config.workbenchTitle}</h2>
                      </div>
                      <div className="rounded border border-white/10 px-3 py-1.5 font-mono text-[11px] text-[#9AA3C4]">SYNC 14:28:06</div>
                    </div>
                    <CentralRadar config={config} />
                    <div className="grid gap-3 md:grid-cols-3">
                      {config.workbenchItems.map((item) => (
                        <DepartmentModuleCard
                          key={item.title}
                          href="/tasks"
                          title={item.title}
                          subtitle={item.meta}
                          body={item.impact}
                          accent={config.accent}
                          titleColor={moduleTitleColor}
                          status="任务"
                          className="min-h-[130px]"
                        />
                      ))}
                    </div>
                  </Glass>

                  <Glass color={config.accent} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-black/25 px-4 py-3 text-[12px] text-[#C8CDD8]">{config.commandInput}</div>
                      <Link href="/court-briefing" className="rounded-md px-5 py-3 text-[12px] font-semibold text-[#061018]" style={{ background: `linear-gradient(135deg, ${config.accent}, ${config.accentSoft})` }}>下旨</Link>
                      <Link href="/archive" className="rounded-md border border-white/10 px-4 py-3 text-[12px] text-[#C8CDD8]">查旧案</Link>
                    </div>
                  </Glass>
                </>
              )}
            </div>

            <div className="space-y-4">
              <Glass color={config.accent} className="p-4">
                <div className="section-eyebrow">{config.rightTitle}</div>
                <div className="mt-3 space-y-3">
                  {config.rightItems.map((item, index) => (
                    <DepartmentModuleCard
                      key={item.title}
                      href="/intel"
                      title={item.title}
                      subtitle={item.meta}
                      body={item.impact}
                      accent={index === 0 ? '#F43F5E' : config.accent}
                      titleColor={index === 0 ? undefined : moduleTitleColor}
                      meta={`预警 0${index + 1}`}
                      status={index === 0 ? '高' : '监测'}
                      statusColor={index === 0 ? '#F43F5E' : config.accent}
                      className="min-h-[116px]"
                    />
                  ))}
                </div>
              </Glass>

              <Glass color={config.accent} className="p-4">
                <div className="section-eyebrow">跨部联动</div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {config.swarmInstances.slice(0, 4).map((dept) => {
                    const status = SWARM_STATUS_META[dept.status];
                    return (
                      <DepartmentModuleCard
                        key={dept.deptCode}
                        href="/departments"
                        title={dept.deptName}
                        subtitle={`${dept.taskCount} 项协同任务`}
                        body={dept.summary}
                        accent={dept.deptColor}
                        icon={dept.deptEmoji}
                        titleColor={dept.deptCode === 'market' ? moduleTitleColor : undefined}
                        status={status.label}
                        statusColor={status.color}
                        className="min-h-[96px]"
                      />
                    );
                  })}
                </div>
              </Glass>

              <Glass color={config.accent} className="p-4">
                <div className="section-eyebrow">今日结论</div>
                <div className="mt-3 rounded-md border border-[#F0C66A]/20 bg-[#F0C66A]/[0.06] p-3 text-[12px] leading-6 text-[#EADFBF]">
                  {tone === 'works'
                    ? '工部建议先锁定核心里程碑，再让户部确认预算、刑部核 API 合规，避免工程排期被口径变更反复击穿。'
                    : '礼部建议发布节奏跟随工部 Demo 节点，先铺核心叙事，再用锦衣卫信号校准舆情窗口。'}
                </div>
              </Glass>
            </div>
          </div>
        </div>
      </div>

      {/* 底部问责对话坞 — 工部/礼部分别用专用坞 */}
      {tone === 'works' ? <GongbuBottomDock /> : <LibuBottomDock overview={null} selectedCampaign={null} />}
    </main>
  );
}
