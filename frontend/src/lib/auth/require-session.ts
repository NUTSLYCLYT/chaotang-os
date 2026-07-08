import { getUserIdFromSession } from './get-user-id';

/**
 * 纵深防御鉴权(2026-06-25 · 盒子安全 / Schneier:别只靠 FENGQUN_AUTH 单点)。
 *
 * 用于**直写本地库**的 /api/court/* 端点(命名见 §13/铁律1)。这些路由在中间件层属"公开+后端
 * FENGQUN_AUTH 兜底",但本地写不经后端 → FENGQUN_AUTH=false 时裸奔。本 helper 给它们补第二道门:
 * 无会话即拒。两道独立门(FENGQUN_AUTH 守代理类 / requireSession 守本地写类),一道塌另一道还在。
 *
 * 返回 userId 或 null(无会话/解析失败)。调用方:`if (!await requireSession()) return 401`。
 */
export async function requireSession(): Promise<string | null> {
  try {
    return (await getUserIdFromSession()) ?? null;
  } catch {
    return null;
  }
}
