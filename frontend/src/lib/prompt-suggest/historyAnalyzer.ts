import { getDb } from '@/lib/db/turso'
import { logger } from '@/lib/logger'
import type { UserHistoryStats, DeptCode, TaskIntent } from './types'

type Mode = 'fast' | 'standard' | 'deep'

/** dept 为空时的占位部门（仅用于无样本的默认统计，不参与查询） */
const DEFAULT_DEPT: DeptCode = 'hu_bu'

/**
 * agent_runs 聚合查询的行形状（按列名访问）
 */
interface AgentRunHistoryRow {
  route_type: string | null
  count: number
  success_count: number
  avg_duration_ms: number | null
  last_attempt: string | null
}

/**
 * 把 DB 的 route_type 显式映射到三档执行模式。
 * - 'openclaw' | 'deep' → 'deep'
 * - 'standard'          → 'standard'
 * - 其余('fast' | null | 未知) → 'fast'
 */
function mapRouteTypeToMode(rt: string | null): Mode {
  if (rt === 'openclaw' || rt === 'deep') {
    return 'deep'
  }
  if (rt === 'standard') {
    return 'standard'
  }
  return 'fast'
}

/**
 * 从 agent_runs 表分析用户历史
 * 计算成功率、平均完成时间等
 *
 * 注意（数据接入前的现实约束）：
 * 本函数依赖的 user_id / intent / swarm_id / route_type / created_at 列当前
 * 在本舱唯一写入方 /api/agents/run 中均无写入通路（该写入补齐需在 /api/agents/run
 * 单独 PR 完成，超出本改动面）。在写入通路接通之前，本函数的查询恒为空，
 * 因此实际恒返回 getDefaultStats（下游 recommendMode 恒返回 'fast'）。
 * 下游不要据此误判为已生效功能。
 */
