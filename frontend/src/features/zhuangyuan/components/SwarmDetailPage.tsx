'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { StatusChip } from '@/components/ui/status-chip';

interface SwarmConfig {
  id: string;
  label: string;
  shortLabel: string;
  emoji: string;
  summary: string;
  description: string;
  capabilities: string[];
  color: string;
  typicalWork: string[];
  cooperation: string[];
  responsibleFor: string[];
}

const SWARM_CONFIGS: Record<string, SwarmConfig> = {
  'intel': {
    id: 'intel',
    label: '锦衣卫情报蜂群',
    shortLabel: '情',
    emoji: '🕵️',
    summary: '承接外部情报、风险信号、经营线索',
    description: '锦衣卫情报蜂群是朝堂的耳目，负责收集外部信号、识别风险热点、发现经营线索，并快速将情报转化为可执行的议题。',
    capabilities: [
      '外部情报收集与汇总',
      '风险信号识别与预警',
      '经营线索发现与评估',
      '情报优先级排序',
      '多源情报交叉验证',
    ],
    color: '#D9A85B',
    typicalWork: [
      '监测市场动态与竞争信号',
      '识别政策变化与监管风向',
      '发现潜在商机与合作机会',
      '预警供应链风险与合规问题',
    ],
    cooperation: ['丞相台', '军机会审', '史馆归档蜂群'],
    responsibleFor: ['情报质量', '信号真实性', '线索时效性'],
  },
  'archive': {
    id: 'archive',
    label: '史馆归档蜂群',
    shortLabel: '史',
    emoji: '📚',
    summary: '承接旧案召回、经验复盘、回写归档',
    description: '史馆归档蜂群是朝堂的记忆，负责沉淀历史经验、回写执行结果、召回旧案参考，让每次决策都站在前人的肩膀上。',
    capabilities: [
      '历史案件召回与检索',
      '执行结果统一归档',
      '经验复盘与知识沉淀',
      '专题知识包整理',
      '知识综合与复用',
    ],
    color: '#E6BC70',
    typicalWork: [
      '按 trace 链回写执行结果',
      '整理专题 source pack',
      '提供历史案例参考',
      '沉淀决策模板与最佳实践',
    ],
    cooperation: ['各业务庄园', '丞相台', '锦衣卫情报蜂群'],
    responsibleFor: ['归档完整性', '知识可检索性', '经验复用性'],
  },
  'api': {
    id: 'api',
    label: '外部接口蜂群',
    shortLabel: '外',
    emoji: '🔌',
    summary: '承接外部系统、接口和数据入口',
    description: '外部接口蜂群是朝堂与外部系统的桥梁，负责连接第三方服务、同步外部数据、提供 API 接入，确保数据流动的安全与可控。',
    capabilities: [
      '外部系统集成与连接',
      'API 接口管理与调度',
      '数据同步与格式转换',
      '接口安全与权限控制',
      '外部服务状态监控',
    ],
    color: '#D9A85B',
    typicalWork: [
      '同步 CRM 客户数据',
      '接入第三方支付系统',
      '获取市场数据与行情',
      '推送回写结果到业务系统',
    ],
    cooperation: ['工部', '刑部', '各业务庄园'],
    responsibleFor: ['接口稳定性', '数据一致性', '接入安全性'],
  },
  'swarm-command': {
    id: 'swarm-command',
    label: '蜂群总控',
    shortLabel: '总',
    emoji: '🎯',
    summary: '负责统一调度蜂群执行',
    description: '蜂群总控是庄园的指挥中心，负责协调各蜂群资源、分配任务优先级、监控执行状态、确保整体目标一致。',
    capabilities: [
      '蜂群资源统一调度',
      '任务优先级分配',
      '执行状态全局监控',
      '瓶颈识别与资源调配',
      '目标对齐与进度协调',
    ],
    color: '#E6BC70',
    typicalWork: [
      '分配任务给合适的蜂群',
      '协调多蜂群联合作业',
      '监控全局执行进度',
      '调整资源分配策略',
    ],
    cooperation: ['丞相调度', '军机会审', '六部蜂群'],
    responsibleFor: ['调度效率', '资源利用率', '目标达成率'],
  },
  'prime-dispatch': {
    id: 'prime-dispatch',
    label: '丞相调度',
    shortLabel: '相',
    emoji: '👑',
    summary: '负责把分散任务收敛成可执行判断',
    description: '丞相调度是庄园的决策核心，负责将分散的信号与争议收敛为清晰的可执行判断，确保执行方向一致。',
    capabilities: [
      '多源信号收敛与整合',
      '争议仲裁与决策定调',
      '优先级排序与资源分配',
      '执行边界与约束定义',
      '决策质量与风险评估',
    ],
    color: '#F3CF8C',
    typicalWork: [
      '将多个争议收敛为单一议题',
      '定调资源优先级与分配策略',
      '明确执行边界与红线',
      '仲裁部门间的冲突',
    ],
    cooperation: ['蜂群总控', '军机会审', '六部'],
    responsibleFor: ['决策质量', '收敛效率', '方向一致性'],
  },
  'war-room': {
    id: 'war-room',
    label: '军机会审',
    shortLabel: '审',
    emoji: '⚔️',
    summary: '负责多方会审、争议处理和执行边界确认',
    description: '军机会审是庄园的质量保障，通过多方会审确保决策的严谨性，明确执行边界与风险红线。',
    capabilities: [
      '多方专家会审',
      '红队/蓝队对抗审查',
      '执行边界确认',
      '风险识别与 mitigation',
      '质量标准与验收准则',
    ],
    color: '#E6BC70',
    typicalWork: [
      '组织多部门联合评审',
      '红队挑战方案假设',
      '蓝队完善执行细节',
      '明确合规与风控边界',
    ],
    cooperation: ['丞相调度', '刑部', '礼部'],
    responsibleFor: ['决策严谨性', '边界清晰度', '风险可控性'],
  },
  'hubu': {
    id: 'hubu',
    label: '户部蜂群',
    shortLabel: '户',
    emoji: '💰',
    summary: '围绕财务、预算、资金、ROI 等能力承接任务',
    description: '户部蜂群是庄园的财务管家，负责资金管理、预算规划、财务测算、ROI 分析，确保经营决策的财务可行性。',
    capabilities: [
      '财务测算与预算规划',
      '资金管理与现金流预测',
      'ROI 与投资回报分析',
      '成本优化与费用控制',
      '财务风险识别与预警',
    ],
    color: '#6BA0FF',
    typicalWork: [
      '测算项目投资回报',
      '管理现金流与资金缺口',
      '优化成本结构与预算分配',
      '评估商机的财务可行性',
    ],
    cooperation: ['销售庄园', '电商庄园', '丞相台'],
    responsibleFor: ['财务健康', '资金安全', 'ROI 达成'],
  },
  'libu': {
    id: 'libu',
    label: '吏部蜂群',
    shortLabel: '吏',
    emoji: '👥',
    summary: '围绕组织、人才、招聘、责任链等能力承接任务',
    description: '吏部蜂群是庄园的组织专家，负责组织架构、人才发展、招聘配置、责任链设计，确保组织能力支撑业务目标。',
    capabilities: [
      '组织架构设计与优化',
      '人才招聘与配置',
      '培训发展与能力建设',
      '绩效评估与激励机制',
      '责任链与协作流程设计',
    ],
    color: '#5FB37A',
    typicalWork: [
      '设计支撑业务的组织架构',
      '招聘关键岗位人才',
      '建立能力发展路径',
      '明确岗位职责与协作边界',
    ],
    cooperation: ['人事庄园', '丞相台', '礼部'],
    responsibleFor: ['组织能力', '人才质量', '协作效率'],
  },
  'libu2': {
    id: 'libu2',
    label: '礼部蜂群',
    shortLabel: '礼',
    emoji: '📢',
    summary: '围绕品牌、对外口径、客户沟通、传播门禁承接任务',
    description: '礼部蜂群是庄园的品牌大使，负责品牌管理、对外沟通、内容创作、传播策略，确保对外表达一致且有影响力。',
    capabilities: [
      '品牌定位与管理',
      '对外口径统一与文案创作',
      '客户沟通与话术优化',
      '传播策略与内容分发',
      '传播门禁与风险控制',
    ],
    color: '#D9A85B',
    typicalWork: [
      '统一品牌对外表达',
      '创作营销文案与内容',
      '优化客户沟通话术',
      '控制过度承诺与传播风险',
    ],
    cooperation: ['营销庄园', '销售庄园', '刑部'],
    responsibleFor: ['品牌一致性', '沟通有效性', '传播安全性'],
  },
  'bingbu': {
    id: 'bingbu',
    label: '兵部蜂群',
    shortLabel: '兵',
    emoji: '⚔️',
    summary: '围绕竞争、销售、战役、增长等能力承接任务',
    description: '兵部蜂群是庄园的增长引擎，负责销售推进、竞争策略、战役组织、增长加速，直接推动业务结果的达成。',
    capabilities: [
      '销售线索推进与成交',
      '竞争分析与应对策略',
      '战役组织与执行',
      '增长机会识别与验证',
      '谈判策略与节奏把控',
    ],
    color: '#FB7185',
    typicalWork: [
      '推进高价值线索成交',
      '组织销售战役与活动',
      '制定竞争应对策略',
      '把控谈判节奏与承诺边界',
    ],
    cooperation: ['销售庄园', '户部', '礼部'],
    responsibleFor: ['销售业绩', '增长目标', '市场份额'],
  },
  'xingbu': {
    id: 'xingbu',
    label: '刑部蜂群',
    shortLabel: '刑',
    emoji: '⚖️',
    summary: '围绕合同、法务、合规、风控、授权承接任务',
    description: '刑部蜂群是庄园的守护屏障，负责合同审查、法务支持、合规检查、风险控制、授权管理，确保经营活动合法合规。',
    capabilities: [
      '合同审查与法务支持',
      '合规检查与制度落地',
      '风险识别与控制',
      '授权管理与权限设计',
      '争议处理与证据整理',
    ],
    color: '#A855F7',
    typicalWork: [
      '审查业务合同与协议',
      '进行合规性检查',
      '识别并控制经营风险',
      '处理法律争议与问题',
    ],
    cooperation: ['法务庄园', '军机会审', '工部'],
    responsibleFor: ['合规性', '风险可控', '法务安全'],
  },
  'gongbu': {
    id: 'gongbu',
    label: '工部蜂群',
    shortLabel: '工',
    emoji: '🔧',
    summary: '围绕研发、交付、供应链、质量门承接任务',
    description: '工部蜂群是庄园的技术后盾，负责研发交付、供应链管理、质量保障、工程执行，将业务方案转化为可落地的产品与服务。',
    capabilities: [
      '产品研发与技术交付',
      '供应链管理与优化',
      '质量保障与质量门把控',
      '工程执行与变更管理',
      '技术架构与基础设施',
    ],
    color: '#22D3EE',
    typicalWork: [
      '交付产品功能与服务',
      '管理供应链与供应商',
      '把控产品质量与交付标准',
      '执行工程变更与优化',
    ],
    cooperation: ['运营庄园', '营销庄园', '刑部'],
    responsibleFor: ['交付质量', '工程效率', '系统稳定性'],
  },
};

