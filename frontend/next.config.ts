import type { NextConfig } from 'next';

const BASE_PATH = process.env.BASE_PATH ?? '';
const BACKEND_API_BASE = (
  process.env.CHAOTANG_BACKEND_API_URL ??
  process.env.JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://127.0.0.1:8081'
).replace(/\/$/, '');
// 隔离构建用:设 NEXT_DIST_DIR=.next-buildcheck 可 build 到临时目录,
// 不覆盖正在被 `next start`(prod 3050)serve 的默认 .next。未设时行为不变。
const DIST_DIR = process.env.NEXT_DIST_DIR ?? '';

// 安全头(#4)：CSP 先 Report-Only(不阻断,框架注入内联 script;先收集违规再 enforce)，
// 但 frame-ancestors 'none' + X-Frame-Options:DENY 即时硬阻断 iframe 套壳点击劫持。
// connect-src 放 ws/wss/https 容 socket.io/jiqun/LiteLLM/SSE，report-only 下即便不全也不破页。
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  ...(DIST_DIR ? { distDir: DIST_DIR } : {}),
  // 注：output: 'standalone' 跟 `next start` 不兼容（必须 node .next/standalone/server.js）。
  //     systemd unit 用 next start，故默认禁用 standalone；
  //     Docker 镜像分发时设 NEXT_STANDALONE=1 开启（用 node server.js 启动）。
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  ...(BASE_PATH ? { basePath: BASE_PATH, assetPrefix: BASE_PATH } : {}),
  allowedDevOrigins: ['127.0.0.1'],
  // /throne 已弃用，统一去 /court-briefing（上书房作为新主入口）。
  // 用 307 而非 308，避免浏览器永久缓存 redirect 在 dev 阶段卡住后续改动。
  // /throne/compose 是圣旨总台，作为显式子路由保留。
  // 子路由 /throne/pulse、/throne/help、/throne/brief/[taskId] 不受影响（精确路径匹配）。
  // 减法 B：六部只保留 /departments/[code] 作为唯一主页；
  // 旧 /manor-dept/*、旧 /bingbu、别名 /departments/libu|works 一律 307 收口到 canonical。
  // #4 全站安全响应头(公网就绪)：点击劫持/嗅探/中间人/越权引用的第一道门。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_API_BASE}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // /departments 路由族已随孤儿 office-page 系统退役(ee4f44f, 2026-07-09)，真正的六部
      // 页面在 /liubu/*。/liubu/[code] 已经支持新旧两种部门代码写法(见
      // src/config/chaotang-v1-modules.ts 的 V1_DEPARTMENT_ALIASES：finance/hubu 都认，
      // ops/bingbu 都认……)，所以这里直接透传 :code，不需要额外的代码映射表。
      {
        source: '/departments',
        destination: '/liubu',
        permanent: false,
      },
      {
        source: '/departments/:code*',
        destination: '/liubu/:code*',
        permanent: false,
      },
      // /command-center 和 /junjichu 是同一个页面(app/(dashboard)/junjichu/page.tsx 导出的
      // 组件本身就叫 CommandCenterPage)，路由改名时全仓 25+ 处硬编码引用没有跟着迁移。
      {
        source: '/command-center',
        destination: '/junjichu',
        permanent: false,
      },
    ];
  },
  // autoresearch/build-speed-jul4 experiment: parallelize output file tracing
  // across the ~96 routes instead of tracing them serially.
  experimental: {
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    workerThreads: true,
  },
};

export default nextConfig;
