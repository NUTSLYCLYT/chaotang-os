/**
 * 朝堂 OS · 御史总判 · 出口质门契约 (global_gate)
 *
 * 大神会审 2026-06-09(Bezos/Schneier/Kahneman/Deming/Grove · 5/5 有条件赞成)焊死的契约。
 * 落点:军机处「最终奏折」→ 史馆归档 之间的【强制咽喉】。
 *   archive() 第一行应 assertGatePassed(verdict),没过闸物理上写不进史馆。
 *
 * 与三省的边界:门下守入口(圣旨·执行前·准/驳/再议),御史守出口(奏折·执行后·本契约)。
 * 职责单向不重叠 —— 御史是出口闸,不是被尚书分派的部门。
 *
 * 位置:放在 governance 域(与 three-chamber-engine 同处),御史本属治理范畴、非全前端共享 SoT。
 * 下游从 '@/features/governance/lib/gate' import。待 SoT 可解锁后可议是否升入 lib/contracts。
 * SHADOW_CLIENT_GUARD_ONLY：本文件是客户端 fail-secure 辅助断言，不得作为后端御史正式裁决；
 * 正式结论只认 backend CourtReview/FinalMemorial quality gate。
 */

/** 证据指针类型(与既有 /swarm 证据等级体系对齐) */
export type EvidenceKind = 'claim' | 'command' | 'screenshot' | 'test' | 'real_data';

/** 御史机械推导的证据等级:L0 声明 → L1 命令 → L2 截图/日志 → L3 自动化测试 → L4 真实数据闭环 */
export type EvidenceLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** blast_radius —— 严厉度绑这里,不绑"是不是出口"(Bezos/Schneier;尚书省已在算此值) */
export type BlastRadius = 'internal' | 'external' | 'irreversible';

/** 御史三态判决 */
export type GateDecision = 'pass' | 'block' | 'needs_signoff';

/**
 * agent 提交的证据指针 —— 这是 agent **唯一能写**的东西。
 * 【铁律·会审 5/5 全票】此类型**刻意没有** evidenceLevel / verified 字段:
 * 等级不是被"授予"的,是御史核对实物后"数"出来的。agent 自评等级 = 裁判球员一体 = 橡皮图章。
 */
export interface AgentEvidencePointer {
  kind: EvidenceKind;
  /** 指向证据实物:测试路径 / 真实 row id / artifact hash / 命令 / 纯声称文本 */
  ref: string;
  /** 可选:一句说明(非定级) */
  note?: string;
}

/** 御史验证后的证据指针 —— 在 agent 指针上叠加御史的可复现核对结果 */
export interface VerifiedEvidencePointer extends AgentEvidencePointer {
  /** 御史核对:artifact 真存在 / hash 对得上 / 测试真 exit 0 ? */
  verified: boolean;
  /** 御史用什么方法核对的(可复现) */
  verifyMethod: string;
}

/**
 * agent → 御史 的提交体。agent 只交指针 + 自估 blast_radius(仅参考,御史可覆盖)。
 * 此体内**不存在等级字段** —— 这是"agent 无等级写权"在类型层的物理隔离。
 */
export interface AgentGateSubmission {
  /** 被审产出对象 id(奏折/memorial id) */
  memorialId: string;
  evidencePointers: AgentEvidencePointer[];
  proposedBlastRadius?: BlastRadius;
}

/**
 * 御史总判判决卡 (global_gate)。由御史产出,agent 对本结构**无写权**。
 *
 * 铁律:
 *  1. derivedEvidenceLevel 由御史核对 evidencePointers 推导(见 deriveEvidenceLevel);agent 纯声称封顶 L1。
 *  2. 严厉度绑 blastRadius:irreversible/external 证据不足 → needs_signoff/block(摩擦是功能);
 *     internal 可逆 → pass 但标 unverified 留痕。
 *  3. fail-secure:证据缺失/拿不准 → 默认 needs_signoff,严禁 ?? pass。
 *  4. 验收尺(Grove):18 个月拿不出"御史真拦下过一次该拦的高危"→ 这道闸该砍。
 */
export interface GateVerdict {
  memorialId: string;
  decision: GateDecision;
  /** 御史核对推导的等级,agent 无写权 */
  derivedEvidenceLevel: EvidenceLevel;
  evidencePointers: VerifiedEvidencePointer[];
  blastRadius: BlastRadius;
  reason: string;
  /** needs_signoff 时:还缺哪些证据(verified=false,前端列灰 + 一键补证) */
  missingEvidence?: VerifiedEvidencePointer[];
  /** needs_signoff → 陛下朱批后填(责任签名) */
  signoff?: { actor: string; at: string; note?: string };
  decidedAt: string;
}

/** 证据种类 → 等级 排序(real_data 最高,沿用既有 /swarm 体系) */
const EVIDENCE_RANK: Record<EvidenceKind, EvidenceLevel> = {
  claim: 'L0',
  command: 'L1',
  screenshot: 'L2',
  test: 'L3',
  real_data: 'L4',
};

const LEVEL_ORDER: EvidenceLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

/**
 * 御史机械推导证据等级:只数 **verified=true** 的硬证据,取最高;agent 声明权重为零。
 * 没有任何已验证证据 → L0。这是把"等级谁定"从 agent 手里夺走的核心函数。
 */
export function deriveEvidenceLevel(pointers: VerifiedEvidencePointer[]): EvidenceLevel {
  return pointers
    .filter((p) => p.verified)
    .map((p) => EVIDENCE_RANK[p.kind])
    .reduce<EvidenceLevel>(
      (max, lvl) => (LEVEL_ORDER.indexOf(lvl) > LEVEL_ORDER.indexOf(max) ? lvl : max),
      'L0',
    );
}

/**
 * fail-secure 非对称裁决:严厉度绑 blastRadius,不绑"出口"。
 *  - irreversible(不可逆·烧钱·客户/合规):需 L3+,否则 needs_signoff(默认挡下要签字)。
 *  - external(对外可见):需 L2+,否则 needs_signoff。
 *  - internal(可逆·内部):放行(UI 应标 unverified 留痕),不卡用户。
 * 证据不足一律默认 needs_signoff —— 绝不 pass(严禁 ?? pass)。
 */
export function defaultGateDecision(level: EvidenceLevel, blast: BlastRadius): GateDecision {
  const lvl = LEVEL_ORDER.indexOf(level);
  if (blast === 'irreversible') return lvl >= LEVEL_ORDER.indexOf('L3') ? 'pass' : 'needs_signoff';
  if (blast === 'external') return lvl >= LEVEL_ORDER.indexOf('L2') ? 'pass' : 'needs_signoff';
  return 'pass';
}

/**
 * 史馆写入前置断言 —— 没过闸不许归档(物理咽喉)。
 * ⚠️ 真正的强制点在后端 jiqun_ai 的 archive();此处是前端共享的同款断言,供 BFF/前端复用。
 */
export function assertGatePassed(verdict: GateVerdict | null | undefined): asserts verdict is GateVerdict {
  if (!verdict) throw new Error('[御史] 无总判判决卡:奏折未过出口质门,禁止归档史馆');
  if (verdict.decision === 'block') throw new Error(`[御史] 阻断:${verdict.reason}`);
  if (verdict.decision === 'needs_signoff' && !verdict.signoff) {
    throw new Error('[御史] 需陛下朱批签字后方可归档(fail-secure)');
  }
}
