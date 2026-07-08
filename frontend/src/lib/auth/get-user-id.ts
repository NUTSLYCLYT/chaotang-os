/**
 * 从认证会话中安全地获取用户 ID
 * 不信任客户端提供的 header，只信任服务器认证的 cookie。
 *
 * 实现委托给规范的会话解析 `readSession()`（auth-server.ts → session-claims），
 * 读取服务端 cookie `courtos.access_token`（JWT），规范化 payload。
 * 用户 ID = `user_id`（真实后端 jiqun_ai）优先，回退 `sub`（dev/本地 token）。
 * 历史上只读 sub，对真实后端 token 恒为 null（功能性 401 所有真实用户）—— 已修。
 *
 * 注意：auth-server.ts 标记为 'server-only'，因此本模块只能在 server route 中被调用。
 */

import { logger } from '@/lib/logger'
import { readSession } from '@/lib/auth-server'

/**
 * 从服务端会话 cookie 中解析用户 ID。
 *
 * @returns 用户 ID（user_id ?? sub），或 null 如果未认证 / cookie 缺失 / 过期
 */
export async function getUserIdFromSession(): Promise<string | null> {
  try {
    const session = await readSession()
    return session?.userId ?? null
  } catch (error: unknown) {
    // 解析失败一律视为未认证，不向客户端泄漏内部细节。
    logger.error('getUserIdFromSession failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    })
    return null
  }
}

/**
 * 安全的用户认证守卫。
 * 如果未认证，抛出 'UNAUTHORIZED'，由调用方转换为 401 响应。
 *
 * @throws Error('UNAUTHORIZED') 当会话缺失或无效时
 */
export async function requireAuth(): Promise<string> {
  const userId = await getUserIdFromSession()

  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }

  return userId
}
