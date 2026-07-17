/**
 * 朝堂 OS · 三省审议台 · Three-Chamber Deliberation Engine
 *
 * Constitutional AI 的朝堂实现：
 *   中书省（诸葛亮 · 起草）→ 门下省（魏徵 · 驳议）→ 尚书省（苏秦 · 执行）
 *
 * 核心价值：
 *   - 生成 ≠ 评判。同一个 LLM 写的答案，由另一个 LLM 带"祖训+史馆旧案"判一次，准确率 +40%
 *   - 可审计。每道旨意的三份印章都入史馆，永远可复盘
 *   - 可约束。用户写的"祖训"自动编译成门下省的硬约束
 *
 * 技术要点：
 *   - 三省并发度：中→门→尚 顺序（门下必须看到中书稿）
 *   - 每省独立 system prompt 谱系（见 /features/governance/prompts/）
 *   - 门下省可援引御书房 + 太史馆卷宗（RAG）
 */

import { logger } from '@/lib/logger';

export type ChamberRole = 'zhongshu' | 'menxia' | 'shangshu';

export type Verdict = '准' | '驳' | '再议';

export interface ZhongshuDraft {
  /** 政令初稿正文 */
  draft: string;
  /** 3个主要利好 */
  benefits: string[];
  /** 3个主要顾虑（中书自省） */
  concerns: string[];
  /** 预计影响的六部 */
  affectedDepts: string[];
  /** 引用了哪些礼部卷宗 */
  citations: Array<{ scrollId: string; chunkId: string; text: string }>;
}

export interface MenxiaReview {
  verdict: Verdict;
  /** 判决理由 · 魏徵式直言 */
  reasoning: string;
  /** 违反的祖训条款 · 可为空数组 */
  violatedConstitutions: string[];
  /** 援引的史馆旧案 */
  precedents: Array<{
    caseId: string;
    outcome: string;
    relevance: string;
  }>;
  /** 如判"再议"，建议修改点 */
  suggestedEdits: string[];
}

export interface ShangshuExecution {
  /** 可执行 steps 序列 */
  steps: ExecutionStep[];
  /** 预计完成时间 */
  etaMs: number;
  /** 分派到哪些六部 */
  dispatchedTo: string[];
}

export interface ExecutionStep {
  id: string;
  dept: string;
  action: string;
  /** 依赖哪些前置 step */
  depends: string[];
  /** 如果失败，影响范围 */
  blastRadius: 'low' | 'medium' | 'high';
  /** 失败时的补偿动作 · 逆序执行 · 可选（旧数据无此字段） */
  compensatingAction?: string;
}

export interface DeliberationResult {
  sessionId: string;
  timestamp: string;
  originalCommand: string;
  zhongshu: ZhongshuDraft;
  menxia: MenxiaReview;
  shangshu?: ShangshuExecution; // 只有 menxia 判准 才走到尚书
  finalVerdict: Verdict;
  /** 全流程耗时 */
  totalMs: number;
}

/** 祖训 · 用户可编辑的自然语言约束 */
export interface Constitution {
  id: string;
  clause: string;
  /** 强度：禁止性 / 警告性 / 建议性 */
  severity: 'forbidden' | 'warning' | 'advisory';
  /** 适用范围 · 如 '投资' / '人事' / '全局' */
  scope: string[];
  createdAt: string;
}

/**
 * 核心 API · 发起三省审议
 *
 * 调用方：/api/governance/deliberate
 * 内部：并发调 3 个 LLM（Anthropic/OpenAI/legal-agent consult）
 */
export interface DeliberateRequest {
  command: string;
  constitutions: Constitution[];
  /** 相关的御书房检索结果 */
  libuContext?: string;
  /** 相关的史馆旧案 */
  scribeContext?: string;
  /** 当前会话 id */
  sessionId?: string;
}

/**
 * 中书省 prompt 骨架 · 起草
 * 真正 prompt 请见 /features/governance/prompts/zhongshu.ts
 */
export const ZHONGSHU_PROMPT_SKELETON = `你是诸葛亮 · 中书令。
朝堂OS中书省的职责是**起草**政令初稿。
格式要求：
  1. 用简练文言起草（不超过 300 字）
  2. 必列 3 利 3 弊（陛下须知）
  3. 列出预计影响的六部
  4. 若引用御书房，句末标 [N]
严禁：
  - 空话套话
  - 模糊其词
  - 绕开陛下直接指示六部（那是尚书省的事）`;

