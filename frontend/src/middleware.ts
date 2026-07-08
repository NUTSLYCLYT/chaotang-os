/**
 * 朝堂 Console · 访问控制中间件（对齐 court-console B 版 SoT）
 *
 * 环境变量：
 *   COURT_CONSOLE_BASIC_AUTH   — "user:password" 格式，设置后启用 Basic Auth
 *   COURT_CONSOLE_IP_ALLOWLIST — 逗号分隔 IP，设置后只允许名单内 IP 访问
 *
 * 两个变量均可单独使用，也可同时使用（双重保护）。
 * 均未设置 → 完全开放（demo / localhost 开发场景）。
 */

import { NextRequest, NextResponse } from 'next/server'

import { shouldRedirectForLaunch } from '@/features/court-console/lib/launch-whitelist'

// Routes that require Basic Auth / IP allowlist when env vars are set.
// Currently empty — dashboard 页面只走应用内 JWT 鉴权，不在 middleware 加 Basic Auth 拦截。
const PROTECTED_PREFIXES: string[] = []

// 公开路由（无需登录 cookie 即可访问）
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/enter',
  '/_next',
  '/assets',
  '/fonts',
  '/heroes',
  '/shangshufang',
  '/dadian',
  '/junjichu',
  '/liubu',
  '/zhusi',
  '/shiguan',
  // '/api/shangshufang' B栈已退役进 dev/_attic(2026-07-02·融合吸收清单阶段1,客户端0引用死码);白名单同步移除。
  // '/api/reviews' 移出公开白名单(2026-06-25 安全扫描):reviews 是内部军机处会审(create→run 烧 LLM/swarm),
  //   仅由已登录翰林院页调用,非公网匿名功能。留白名单=未鉴权可刷 LLM token。移出→回归 cookie 门兜底。
  // '/api/shiguan' 保留:其下 archives/[archive_id]/retrospective 路由仍活(阶段4归档集群退役时
  //   独立会审抓出真调用点，已单独保留，见 dev/_attic/courtos-mvp-reviews-cluster/EXPIRES-2026-07-24.md)。
  // '/api/registry/departments' 已退役进 dev/_attic(2026-07-03·阶段4归档集群，客户端0引用死码);白名单同步移除。
]

const RETIRED_PAGE_PREFIXES = [
  '/overview',
  '/court-briefing',
  '/command-center',
  '/departments',
  '/intel',
  '/manors',
  '/archive',
  '/throne',
  '/grand-council',
  '/junjichu/cases',
  '/manor-dept',
  '/bingbu',
]

// 服务端 AuthGate — 所有非公开路由要求 access_token cookie。
// 客户端 AuthGate (components/AuthGate.tsx) 只拦页面跳转，不拦 fetch；
const ACCESS_COOKIE = 'courtos.access_token'
const BASE_PATH = (process.env.BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')

const BASIC_AUTH   = process.env.COURT_CONSOLE_BASIC_AUTH   ?? ''
const IP_ALLOWLIST = process.env.COURT_CONSOLE_IP_ALLOWLIST ?? ''

// --- Pure-decode exp 过期检查（不验签，后端兜底）---------------------------
// Edge middleware 运行时无 Buffer，使用 atob 解 base64url。仅用于读取 exp claim
// 判定过期；绝不验证签名（违反硬约束 #3）。解码失败一律 fail-open（视为无 exp、
// 不比今天的「cookie 存在即放行」更严格），避免误伤后端签发的真实 JWT。
function base64UrlDecodeEdge(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  const replaced = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(replaced)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

// 纯解码取 exp。无法解码或无 exp claim → 返回 null（不视为过期）。
// 后端真实 JWT(jiqun_ai/src/tenant.py)的 exp 是 ISO 字符串；dev/本地 token 是 unix 秒。两者都取。
function decodeTokenExp(token: string): number | string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const payload = JSON.parse(base64UrlDecodeEdge(part)) as { exp?: unknown }
    const exp = payload.exp
    return typeof exp === 'number' || typeof exp === 'string' ? exp : null
  } catch {
    return null
  }
}

// 仅当成功解码出 exp 且已过期才为 true；其余情形（无 exp / 解码失败）均 false。
// 修复 ISO 字符串 exp 被当 NaN 漏过的问题（之前 `exp*1000` 对字符串 = NaN → 永不过期）。
function isTokenExpired(token: string): boolean {
  const exp = decodeTokenExp(token)
  if (exp === null) return false
  if (typeof exp === 'number') return exp * 1000 < Date.now()
  const parsed = Date.parse(exp) // ISO 字符串
  return Number.isFinite(parsed) && parsed < Date.now()
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  )
}

