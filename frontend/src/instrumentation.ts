/**
 * #9 服务端崩溃遥测(可观测,charity-majors+Grove 顾虑)：
 * Next 的 instrumentation 钩子。onRequestError 在任意 server 组件/route handler 抛未捕获异常时触发——
 * 把它打成带 path/digest 的结构化日志落盘(stderr),让"104 page + 177 route 规模下的服务端崩溃"
 * 从"看不见"变成"可 grep 可告警"。本批先只结构化日志、不引 Sentry/OTel(那属运维项),register() 预留接入点。
 */

export function register(): void {
  // 预留:接入 Sentry/OpenTelemetry 时在此 init(本批不引外部依赖,避免上线前加新运行时风险)。
}

interface ReqErrInfo {
  path?: string;
  method?: string;
}
interface CtxErrInfo {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
}

export async function onRequestError(
  error: unknown,
  request: ReqErrInfo,
  context: CtxErrInfo,
): Promise<void> {
  const e = error as (Error & { digest?: string }) | undefined;
  // eslint-disable-next-line no-console
  console.error('[CourtOS onRequestError · 服务端未捕获异常]', {
    message: e?.message ?? String(error),
    digest: e?.digest,
    path: request?.path,
    method: request?.method,
    routePath: context?.routePath,
    routeType: context?.routeType,
    renderSource: context?.renderSource,
    stack: e?.stack,
  });
}
