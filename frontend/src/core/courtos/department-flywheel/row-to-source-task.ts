/**
 * DB 行(toBackendTask 驼峰输出) → SourceTask 纯函数映射。
 *
 * 共享工具：hubu 和 bingbu auto-raise route 共用同一实现，禁止跨部门 import。
 * 独立文件，无 next/server 依赖，可直接在 nodetest import。
 * H2 修复：listPrimaryTasks 返回 toBackendTask 驼峰字段(rawCommand/updatedAt)，
 * 路由原先读 raw_command/updated_at(snake_case)导致 command 恒空。
 */
import type { SourceTask } from './types.ts';

/** toBackendTask 驼峰字段(取飞轮所需子集) */
interface BackendTaskRow {
  id: unknown;
  title: unknown;
  rawCommand: unknown;
  status: unknown;
  updatedAt: unknown;
  result: unknown;
}

export function rowToSourceTask(row: unknown): SourceTask {
  const r = row as BackendTaskRow;
  // 源任务自带来源标透传(result_json.sourceLabel 原样字符串);归一化留给 derive(SSOT)。
  // 铁律2:让 derive 据此标真源,禁漂白 FALLBACK/DEMO。这里只搬字段,不做语义判断。
  const result = r.result as Record<string, unknown> | null | undefined;
  const rawSourceLabel =
    result && typeof result.sourceLabel === 'string' ? result.sourceLabel : undefined;
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    command: String(r.rawCommand ?? ''),
    status: String(r.status ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    ...(rawSourceLabel ? { sourceLabel: rawSourceLabel } : {}),
  };
}
