/**
 * dept-agent-meta —— 部门单 agent 的【展示元数据】（client 安全，无 server 依赖）。
 *
 * 决定哪些部门挂"问责坞"以及其外观/话术。agent 业务逻辑（role/buildContext/调大脑）在
 * server 侧 dept-registry.ts；这里只放 UI 用得到的纯数据，避免把 server 代码拉进 client bundle。
 */

export interface DeptAgentMeta {
  name: string; // 坞身份，如 "兵部尚书 · 战情台"
  title: string; // 英文副标题
  emoji: string; // 坞头像
  accent: string; // 部门主色
  greeting: string; // 开场白
  quickPrompts: string[];
}

export const DEPT_AGENT_META: Record<string, DeptAgentMeta> = {
  ops: {
    name: '兵部尚书 · 战情台',
    title: 'Operations Ministry · 兵部',
    emoji: '⚔️',
    accent: '#6BA0FF',
    greeting:
      '臣兵部尚书恭请陛下示下。运营指标/风险/在办任务已核账，可询攻守取舍——臣必附数据依据与冲突声明。',
    quickPrompts: [
      '当前最大的运营风险是什么？该先处置哪个？',
      '在办任务里哪个最该加资源、哪个该砍？',
      '综合指标看，我方该攻还是该守？给数据。',
      '未来一段最该警惕的一个风险，为什么？',
    ],
  },
  legal: {
    name: '刑部尚书 · 律法台',
    title: 'Justice Ministry · 刑部',
    emoji: '⚖️',
    accent: '#3DD68C',
    greeting:
      '臣刑部尚书恭请陛下示下。在办案件/合规积压/风险已核账，可询裁断取舍——臣必附数据依据与冲突声明。',
    quickPrompts: [
      '当前最该优先处置的合规风险是哪一个？为什么？',
      '在办案件里哪个最紧迫、该先结？给数据。',
      '合规审查积压会不会拖垮审限？怎么办？',
      '未来一段最该警惕的一个法务风险，为什么？',
    ],
  },
  hr: {
    name: '人和部尚书 · 组织台',
    title: 'People Ministry · 人和部',
    emoji: '🧭', // 罗盘——照系统方向，不是判人的天平
    accent: '#C070D0',
    greeting:
      '臣人和部尚书恭请陛下示下。臣只照【系统】、绝不判【人】——离职/冲突/目标对齐的系统信号已核账，可询"哪段系统在伤人"。判人是陛下与活人用良心扛的责任，臣不敢代。',
    quickPrompts: [
      '哪个团队离职率冲出控制限？是系统出了什么问题？',
      '哪段流程交接在反复制造人事冲突？',
      '哪些岗位目标定义不清，绩效无法归因到系统还是个人？',
      '组织里哪些位置开始把"自我维持"当主业、脱离了客户？',
    ],
  },
  guard: {
    name: '锦衣卫指挥使 · 情报台',
    title: 'Imperial Guard · 锦衣卫',
    emoji: '🛰',
    accent: '#FB923C',
    greeting:
      '臣锦衣卫指挥使恭请陛下示下。全球情报态势/风险预警/重点监测目标已核账，可询情报取舍——臣必附数据依据与冲突声明。',
    quickPrompts: [
      '当前最该优先处置的情报风险是哪一个？为什么？',
      '全球哪个节点的信号最异常？该启动什么预案？',
      '监测目标里哪个已逼近红线？给证据链。',
      '情报类型分布是否健康？缺哪一类情报？',
    ],
  },
  works: {
    name: '工部尚书 · 营造台',
    title: 'Works Ministry · 工部',
    emoji: '🔧',
    accent: '#6BA0FF',
    greeting:
      '臣工部尚书恭请陛下示下。蜂群建设台账（已上线/吃种子/空壳）已核账，可询建设排期——下一步该建哪些蜂群、先建哪个，臣必附数据依据与冲突声明。',
    quickPrompts: [
      '下一步该建哪些蜂群？先建哪个？给数据依据。',
      '哪个空壳最该先填或砍？为什么？',
      '吃种子的部门该不该先接真实数据源？',
      '若只能再建一个蜂群，建哪个 ROI 最高？',
    ],
  },
  market: {
    name: '礼部尚书 · 品牌台',
    title: 'Rites Ministry · 礼部',
    emoji: '🎐',
    accent: '#D4A84B',
    greeting:
      '臣礼部尚书恭请陛下示下。品牌口径/战役排期/舆情边界已核账，可询品牌取舍——臣只就【策略与口径】进言，绝不臆造声量/转化等需真实监听才有的测量数字；结论必附依据与风险。',
    quickPrompts: [
      '当前最该推进的一个品牌战役是哪个？为什么？',
      '海外舆情风险该先定哪条回应口径？',
      '若只能聚焦一个品牌动作，做哪个杠杆最高？',
      '哪条内容/战役该缓或砍？给依据。',
    ],
  },
};

export const AGENT_DEPT_CODES = Object.keys(DEPT_AGENT_META);

export function hasDeptAgent(code: string): boolean {
  return code in DEPT_AGENT_META;
}
