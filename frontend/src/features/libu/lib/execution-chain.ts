/**
 * 蜂群责任链（2026-06-29）
 *
 * 天才设计②：吏部司决策通过 → personnel_execution_swarm 把决策变成可执行 DRI/RACI 责任链。
 * 决策不是终点,蜂群把它变成"谁在什么时候做什么"。纯函数生成模板(真执行落后端蜂群,铁律9)。
 */
export type ChainKind = 'onboarding' | 'offboarding' | 'promotion';
export interface ChainStep { task: string; dri: string; raci: string; dueDays: number; }
export interface ExecutionChain { kind: ChainKind; title: string; steps: ChainStep[]; swarm: string; note: string; }
const TEMPLATES: Record<ChainKind, { title: string; steps: ChainStep[] }> = {
  onboarding: { title: '入职责任链', steps: [
    { task: '发录用通知+合同', dri: '人事司', raci: 'R:人事 A:吏部尚书', dueDays: 1 },
    { task: '入职手续+社保', dri: '人事司', raci: 'R:人事 C:户部', dueDays: 3 },
    { task: '岗前培训', dri: '用人部门', raci: 'R:用人部门 C:学政司', dueDays: 7 },
    { task: '试用期目标对齐(90天)', dri: '用人部门', raci: 'R:用人部门 A:考功司', dueDays: 7 },
    { task: '试用期跟进+转正评估', dri: '考功司', raci: 'R:考功 A:吏部尚书', dueDays: 90 },
  ]},
  offboarding: { title: '离职交接责任链', steps: [
    { task: '工作交接清单', dri: '用人部门', raci: 'R:离职人 A:部门负责人', dueDays: 3 },
    { task: '资产/权限回收', dri: '行政司', raci: 'R:行政 C:锦衣卫(权限审计)', dueDays: 1 },
    { task: '结算补偿+解除协议', dri: '人事司', raci: 'R:人事 C:户部 C:刑部', dueDays: 5 },
    { task: '离职面谈+经验归档', dri: '考功司', raci: 'R:考功 I:史馆', dueDays: 3 },
  ]},
  promotion: { title: '晋升责任链', steps: [
    { task: '晋升评估+校准', dri: '考功司', raci: 'R:考功 A:吏部尚书', dueDays: 5 },
    { task: '薪酬调整方案', dri: '薪酬司', raci: 'R:薪酬 C:户部', dueDays: 3 },
    { task: '宣布+职责交接', dri: '官制司', raci: 'R:官制 I:全员', dueDays: 7 },
  ]},
};
export function buildExecutionChain(kind: ChainKind, subject: string): ExecutionChain {
  const t = TEMPLATES[kind];
  return { kind, title: `${subject} · ${t.title}`, steps: t.steps, swarm: 'personnel_execution_swarm', note: `决策已通过 → 吏部执行蜂群生成 ${t.steps.length} 步责任链(每步有DRI+期限),真执行落蜂群` };
}