function ipAllowed(ip: string): boolean {
  if (!IP_ALLOWLIST) return true
  const allowed = IP_ALLOWLIST.split(',').map(s => s.trim()).filter(Boolean)
  return allowed.includes(ip) || allowed.includes('127.0.0.1') && ip === '::1'
}

function basicAuthChallenge(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="CourtOS Console"' },
  })
}

function ipDenied(): NextResponse {
  return new NextResponse('Forbidden', { status: 403 })
}

function verifyBasicAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = atob(authHeader.slice(6))
  } catch {
    return false
  }
  // 使用常量时间比较，防止计时攻击暴力破解密码
  return constantTimeEqual(decoded, BASIC_AUTH)
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const maxLength = Math.max(leftBytes.length, rightBytes.length)

  let diff = leftBytes.length ^ rightBytes.length
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0)
  }

  return diff === 0
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  const routePath = BASE_PATH && pathname.startsWith(`${BASE_PATH}/`)
    ? pathname.slice(BASE_PATH.length)
    : pathname

  if (BASE_PATH && pathname === '/shangshufang' && !req.nextUrl.href.includes(`${BASE_PATH}/shangshufang`)) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/shangshufang`, req.url))
  }

  // Inject request ID for all routes (used by logger + audit)
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()

  if (RETIRED_PAGE_PREFIXES.some((p) => routePath === p || routePath.startsWith(p + '/'))) {
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  // Dev compatibility: globals.css keeps /chaotang/fonts as the production
  // basePath fallback, but local dev usually runs without BASE_PATH. In that
  // case serve the same public font from /fonts instead of letting the request
  // fall into the login guard and be parsed as a broken font.
  if (!BASE_PATH && pathname.startsWith('/chaotang/fonts/')) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.replace('/chaotang/fonts/', '/fonts/')
    return NextResponse.rewrite(url)
  }

  // 首发白名单(2026-06-28 · 张小龙天才建议)：默认拒绝。生产环境只放行「首发真业务面 +
  // 启动流」，其余页面(翰林/庄园/东宫/治理/jiqun后台/task/admin/settings/原型/路演/换电台/
  // E2E 挂载页)一律 redirect→上书房。漏一个也只少露一个真面，绝不把假门暴露给商家。
  // 仅页面路由；RETIRE_SURFACES=0 可关(应急)。
  if (process.env.NODE_ENV === 'production' && process.env.RETIRE_SURFACES !== '0') {
    if (shouldRedirectForLaunch(routePath)) {
      return NextResponse.redirect(new URL(`${BASE_PATH}/shangshufang`, req.url))
    }
  }

  // 0. 检查是否为公开路由（无需登录即可访问）
  const isPublicRoute =
    PUBLIC_PREFIXES.some((p) => routePath === p || routePath.startsWith(p + '/')) ||
    routePath === '/'
  if (isPublicRoute) {
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  // 1. 所有非公开路由强制 session cookie
  const token = req.cookies.get(ACCESS_COOKIE)?.value
  if (!token) {
    // API 路由返回 401 JSON
    if (routePath.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }
    // 页面路由重定向到登录页
    const loginUrl = new URL(`${BASE_PATH}/login`, req.url)
    loginUrl.searchParams.set('next', pathname.startsWith(BASE_PATH) ? pathname : `${BASE_PATH}${pathname}`)
    return NextResponse.redirect(loginUrl)
  }

  // 1b. 低风险硬化：纯解码 exp 过期检查（不验签，后端兜底——硬约束 #3）。
  //     仅当 token 能解码出 exp 且已过期才拒绝；解码失败/无 exp 一律放行（保持
  //     与今天「cookie 存在即放行」一致，避免误伤后端真实 JWT）。过期则清 cookie。
  if (isTokenExpired(token)) {
    if (routePath.startsWith('/api/')) {
      const res = new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
      res.cookies.delete(ACCESS_COOKIE)
      return res
    }
    const loginUrl = new URL(`${BASE_PATH}/login`, req.url)
    loginUrl.searchParams.set('next', pathname.startsWith(BASE_PATH) ? pathname : `${BASE_PATH}${pathname}`)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(ACCESS_COOKIE)
    return res
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => routePath.startsWith(p))
  if (!isProtected) {
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  // IP allowlist check (runs before auth)
  if (IP_ALLOWLIST) {
    const ip = getClientIp(req)
    if (!ipAllowed(ip)) return ipDenied()
  }

  // Basic Auth check
  if (BASIC_AUTH) {
    if (!verifyBasicAuth(req)) return basicAuthChallenge()
  }

  const res = NextResponse.next()
  res.headers.set('x-request-id', requestId)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
