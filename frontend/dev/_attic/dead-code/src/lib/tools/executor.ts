/**
 * 朝堂 OS · Tool Executor
 *
 * 接收 tool_use block（name + input），路由到对应实现，返回 JSON 字符串结果。
 * 调用方将结果作为 tool_result 回传给 LLM。
 *
 * 实现策略：
 *   - 开发期：所有工具返回逼真的 mock 数据（有结构、有字段、有语义）
 *   - 生产期：替换 impl 函数即可，接口不变
 */

import { logger } from '@/lib/logger';

export interface ToolInput {
  /** tool name，与 AnthropicTool.name 一致 */
  name: string;
  /** tool 入参，由 LLM 按 input_schema 填入 */
  input: Record<string, unknown>;
}

export interface ToolResult {
  /** 工具名，原样回传，方便 LLM 对应 */
  tool_name: string;
  /** 执行成功与否 */
  ok: boolean;
  /** 业务数据（成功时有值） */
  data?: unknown;
  /** 错误信息（失败时有值） */
  error?: string;
}

/* --------------------------------------------------------------------------
 * 各工具实现
 * -------------------------------------------------------------------------- */

async function implGetTaskStatus(input: Record<string, unknown>): Promise<unknown> {
  const taskId = String(input['task_id'] ?? '');
  if (!taskId) throw new Error('task_id is required');

  // TODO: 接入 Turso / API 真实查询
  return {
    task_id: taskId,
    status: 'running',
    agent_code: 'ZGL',
    progress_pct: 62,
    summary: '正在进行第 3 步：核心逻辑分析',
    updated_at: new Date().toISOString(),
  };
}

async function implDispatchSwarmTask(input: Record<string, unknown>): Promise<unknown> {
  const swarmUnit = String(input['swarm_unit'] ?? '');
  const agentCode = String(input['agent_code'] ?? '');
  const instruction = String(input['instruction'] ?? '');
  const priority = String(input['priority'] ?? 'normal');

  if (!swarmUnit || !agentCode || !instruction) {
    throw new Error('swarm_unit, agent_code, instruction are required');
  }

  // TODO: 接入 jiqun-api 真实派发
  const newTaskId = crypto.randomUUID();
  return {
    task_id: newTaskId,
    swarm_unit: swarmUnit,
    agent_code: agentCode,
    instruction,
    priority,
    status: 'queued',
    created_at: new Date().toISOString(),
  };
}

async function implSearchArchive(input: Record<string, unknown>): Promise<unknown> {
  const query = String(input['query'] ?? '');
  const dateFrom = input['date_from'] ? String(input['date_from']) : undefined;
  const dateTo = input['date_to'] ? String(input['date_to']) : undefined;
  const limit = Math.min(50, parseInt(String(input['limit'] ?? '10'), 10) || 10);

  if (!query) throw new Error('query is required');

  // TODO: 接入 archive search API
  return {
    query,
    date_from: dateFrom,
    date_to: dateTo,
    total: 3,
    limit,
    results: [
      {
        id: 'arch-001',
        title: `关于"${query}"的专项研判报告`,
        agent_code: 'ZS',
        status: 'completed',
        created_at: '2024-11-20T08:00:00Z',
        summary: `针对 ${query} 进行了全面分析，结论详见正文。`,
      },
      {
        id: 'arch-002',
        title: `${query} 后续跟踪备忘`,
        agent_code: 'LB',
        status: 'completed',
        created_at: '2024-11-21T14:30:00Z',
        summary: '跟踪上次报告执行情况，各项措施已落实。',
      },
      {
        id: 'arch-003',
        title: `${query} 季度复盘`,
        agent_code: 'BY',
        status: 'completed',
        created_at: '2024-12-01T09:00:00Z',
        summary: '季度整体表现良好，建议延续当前策略。',
      },
    ],
  };
}