function CapabilityCard({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        background: `${color}10`,
        border: `1px solid ${color}28`,
        fontSize: 11,
        color: '#F5E9C9',
        lineHeight: 1.4,
      }}
    >
      {text}
    </div>
  );
}

function TimelineNode({ title, detail, owner, state, at }: any) {
  const stateColors: Record<string, string> = {
    'running': '#6BA0FF',
    'completed': '#5FB37A',
    'assigned': '#F0C66A',
    'waiting_dependency': '#FB923C',
    'idle': '#4A5272',
  };

  const stateLabels: Record<string, string> = {
    'running': '在跑',
    'completed': '已结',
    'assigned': '待命',
    'waiting_dependency': '待依赖',
    'idle': '空闲',
  };

  const currentColor = stateColors[state] || '#4A5272';
  const currentLabel = stateLabels[state] || state;

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: currentColor,
            boxShadow: `0 0 0 3px ${currentColor}22`,
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#F5E9C9', fontFamily: 'var(--font-serif)' }}>
            {title}
          </span>
          <span
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 3,
              border: `1px solid ${currentColor}55`,
              color: currentColor,
              background: `${currentColor}10`,
            }}
          >
            {currentLabel}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#6A7299', lineHeight: 1.5, marginBottom: 2 }}>
          {detail}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#4A5272' }}>
          <span>负责：{owner}</span>
          <span>时间：{at}</span>
        </div>
      </div>
    </div>
  );
}

