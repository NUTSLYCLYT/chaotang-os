/**
 * 通用「任意部门 → jiqun 蜂群」派发（融合方案骨架 · 2026-06-29）
 *
 * 把工部 PACK 样板泛化：任何部门的决策 → 经唯一 adapter → jiqun /api/swarm/run
 * (adapter 的 selectEntrySwarm 按关键词自动路由 legal/finance/... flow) → 真回执(LIVE_SWARM/FALLBACK)。
 * 铁律6：产线一个出口，全部门走这一个，不各写 fetch。铁律9：真算后端，本层只编排+诚实回传。
 * 铁律13.2：sourceLabel 取后端真回执，adapter 不可达→FALLBACK 诚实标，禁伪造 LIVE。
 */
import { createLiveSwarmAdapter } from './live-swarm-adapter-factory.ts';
import type { CourtLiveSwarmAdapter, CourtLiveAdapterDispatchInput } from './live-swarm-adapter.ts';
import type { SourceLabel } from '../types.ts';
import { DEPT_ENTRY_SWARM } from './dept-entry-swarm.ts';

// 部门码→entry_swarm 权威映射 SSOT 在 ./dept-entry-swarm(无依赖·client 可 import),此处 re-export 保持兼容。
export { DEPT_ENTRY_SWARM };

export interface DeptDispatchRequest {
  /** 部门码(gong_bu/xing_bu/hu_bu/...)。 */
  deptCode: string;
  /** 决策问题(原文;adapter 按关键词自动路由对应 flow)。 */
  question: string;
  /** 显式蜂群路由(不传则用 DEPT_ENTRY_SWARM[deptCode],再不中才由 adapter 关键词猜)。 */
  entrySwarm?: string;
  /** 显式蜂群 bundle(可选;不传则 adapter 自动选)。 */
  bundles?: string[];
  /** 证据绑定跑批(工部 feasibility 等需把 intelligence_pack/evidence_refs 传后端时用)。 */
  evidenceBoundRun?: CourtLiveAdapterDispatchInput['evidence_bound_run'];
  taskId?: string;
  userId?: string;
}

export interface DeptDispatchOutcome {
  ok: boolean;
  sourceLabel: SourceLabel;
  summary: string;
  findings: string[];
  missingCapabilities: string[];
  adapterState: string;
  /** 后端 session_id(收编绕桥路由时映射回各部 envelope 用)。 */
  sessionId?: string;
  /** 后端 trace_id(经 adapter 兑现核验)。 */
  traceId?: string;
  /** 是否通过兑现核验(sourceLabel===LIVE_SWARM 的等价诚实位)。 */
  verified: boolean;
}

/** 通用部门派发：任意部门决策 → jiqun 蜂群真算。纯编排，缺/不可达诚实降级。
 * adapter 可注入(默认 prod jiqun)，便于离线测试。 */
export async function dispatchDeptToSwarm(req: DeptDispatchRequest, adapterOverride?: CourtLiveSwarmAdapter): Promise<DeptDispatchOutcome> {
  const adapter = adapterOverride ?? createLiveSwarmAdapter();
  const cap = await adapter.capability();

  // task_id 进 HTTP header，必须 ASCII(根因已在 adapter encodeURIComponent 兜底，这里也给 ASCII)。
  const taskId = req.taskId ?? `dept-${req.deptCode}-${Date.now()}`;
  // 权威路由:显式参 > 部门码映射 > (undefined→adapter 关键词兜底)。
  const entrySwarm = req.entrySwarm ?? DEPT_ENTRY_SWARM[req.deptCode];

  try {
    const r = await adapter.dispatch({
      task_id: taskId,
      original_question: req.question,
      selected_departments: [req.deptCode],
      swarm_bundles: req.bundles ?? [],
      source_label: 'LIVE_SWARM',
      user_id: req.userId,
      ...(entrySwarm ? { entry_swarm: entrySwarm } : {}),
      ...(req.evidenceBoundRun ? { evidence_bound_run: req.evidenceBoundRun } : {}),
    });
    return {
      ok: r.ok,
      sourceLabel: r.source_label,
      summary: r.user_visible_summary,
      findings: r.findings,
      missingCapabilities: r.missing_capabilities,
      adapterState: cap.state,
      sessionId: r.external_session_id,
      traceId: r.trace_id,
      verified: r.source_label === 'LIVE_SWARM',
    };
  } catch (e) {
    return {
      ok: false,
      sourceLabel: 'FALLBACK',
      summary: `后端蜂群不可达，本次未真算(降级)：${e instanceof Error ? e.message.slice(0, 80) : ''}`,
      findings: [],
      missingCapabilities: ['dept_dispatch_failed'],
      adapterState: cap.state,
      verified: false,
    };
  }
}