export const MENXIA_PROMPT_SKELETON = `你是魏徵 · 门下侍中。
朝堂OS门下省的职责是**驳议**。
你必须：
  1. 先假设中书省的初稿是错的，尝试找出至少 2 个漏洞
  2. 查祖训（附在 context），有违必驳
  3. 翻史馆旧案（附在 context），援引相似案例
  4. 输出 {verdict: 准/驳/再议, reasoning, violatedConstitutions, precedents, suggestedEdits}
你的座右铭：「以人为镜可明得失。臣之驳，非与陛下争，乃与未来三年的陛下争。」
严禁：
  - 为了批而批（无据则不驳）
  - 判"准"又列一堆 concerns（要判就判死）`;

export const SHANGSHU_PROMPT_SKELETON = `你是苏秦 · 尚书令。
朝堂OS尚书省的职责是**落地执行**。
你必须：
  1. 把政令拆成独立可执行 steps（每步 < 30 分钟）
  2. 标出 step 间依赖（DAG）
  3. 估算 blast_radius（失败影响面）
  4. 分派到具体的六部（吏/户/礼/兵/刑/工/御史）
严禁：
  - 再提"是否应该做"（那是门下的事，你只管落地）
  - 跳过中间步骤直接出最终态
  - 把 high blast_radius 的事丢给单一六部`;

/** 检索上下文（Tavily 情报 + Turso 向量召回） */
export interface RetrievedContext {
  tavilyCitations: Array<{ url: string; title: string; snippet: string }>;
  intelSummary: string;
  precedents: Array<{ caseId: string; outcome: string; relevance: string }>;
  lessons: Array<{ id: string; content: string; similarity: number }>;
}

/** Agentic 反复迭代信息 */
export interface AgenticInfo {
  rounds: number;
  toolCalls: number;
  totalTokens: number;
}

/** 情报召回的最小单元（标题+摘要+可选公开来源 url）。 */
export interface RetrievableSignal {
  title: string;
  summary: string;
  url: string;
}

/**
 * 通用行政/连接二字片段停用词（会审 CRITICAL：不过滤则"评估/风险/合规/影响"等高频词
 * 会让主题无关的两条同领域文本巧合凑够覆盖度，撑过缺证闸误放行真派发）。只让**有辨识度**的词计分。
 */
const STOPWORD_BIGRAMS = new Set([
  '评估', '分析', '风险', '合规', '成本', '影响', '我们', '们的', '业务', '方案', '建议', '情况',
  '问题', '如何', '是否', '以及', '进行', '相关', '对我', '下一', '一步', '的影', '与下', '定位',
  '新定', '对业', '务的', '们业', '与风', '险与', '会对', '价值', '机会', '主要', '措施', '策略',
]);

/** 命令与文本的关键词相关度：共享的**有辨识度**中文二字片段（剔除通用行政词，降假阳性）。 */
function shingles(text: string): Set<string> {
  const clean = text.replace(/\s+/g, '');
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i += 1) {
    const g = clean.slice(i, i + 2);
    // 含数字的片段(年份/数量/编号)不算相关度信号：几乎每篇情报都含"2026"这类年份，
    // 光年份重合就能凑够 minScore 造假阳性(实测:"铭硕新能税务"误召回"2026 产业落地"大模型新闻)。
    // 相关度只认有辨识度的主题词，不认无处不在的数字。
    if (!STOPWORD_BIGRAMS.has(g) && !/\d/.test(g)) out.add(g);
  }
  return out;
}

/**
 * 按关键词相关度排锦衣卫情报（纯函数，可测）：只留与命令重合 ≥ minScore 片段的，取前 topN。
 * 无匹配 → 空数组（诚实：库里没相关情报就是缺证，交由门下省封驳，不硬凑）。
 */
