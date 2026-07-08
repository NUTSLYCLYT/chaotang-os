/**
 * 大神镜片融合（2026-06-29）
 *
 * 天才设计④(skill融合):把已有大神视角 skill 融进吏部每个决策——按决策类型挂对的镜片。
 * 不造新skill,复用 expert-perspective。纯函数返回该戴哪些镜片+警示焦点。
 */
export type LibuDecisionType = 'termination' | 'hiring' | 'compensation' | 'equity' | 'org_design' | 'promotion' | 'general';
export interface AdvisorLens { experts: string[]; focus: string; }
const LENS: Record<LibuDecisionType, AdvisorLens> = {
  termination: { experts: ['schneier', 'bezos'], focus: '不可逆法律雷:违法解除赔2N、仲裁、证据链——辞前必看' },
  hiring: { experts: ['dalio', 'munger'], focus: '可信度加权+逆向:这人推荐来源可信吗?最坏情况养不起吗?' },
  compensation: { experts: ['deming'], focus: '公平与数据:让钱流向绩优低薪,别凭感觉调' },
  equity: { experts: ['bezos', 'taleb'], focus: '单向门+尾部:期权=不可逆股权,控制权别轻给,设回购防黑天鹅' },
  org_design: { experts: ['dalio', 'drucker'], focus: '可信度加权+组织:责任清晰RACI,谁负责下一步' },
  promotion: { experts: ['deming', 'dalio'], focus: '凭绩效数据非印象,沉淀谁判断准' },
  general: { experts: ['dalio'], focus: '人与组织决策:可信度加权' },
};
export function adviseLens(type: LibuDecisionType): AdvisorLens { return LENS[type]; }
