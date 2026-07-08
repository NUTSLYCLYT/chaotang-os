/**
 * Ported from Harness Kingdom OS:
 *   src/domains/platform/models/{index,departments}.ts  @ 2026-04-18
 * Pure TS — zero UI deps.
 */

export type DepartmentCode =
  | 'prime_minister'
  | 'libu'
  | 'hubu'
  | 'libu_rites'
  | 'bingbu'
  | 'xingbu'
  | 'gongbu'
  | 'jinyiwei'
  | 'qintianjian'
  | 'taiyiyuan'
  | 'shiguan'

export type DepartmentLayer = 'hub' | 'ministry' | 'agency'

export interface DepartmentInfo {
  code: DepartmentCode
  name: string
  title: string
  description: string
  layer: DepartmentLayer
  /** 主题色 (hex) */
  color: string
  /** Icon name — Harness 侧为 AntD icon，V2 侧需映射到 lucide */
  icon: string
}


export const DEPARTMENTS: DepartmentInfo[] = [
  // ── 枢纽层 ──
  {
    code: 'prime_minister',
    name: '丞相',
    title: 'Prime Minister',
    description: '任务理解、分解、调度、依赖管理、汇总、驳回',
    layer: 'hub',
    color: '#D4AF37',
    icon: 'CrownOutlined',
  },
  {
    code: 'shiguan',
    name: '史馆',
    title: 'Archive',
    description: '记忆、审计、复盘、召回、偏好沉淀',
    layer: 'hub',
    color: '#8B7355',
    icon: 'BookOutlined',
  },
  // ── 六部执行层 ──
  {
    code: 'libu',
    name: '吏部',
    title: 'Ministry of Personnel',
    description: '人事组织与治理',
    layer: 'ministry',
    color: '#7B68EE',
    icon: 'TeamOutlined',
  },
  {
    code: 'hubu',
    name: '户部',
    title: 'Ministry of Revenue',
    description: '运营、销售、财务、库存、预算',
    layer: 'ministry',
    color: '#2E8B57',
    icon: 'DollarOutlined',
  },
  {
    code: 'libu_rites',
    name: '礼部',
    title: 'Ministry of Rites',
    description: '品牌、营销、传播、高管表达',
    layer: 'ministry',
    color: '#CD5C5C',
    icon: 'GiftOutlined',
  },
  {
    code: 'bingbu',
    name: '兵部',
    title: 'Ministry of War',
    description: '竞对、战略、攻防、市场切入',
    layer: 'ministry',
    color: '#B22222',
    icon: 'ThunderboltOutlined',
  },
  {
    code: 'xingbu',
    name: '刑部',
    title: 'Ministry of Justice',
    description: '制度、合规、内控、治理',
    layer: 'ministry',
    color: '#4682B4',
    icon: 'SafetyOutlined',
  },
  {
    code: 'gongbu',
    name: '工部',
    title: 'Ministry of Works',
    description: '产品、技术、工程交付',
    layer: 'ministry',
    color: '#FF8C00',
    icon: 'ToolOutlined',
  },
  // ── 高价值专署层 ──
  {
    code: 'jinyiwei',
    name: '锦衣卫',
    title: 'Secret Police',
    description: '全球信息采集、机会捕获、风险预警、政策监控',
    layer: 'agency',
    color: '#8B0000',
    icon: 'EyeOutlined',
  },
  {
    code: 'qintianjian',
    name: '钦天监',
    title: 'Observatory',
    description: '未来预测、场景模拟、风险窗口识别',
    layer: 'agency',
    color: '#483D8B',
    icon: 'CompassOutlined',
  },
  {
    code: 'taiyiyuan',
    name: '太医院',
    title: 'Imperial Medical Bureau',
    description: '健康管理、医疗信息查询、体检解读、风险分层',
    layer: 'agency',
    color: '#006400',
    icon: 'MedicineBoxOutlined',
  },
]

export const getDepartment = (code: string): DepartmentInfo | undefined =>
  DEPARTMENTS.find(d => d.code === code)