async function implGetAgentLoad(input: Record<string, unknown>): Promise<unknown> {
  const agentCode = String(input['agent_code'] ?? '');
  if (!agentCode) throw new Error('agent_code is required');

  // TODO: 接入实时 agent health API
  return {
    agent_code: agentCode,
    health: 'healthy',
    running_tasks: 2,
    queued_tasks: 1,
    completed_today: 7,
    avg_task_duration_ms: 4200,
    last_heartbeat_at: new Date().toISOString(),
  };
}

async function implCreateMinistryTask(input: Record<string, unknown>): Promise<unknown> {
  const dept = String(input['dept'] ?? '');
  const action = String(input['action'] ?? '');
  const dependsOn = Array.isArray(input['depends_on'])
    ? (input['depends_on'] as unknown[]).map(String)
    : [];
  const blastRadius = String(input['blast_radius'] ?? 'medium');

  if (!dept || !action) {
    throw new Error('dept and action are required');
  }

  const stepId = `step_${crypto.randomUUID().slice(0, 8)}`;
  return {
    step_id: stepId,
    dept,
    action,
    depends_on: dependsOn,
    blast_radius: blastRadius,
    status: 'queued',
    created_at: new Date().toISOString(),
  };
}

async function implGetFinanceMetrics(input: Record<string, unknown>): Promise<unknown> {
  const includeProjects = String(input['include_projects'] ?? 'false') === 'true';
  const statusFilter = input['status_filter'] ? String(input['status_filter']) : undefined;

  // Real Turso query via internal API
  try {
    const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${process.env.PORT ?? 3050}`;
    const res = await fetch(`${BASE_URL}${BASE_PATH}/api/court/hubu/overview`, {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`hubu/overview ${res.status}`);
    const json = (await res.json()) as { success: boolean; data: { summary: unknown; projects: unknown[] } };
    if (!json.success) throw new Error('hubu/overview returned success=false');

    const { summary, projects } = json.data;
    const filteredProjects = statusFilter
      ? (projects as Array<Record<string, unknown>>).filter((p) => p['status'] === statusFilter)
      : projects;

    return {
      summary,
      projects: includeProjects ? filteredProjects : undefined,
      citations: (filteredProjects as Array<Record<string, unknown>>).slice(0, 5).map((p, i) => ({
        index: i + 1,
        label: String(p['title'] ?? ''),
        id: String(p['id'] ?? ''),
        status: String(p['status'] ?? ''),
        estimated_roi: String(p['estimated_roi'] ?? ''),
      })),
      source: (summary as Record<string, unknown>)['source'] ?? 'unknown',
    };
  } catch (err) {
    throw new Error(`get_finance_metrics failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function implQueryHealthProfile(input: Record<string, unknown>): Promise<unknown> {
  const aspect = String(input['aspect'] ?? 'overview');
  const metricCodes = Array.isArray(input['metric_codes'])
    ? (input['metric_codes'] as unknown[]).map(String)
    : [];

  try {
    const { getDb } = await import('@/lib/db/turso');
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT profile_json, data_source, synced_at FROM health_profiles WHERE id = 'main' LIMIT 1`,
      args: [],
    });

    if (row.rows.length > 0) {
      const r = row.rows[0]!;
      const profile = JSON.parse(r.profile_json as string) as {
        totalScore: number;
        riskLevel: string;
        subjectName: string;
        updatedAt: string;
        metrics: Array<{ code: string; name: string; value: unknown; unit: string; status: string }>;
        alerts: Array<{ title: string; level: string; actionRequired: boolean }>;
        interventions: Array<{ id: string; title: string; durationDays: number }>;
      };

      const filteredMetrics = metricCodes.length > 0
        ? profile.metrics.filter((m) => metricCodes.includes(m.code))
        : profile.metrics;

      const citations = [
        {
          title: '太医院 Turso 健康档案',
          type: 'database',
          excerpt: `数据来源: ${r.data_source}，末次同步: ${r.synced_at}`,
        },
      ];

      if (aspect === 'metrics') {
        return { aspect, totalScore: profile.totalScore, riskLevel: profile.riskLevel, metrics: filteredMetrics, citations, updatedAt: profile.updatedAt };
      }
      if (aspect === 'alerts') {
        return { aspect, alerts: profile.alerts, citations, updatedAt: profile.updatedAt };
      }
      if (aspect === 'interventions') {
        return { aspect, interventions: profile.interventions, citations, updatedAt: profile.updatedAt };
      }
      return {
        aspect: 'overview',
        totalScore: profile.totalScore,
        riskLevel: profile.riskLevel,
        summary: `陛下健康总分 ${profile.totalScore}/100，风险等级：${profile.riskLevel}。共 ${profile.alerts.length} 项预警，${profile.interventions.length} 项干预计划。`,
        alerts: profile.alerts.slice(0, 3),
        keyMetrics: filteredMetrics.slice(0, 6),
        activeInterventions: profile.interventions.slice(0, 2),
        citations,
        updatedAt: profile.updatedAt,
      };
    }
  } catch {
    // Turso 不可用，降级到 mock
  }

  return {
    aspect,
    totalScore: 82,
    riskLevel: 'watch',
    summary: '陛下健康总分 82/100，风险等级：关注级。当前有 2 项预警，1 项干预计划进行中。',
    alerts: [
      { title: 'LDL 连续两次偏高', level: 'watch', actionRequired: true },
      { title: '收缩压呈持续上升趋势', level: 'watch', actionRequired: true },
    ],
    keyMetrics: [
      { code: 'LDL', name: '低密度脂蛋白', value: 3.8, unit: 'mmol/L', status: 'abnormal_high' },
      { code: 'BP_S', name: '收缩压', value: 128, unit: 'mmHg', status: 'borderline' },
    ],
    activeInterventions: [{ id: 'plan_001', title: '4 周血脂干预计划', durationDays: 28 }],
    citations: [
      { title: '太医院健康档案（降级模式）', type: 'database', excerpt: '数据源: fallback mock' },
    ],
    updatedAt: new Date().toISOString(),
  };
}

async function implGetIntelSignals(input: Record<string, unknown>): Promise<unknown> {
  const category = input['category'] ? String(input['category']) : undefined;
  const level = input['level'] ? String(input['level']) : undefined;
  const region = input['region'] ? String(input['region']) : undefined;
  const limit = Math.min(50, parseInt(String(input['limit'] ?? '10'), 10) || 10);

  try {
    const { getDb } = await import('@/lib/db/turso');
    const db = getDb();
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (category) { where.push(`category = ?`); args.push(category); }
    if (level) { where.push(`level = ?`); args.push(level); }
    if (region) { where.push(`region = ?`); args.push(region); }
    args.push(limit);
    const sql = `SELECT id, title, summary, category, level, region, impact_score, created_at FROM intel_signals${where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY impact_score DESC LIMIT ?`;
    const rows = await db.execute({ sql, args });
    return {
      total: rows.rows.length,
      limit,
      results: rows.rows.map((r: Record<string, unknown>) => ({
        id: r['id'], title: r['title'], summary: r['summary'],
        category: r['category'], level: r['level'], region: r['region'],
        impact_score: r['impact_score'], created_at: r['created_at'],
      })),
    };
  } catch {
    return {
      total: 2, limit,
      results: [
        { id: 's1', title: '全球供应链扰动预警', summary: '红海通道受阻', category: 'risk', level: 'warning', impact_score: 0.8 },
        { id: 's2', title: 'AI 监管政策新进展', summary: '欧盟 AI Act 实施', category: 'neutral', level: 'info', impact_score: 0.6 },
      ],
    };
  }
}

async function implQueryManorData(input: Record<string, unknown>): Promise<unknown> {
  const ministryKeys = Array.isArray(input['ministry_keys'])
    ? (input['ministry_keys'] as unknown[]).map(String).filter(Boolean)
    : [];
  const includeCitations = String(input['include_citations'] ?? 'true') !== 'false';

  try {
    const { getDb } = await import('@/lib/db/turso');
    const db = getDb();

    let sql: string;
    let args: (string | number)[];
    if (ministryKeys.length > 0) {
      const placeholders = ministryKeys.map(() => '?').join(', ');
      sql = `SELECT ministry_key, metric_label, metric_value, delta, delta_positive, updated_at
             FROM manor_metrics WHERE ministry_key IN (${placeholders})
             ORDER BY ministry_key, rowid`;
      args = ministryKeys;
    } else {
      sql = `SELECT ministry_key, metric_label, metric_value, delta, delta_positive, updated_at
             FROM manor_metrics ORDER BY ministry_key, rowid`;
      args = [];
    }

    const rows = await db.execute({ sql, args });
    const grouped: Record<string, Array<{ label: string; value: string; delta: string | null }>> = {};
    for (const r of rows.rows) {
      const key = String(r[0]);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ label: String(r[1]), value: String(r[2]), delta: r[3] != null ? String(r[3]) : null });
    }

    const updatedAt = rows.rows[0]?.[5] != null ? String(rows.rows[0][5]) : new Date().toISOString();

    const citationsList = includeCitations
      ? Object.entries(grouped).map(([key, metrics], i) => ({
          index: i + 1,
          ministry: key,
          source: 'Turso · manor_metrics',
          excerpt: metrics.slice(0, 2).map((m) => `${m.label}: ${m.value}`).join('；'),
          updated_at: updatedAt,
        }))
      : undefined;

    return {
      ministries: grouped,
      total_rows: rows.rows.length,
      queried_keys: ministryKeys.length > 0 ? ministryKeys : ['all'],
      citations: citationsList,
      data_source: 'turso',
      updated_at: updatedAt,
    };
  } catch (err) {
    throw new Error(`query_manor_data failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* --------------------------------------------------------------------------
 * 分发路由表
 * -------------------------------------------------------------------------- */

type ToolImpl = (input: Record<string, unknown>) => Promise<unknown>;

const TOOL_REGISTRY: Record<string, ToolImpl> = {
  get_task_status: implGetTaskStatus,
  dispatch_swarm_task: implDispatchSwarmTask,
  search_archive: implSearchArchive,
  get_agent_load: implGetAgentLoad,
  create_ministry_task: implCreateMinistryTask,
  get_finance_metrics: implGetFinanceMetrics,
  get_intel_signals: implGetIntelSignals,
  query_health_profile: implQueryHealthProfile,
  query_manor_data: implQueryManorData,
};

/* --------------------------------------------------------------------------
 * 主执行入口
 * -------------------------------------------------------------------------- */

/**
 * 执行单个工具调用，返回 ToolResult。
 * 永不抛出，失败信息包在 ok=false + error 字段里。
 */
export async function executeTool(call: ToolInput): Promise<ToolResult> {
  const ctx = { tool: call.name };
  const impl = TOOL_REGISTRY[call.name];

  if (!impl) {
    logger.warn('unknown tool', { ...ctx });
    return {
      tool_name: call.name,
      ok: false,
      error: `unknown tool: ${call.name}`,
    };
  }

  try {
    logger.info('tool call start', { ...ctx, input: call.input });
    const data = await impl(call.input);
    logger.info('tool call ok', { ...ctx });
    return { tool_name: call.name, ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('tool call failed', { ...ctx, err: message });
    return { tool_name: call.name, ok: false, error: message };
  }
}

/**
 * 批量执行工具调用（并行）。
 */
export async function executeTools(calls: ToolInput[]): Promise<ToolResult[]> {
  return Promise.all(calls.map((c) => executeTool(c)));
}

/**
 * 将 ToolResult 序列化为 JSON 字符串，用于回传给 LLM 的 tool_result content。
 */
export function serializeToolResult(result: ToolResult): string {
  return JSON.stringify(result);
}