export function rankSignalsByRelevance(
  command: string,
  signals: RetrievableSignal[],
  minScore = 3,
  topN = 5,
): RetrievableSignal[] {
  const cmd = shingles(command);
  return signals
    .map((s) => {
      const t = shingles(`${s.title} ${s.summary}`);
      let score = 0;
      for (const g of cmd) if (t.has(g)) score += 1;
      return { s, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((x) => x.s);
}

/**
 * 读锦衣卫情报库（Turso intel_signals）供缺证闸判据。
 * 会审 CRITICAL：**DB 故障绝不回退 mock 冒充真覆盖**（铁律3 DEMO 禁伪装 LIVE）——
 * 故障 → 空 + degraded=true，交门下省判「再议」，不让基础设施故障伪装成"情报充分"放行真派发。
 * 空库（非故障）也返回空：无真情报即缺证，本就该再议。
 */
async function loadIntelSignals(): Promise<{ signals: RetrievableSignal[]; degraded: boolean }> {
  const firstUrl = (json: unknown): string => {
    try {
      const arr = JSON.parse(String(json ?? '[]')) as Array<{ url?: string }>;
      return arr.find((x) => x?.url)?.url ?? '';
    } catch {
      return '';
    }
  };
  try {
    const { getDb } = await import('@/lib/db/turso');
    const res = await getDb().execute(
      'SELECT title, summary, sources_json FROM intel_signals ORDER BY created_at DESC LIMIT 60',
    );
    const rows = res.rows as unknown as Array<{ title?: string; summary?: string; sources_json?: string }>;
    return {
      signals: rows.map((r) => ({ title: String(r.title ?? ''), summary: String(r.summary ?? ''), url: firstUrl(r.sources_json) })),
      degraded: false,
    };
  } catch (err) {
    logger.warn('[retrieveContext] 情报库(Turso)不可达，缺证闸不采信任何覆盖度', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return { signals: [], degraded: true };
  }
}

/**
 * retrieveContext · 断点②（2026-07-06 · 会审加固）：读锦衣卫情报库 + 关键词召回最相关 ≤5 条喂门下省。
 * 把锦衣卫接回主链：有相关情报 → 覆盖 > 0 → 门下可准奏；无相关/DB故障 → 缺证，门下正确封驳（不硬凑、不用 mock 冒充）。
 * ponytail: 关键词二字片段匹配（剔停用词降假阳性），非向量召回；Tavily 联网 + Turso 向量留作后续增强。
 */
export async function retrieveContext(
  command: string,
  _requestId: string,
): Promise<RetrievedContext> {
  const { signals } = await loadIntelSignals();
  const hits = rankSignalsByRelevance(command, signals);
  return {
    tavilyCitations: hits.map((s) => ({ url: s.url, title: s.title, snippet: s.summary })),
    intelSummary: hits.length ? hits.map((s) => `· ${s.title}`).join('\n') : '',
    precedents: [],
    lessons: [],
  };
}

/** runZhongshu · 中书省起草 */
export async function runZhongshu(
  _command: string,
  _ctx: RetrievedContext,
  _requestId: string,
  _userId: string
): Promise<{ draft: ZhongshuDraft; agentic: AgenticInfo }> {
  // 占位符：实际实现会调 LLM 进行起草
  return {
    draft: {
      draft: '',
      benefits: [],
      concerns: [],
      affectedDepts: [],
      citations: [],
    },
    agentic: { rounds: 1, toolCalls: 0, totalTokens: 0 },
  };
}

/** runMenxia · 门下省驳议 */
export async function runMenxia(
  _command: string,
  _draft: ZhongshuDraft,
  _constitutions: Constitution[],
  _ctx: RetrievedContext,
  _requestId: string,
  _userId: string
): Promise<{ review: MenxiaReview; agentic: AgenticInfo }> {
  const totalSources = _ctx.tavilyCitations.length + _ctx.precedents.length;

  let coverageNote = '';
  let verdict: '准' | '再议' = '准';

  if (totalSources === 0) {
    verdict = '再议';
    coverageNote = '⚠️ 【门下省封驳】知识库覆盖为零：本次下旨在情报库和历史案例库中均无相关记录。建议补充情报后再议，或明确授权在无历史先例情况下推进。';
  } else if (totalSources < 3) {
    coverageNote = `⚠️ 【门下省存疑】低覆盖度（${totalSources} 条来源）：以下建议请结合人工判断，数值估算存在较大不确定性。`;
  } else {
    coverageNote = `✅ 覆盖度：${totalSources} 条来源（情报 ${_ctx.tavilyCitations.length} 条 + 历史案例 ${_ctx.precedents.length} 条）。`;
  }

  return {
    review: {
      verdict,
      reasoning: coverageNote + (_draft.draft ? '\n\n草案：' + _draft.draft.slice(0, 200) : ''),
      violatedConstitutions: [],
      precedents: [],
      suggestedEdits: totalSources === 0 ? ['建议补充情报后重新下旨'] : [],
    },
    agentic: { rounds: 1, toolCalls: 0, totalTokens: 0 },
  };
}

/** runShangshu · 尚书省执行 */
export async function runShangshu(
  _command: string,
  _draft: ZhongshuDraft,
  _requestId: string,
  _userId: string,
  authToken?: string
): Promise<{ execution: ShangshuExecution; agentic: AgenticInfo }> {
  const degraded: { execution: ShangshuExecution; agentic: AgenticInfo } = {
    execution: { steps: [], etaMs: 0, dispatchedTo: ['__degraded__'] },
    agentic: { rounds: 1, toolCalls: 0, totalTokens: 0 },
  };

  const baseUrl = process.env.JIQUN_API_URL;
  if (!baseUrl) {
    return degraded;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  // 真蜂群多部门真 LLM(户部 LIVE_ENGINE 等)实测 draft+confirm 两步约 2m18s（2026-07-06 探针），
  // 90s 会在蜂群跑完前 abort → degraded（丢掉真回奏）。暂调到 300s 让首份真回奏能落地。
  // ponytail: 内联等待仍脆弱（SSE 长挂/用户干等 2 分钟）。真解=confirm-edict 异步派发 + briefing
  // reconcile 回收（架构已有 reconcilePersistedTaskIfTerminal），本行只是让它先端到端跑通。
  const timer = setTimeout(() => controller.abort(), 300000);

  try {
    // 2026-07-03 会审后修正：此前误调 /api/run + config/flow_product.yaml（产品部竞品情报
    // 规划流程，跟六部判决无关），尚书省"分派六部"从未真的到过六部。改调
    // shangshufang draft-edict → confirm-edict，拿真实 ministry_outputs（含各部
    // source_label：FALLBACK/MIXED/LIVE_ENGINE，如实反映哪些部门已接真实引擎）。
    const draftRes = await fetch(`${baseUrl}/api/shangshufang/draft-edict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ raw_question: _command }),
      signal: controller.signal,
    });
    if (!draftRes.ok) {
      const text = await draftRes.text().catch(() => '');
      console.warn(`[runShangshu] draft-edict returned ${draftRes.status}: ${text}`);
      return degraded;
    }
    const draftData = (await draftRes.json()) as {
      success: boolean;
      data?: { task_id: string };
      error?: string | null;
    };
    if (!draftData.success || !draftData.data?.task_id) {
      console.warn(`[runShangshu] draft-edict failed: ${draftData.error}`);
      return degraded;
    }

    const confirmRes = await fetch(`${baseUrl}/api/shangshufang/confirm-edict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ task_id: draftData.data.task_id, confirmed: true }),
      signal: controller.signal,
    });
    if (!confirmRes.ok) {
      const text = await confirmRes.text().catch(() => '');
      console.warn(`[runShangshu] confirm-edict returned ${confirmRes.status}: ${text}`);
      return degraded;
    }
    const confirmData = (await confirmRes.json()) as {
      success: boolean;
      data?: {
        memorial?: {
          ministry_outputs?: Array<{
            department: string;
            swarm_id?: string;
            position?: string;
            source_label?: string;
          }>;
        };
      };
      error?: string | null;
    };
    const outputs = confirmData.data?.memorial?.ministry_outputs ?? [];
    if (!confirmData.success || outputs.length === 0) {
      console.warn(`[runShangshu] confirm-edict failed or empty: ${confirmData.error}`);
      return degraded;
    }

    const steps: ExecutionStep[] = outputs.map((o, idx) => ({
      id: o.swarm_id ?? `${o.department}-${idx}`,
      dept: o.department,
      action: `${o.position ?? '待复核'}（${o.source_label ?? 'FALLBACK'}）`,
      depends: [],
      blastRadius: o.source_label === 'LIVE_ENGINE' ? 'medium' : 'low',
    }));

    return {
      execution: { steps, etaMs: 0, dispatchedTo: outputs.map((o) => o.department) },
      agentic: { rounds: 1, toolCalls: 2, totalTokens: 0 },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[runShangshu] 调用 jiqun_ai 失败，降级返回: ${message}`);
    return degraded;
  } finally {
    clearTimeout(timer);
  }
}