export async function analyzeUserHistory(
  userId: string,
  intent: TaskIntent,
  dept: DeptCode | null
): Promise<UserHistoryStats> {
  if (!dept) {
    // 无部门时无法定位历史样本，直接返回默认统计（用占位部门，下游只读 totals/successRate）。
    return getDefaultStats(userId, intent, DEFAULT_DEPT)
  }

  try {
    const db = getDb()

    // 查询用户过去 30 天的类似任务
    // created_at 当前可能为 NULL（历史行只填了 started_at），用 COALESCE 容忍，
    // 使既有只填 started_at 的行也能进入 30 天窗口，避免查询恒空。
    const query = `
      SELECT
        route_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
        AVG(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at) - julianday(started_at)) * 86400 * 1000 ELSE NULL END) as avg_duration_ms,
        MAX(created_at) as last_attempt
      FROM agent_runs
      WHERE user_id = ?
        AND intent = ?
        AND swarm_id LIKE ?
        AND COALESCE(created_at, started_at) > datetime('now', '-30 days')
      GROUP BY route_type
    `

    const result = await db.execute({
      sql: query,
      args: [userId, intent, `%${dept}%`]
    })

    const results: AgentRunHistoryRow[] =
      result.rows?.map((row) => ({
        route_type: row['route_type'] == null ? null : String(row['route_type']),
        count: Number(row['count']) || 0,
        success_count: Number(row['success_count']) || 0,
        avg_duration_ms:
          row['avg_duration_ms'] == null ? null : Number(row['avg_duration_ms']),
        last_attempt:
          row['last_attempt'] == null ? null : String(row['last_attempt']),
      })) ?? []

    // 在不可变默认值基础上累计；同一 mode 桶可能由多行 route_type 命中，需累加不可覆盖。
    const successCount: Record<Mode, number> = { fast: 0, standard: 0, deep: 0 }
    const durationAcc: Record<Mode, { sum: number; cnt: number }> = {
      fast: { sum: 0, cnt: 0 },
      standard: { sum: 0, cnt: 0 },
      deep: { sum: 0, cnt: 0 },
    }
    let totalAttempts = 0
    let lastAttempt: string | null = null

    for (const row of results) {
      const mode = mapRouteTypeToMode(row.route_type)
      successCount[mode] += row.success_count
      totalAttempts += row.count
      if (row.avg_duration_ms != null) {
        durationAcc[mode].sum += row.avg_duration_ms * row.count
        durationAcc[mode].cnt += row.count
      }
      if (row.last_attempt) {
        lastAttempt = row.last_attempt
      }
    }

    const defaults = getDefaultStats(userId, intent, dept)
    const avgCompletionTime: Record<Mode, number> = {
      fast: defaults.avgCompletionTime.fast,
      standard: defaults.avgCompletionTime.standard,
      deep: defaults.avgCompletionTime.deep,
    }
    for (const mode of ['fast', 'standard', 'deep'] as const) {
      const { sum, cnt } = durationAcc[mode]
      if (cnt > 0) {
        avgCompletionTime[mode] = Math.round(sum / cnt)
      }
    }

    return {
      ...defaults,
      totalAttempts,
      successCount,
      avgCompletionTime,
      lastAttempt,
    }
  } catch (error) {
    // 数据库错误，返回默认值（内部细节只进服务端日志，不向客户端泄漏）
    logger.error('analyze user history failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return getDefaultStats(userId, intent, dept)
  }
}

function getDefaultStats(
  userId: string,
  intent: TaskIntent,
  dept: DeptCode
): UserHistoryStats {
  return {
    userId,
    intent,
    dept,
    totalAttempts: 0,
    successCount: {
      fast: 0,
      standard: 0,
      deep: 0
    },
    avgCompletionTime: {
      fast: 3000,      // 默认 3 秒
      standard: 15000, // 默认 15 秒
      deep: 60000      // 默认 60 秒
    },
    lastAttempt: null
  }
}

/**
 * 计算推荐模式
 * 基于历史成功率
 */
export function recommendMode(stats: UserHistoryStats): 'fast' | 'standard' | 'deep' {
  // 如果用户没有历史，默认快速模式
  if (stats.totalAttempts === 0) {
    return 'fast'
  }

  // 计算每种模式的成功率
  const successRates = {
    fast: stats.successCount.fast > 0 ? (stats.successCount.fast / stats.totalAttempts) * 100 : 0,
    standard: stats.successCount.standard > 0 ? (stats.successCount.standard / stats.totalAttempts) * 100 : 0,
    deep: stats.successCount.deep > 0 ? (stats.successCount.deep / stats.totalAttempts) * 100 : 0
  }

  // 成功率最高的模式获胜
  let best: 'fast' | 'standard' | 'deep' = 'fast'
  let bestRate = successRates.fast

  if (successRates.standard > bestRate) {
    best = 'standard'
    bestRate = successRates.standard
  }
  if (successRates.deep > bestRate) {
    best = 'deep'
    bestRate = successRates.deep
  }

  return best
}

/** 多分隔符切分：顿号/中英文逗号/中英文分号/换行 */
const SPLIT_PATTERN = /[、,，;；\n]+/

function splitSegments(input: string): string[] {
  return input
    .split(SPLIT_PATTERN)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 判断是否可以分拆
 * 大任务（字数多、枚举维度多）可以分拆。
 * 兼容中文（按字符数）与英文（按空格分词）两种规模度量，取较大者。
 */
export function canSplitTask(input: string, _intent: TaskIntent): boolean {
  const segs = splitSegments(input)
  const wordCount = Math.max(
    input.length / 2,
    input.split(/\s+/).filter(Boolean).length
  )
  return wordCount > 30 && segs.length > 2
}

export function suggestSplit(
  input: string,
  intent: TaskIntent
): { description: string; subTasks: string[] } | null {
  if (!canSplitTask(input, intent)) {
    return null
  }

  const parts = splitSegments(input)

  if (parts.length < 2) {
    return null
  }

  return {
    description: `这个任务可以分拆成 ${parts.length} 个小任务，并行处理`,
    subTasks: parts
  }
}
