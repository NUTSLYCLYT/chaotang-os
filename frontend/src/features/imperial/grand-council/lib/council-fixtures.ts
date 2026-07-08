export const COUNCIL_DISCUSSIONS = [
  { speaker: '丞相', tone: '#F0C66A', content: '先收敛当前争议：是否先批执行，还是先补合规边界。' },
  { speaker: '兵部', tone: '#6BA0FF', content: '若继续等待，将丢失当前窗口，建议先行推进试探。' },
  { speaker: '刑部', tone: '#F43F5E', content: '合规边界仍不完整，未经补齐不宜直接放量执行。' },
  { speaker: '户部', tone: '#3DD68C', content: '现金流可支撑局部推进，但不支持大规模扩投。' },
  { speaker: '丞相', tone: '#F0C66A', content: '形成临时结论：局部放行，主链留待会签完成后再批。' },
] as const;

export const COUNCIL_CONFLICTS = [
  { title: '兵部 vs 刑部', body: '一方主张抢窗口，一方要求先补边界说明。', severity: 'high' },
  { title: '户部', body: '只支持局部预算投放，不支持全面扩张。', severity: 'medium' },
  { title: '工部', body: '执行链已可试探，但需要更窄的试点范围。', severity: 'low' },
] as const;

export const COUNCIL_ACTIONS = [
  '先完成会签，再进入御批',
  '若要加速推进，先去兵部或工部确认执行链',
  '若风险仍高，先回上书房重读奏章与批注',
] as const;

export const COUNCIL_WAIT_CHAIN = [
  '等待刑部补齐合规边界摘要',
  '等待工部确认局部试点的交付窗口',
  '等待丞相将分歧收敛成正式呈报',
] as const;