export default function SwarmDetailPage({ swarmId }: { swarmId: string }) {
  const config = SWARM_CONFIGS[swarmId];
  
  if (!config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6A7299' }}>
        蜂群不存在
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      overflowY: 'auto', 
      padding: '24px',
      maxWidth: '1200px', 
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#6A7299' }}>
        <Link href="/zhuanshu" style={{ color: '#F0C66A', textDecoration: 'none' }}>专署</Link>
        <span>/</span>
        <span style={{ color: '#F5E9C9' }}>{config.label}</span>
      </div>

      <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: `radial-gradient(circle at 30% 30%, ${config.color}, ${config.color}44)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              boxShadow: `0 0 24px ${config.color}33`,
            }}
          >
            {config.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: config.color, textTransform: 'uppercase', marginBottom: 4 }}>
              SWARM · 蜂群
            </div>
            <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)', color: '#F5E9C9', fontWeight: 600, marginBottom: 6 }}>
              {config.label}
            </h1>
            <p style={{ fontSize: 13, color: '#C6BB9D', lineHeight: 1.6 }}>
              {config.summary}
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#D9CFB4', lineHeight: 1.8, marginBottom: 24 }}>
          {config.description}
        </p>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: config.color, textTransform: 'uppercase', marginBottom: 10 }}>
            核心能力
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {config.capabilities.map((cap, i) => (
              <CapabilityCard key={i} text={cap} color={config.color} />
            ))}
          </div>
        </div>
      </GlassPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
        <GlassPanel variant="default" tone="elevated" padding="md">
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#6BA0FF', textTransform: 'uppercase', marginBottom: 12 }}>
            典型工作
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.typicalWork.map((work, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, color: config.color }}>•</span>
                <span style={{ fontSize: 12, color: '#C6BB9D', lineHeight: 1.5 }}>{work}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel variant="gold" tone="elevated" padding="md">
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#F0C66A', textTransform: 'uppercase', marginBottom: 12 }}>
            协作方
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {config.cooperation.map((partner, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  background: 'rgba(240,198,106,0.08)',
                  border: '1px solid rgba(240,198,106,0.25)',
                  fontSize: 11,
                  color: '#F5E9C9',
                }}
              >
                {partner}
              </span>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel variant="success" tone="elevated" padding="md">
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#5FB37A', textTransform: 'uppercase', marginBottom: 12 }}>
            负责事项
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.responsibleFor.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#5FB37A' }}>✓</span>
                <span style={{ fontSize: 12, color: '#C6BB9D' }}>{item}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel variant="default" tone="deep" padding="lg" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#6BA0FF', textTransform: 'uppercase', marginBottom: 4 }}>
              EXECUTION TIMELINE · 执行时序
            </div>
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color: '#F5E9C9', fontWeight: 600 }}>
              执行流程示例
            </h2>
          </div>
          <StatusChip state="running" label="示例流程" />
        </div>

        <div style={{ paddingLeft: 6 }}>
          <TimelineNode
            title="情报收集"
            detail="锦衣卫情报蜂群收集外部信号与线索"
            owner="锦衣卫情报蜂群"
            state="completed"
            at="辰时"
          />
          <TimelineNode
            title="决策定调"
            detail="丞相调度将信号收敛为可执行议题"
            owner="丞相调度"
            state="running"
            at="巳时"
          />
          <TimelineNode
            title="会审确认"
            detail="军机会审确认执行边界与风险"
            owner="军机会审"
            state="assigned"
            at="午时"
          />
          <TimelineNode
            title="蜂群执行"
            detail={`${config.label}执行具体任务`}
            owner={config.label}
            state="assigned"
            at="未时"
          />
          <TimelineNode
            title="结果归档"
            detail="史馆归档蜂群回写执行结果并沉淀经验"
            owner="史馆归档蜂群"
            state="assigned"
            at="酉时"
          />
        </div>
      </GlassPanel>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Link
          href="/zhuanshu"
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(240,198,106,0.35)',
            color: '#F0C66A',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          返回庄园
        </Link>
        <button
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #F0C66A, #D9A85B)',
            border: 'none',
            color: '#1a1406',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          下旨给此蜂群
        </button>
      </div>
    </div>
  );
}
