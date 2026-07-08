/**
 * upstreams.ts — 唯一上游真相源（2026-06-24 · 融合地基 / 铁律2 SSOT）。
 *
 * 全仓**服务端**上游 URL 只从这里取。禁任何文件再写裸端口(`:8081/:4000/:3000/:18003`)
 * 或裸 `process.env.{JIQUN_API_URL,COURTOS_API_URL,...}`——`guard:upstreams` 守这条。
 *
 * 本会话审计结论:三真上游 + 一遗物。
 *   - 三真:SWARM_BACKEND(jiqun 产线执行) / LLM_GATEWAY(咨询 LLM) / LEGAL_AGENT(法务专用)。
 *   - 一遗物:COURTOS_LEGACY —— 前端≠courtos 时代的独立后端,死链居多,经 courtosFetch 熔断兜底,
 *     逐路由迁本地 SoT 后删除,新代码**禁新增依赖**。
 *
 * 融合定位(见 docs/TOPOLOGY.md):咨询阶段 → LLM_GATEWAY;执行阶段(圣裁采纳产线动作后)→ SWARM_BACKEND;
 * 两者都应经唯一调度 AgentHarness,脊不直连。客户端暴露的 NEXT_PUBLIC_* URL 属客户端配置,不在本服务端模块。
 */

/** 真蜂群:产线多 agent 执行后端(jiqun)。仅服务端。融合中"执行阶段"经 AgentHarness 调它。 */
export const SWARM_BACKEND =
  process.env.JIQUN_API_URL ?? process.env.JIQUN_BASE_URL ?? 'http://127.0.0.1:8081';

/** LLM 网关:本机 LiteLLM(:4444/v1 → Claude via OAuth) 或直连 OpenAI。融合中"咨询阶段"经此。 */
export const LLM_GATEWAY = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

/** 法务专用 agent provider(非幽灵,是真专用上游)。仅服务端。 */
export const LEGAL_AGENT = process.env.LEGAL_AGENT_BASE_URL ?? 'http://127.0.0.1:18003';

/**
 * ⚠️ 遗物·待拆：courtos 旧独立后端(:3000/:4000)。死链居多——调用务必经 `courtosFetch`(熔断快失败 + 本地兜底),
 * 绝不裸 fetch 吃满超时。逐路由迁本地 SoT / 诚实空态后删除本常量。**新代码禁新增依赖**(guard:upstreams 守)。
 */
export const COURTOS_LEGACY =
  process.env.COURTOS_API_URL ?? process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000/api';

/**
 * courtos 遗物是否「显式配置」(env 真设了)。供路由保留"未配置 → 503 诚实"语义:
 * `if (!COURTOS_LEGACY_CONFIGURED) return 503`。区别于 COURTOS_LEGACY(总有默认值)。
 */
export const COURTOS_LEGACY_CONFIGURED = Boolean(
  process.env.COURTOS_API_URL ?? process.env.INTERNAL_API_URL,
);

export interface UpstreamInfo {
  key: string;
  url: string;
  role: string;
  status: 'real' | 'legacy';
}

/** 上游清单(健康检查 / 拓扑展示用)。 */
export const UPSTREAMS: ReadonlyArray<UpstreamInfo> = [
  { key: 'SWARM_BACKEND', url: SWARM_BACKEND, role: '真蜂群·产线执行(jiqun)', status: 'real' },
  { key: 'LLM_GATEWAY', url: LLM_GATEWAY, role: 'LLM 网关·咨询(LiteLLM/OpenAI)', status: 'real' },
  { key: 'LEGAL_AGENT', url: LEGAL_AGENT, role: '法务专用 agent', status: 'real' },
  { key: 'COURTOS_LEGACY', url: COURTOS_LEGACY, role: '⚠️ 遗物·待拆(逐路由迁本地 SoT)', status: 'legacy' },
];
