export type LoginValues = { username: string; password: string };
export type RegisterValues = LoginValues & { email: string; confirm: string };

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

type LoginDestination = "/dadian" | "/study" | "/shiguan";
type RegistrationDestination = "/login?registered=1";

export type AuthSubmission =
  | { ok: true; destination: LoginDestination | RegistrationDestination; requestUrl: string }
  | { ok: false; message: string; requestUrl: string };

export function getSafeLoginDestination(next: string | null | undefined): LoginDestination {
  return next === "/study" || next === "/shiguan" || next === "/dadian" ? next : "/dadian";
}

function failureMessage(response: Response, action: "login" | "register"): string {
  if (response.status === 401) return "用户名或密码不正确。";
  if (response.status === 409) return "用户名或邮箱已被使用。";
  if (response.status === 422 || response.status === 400) return action === "login"
    ? "请检查用户名和密码后重试。"
    : "注册信息不符合要求，请检查后重试。";
  return "认证服务暂时不可用，请稍后重试。";
}

async function submitAuth(
  requestUrl: "/api/auth/login" | "/api/auth/register",
  payload: Record<string, string>,
  destination: LoginDestination | RegistrationDestination,
  action: "login" | "register",
  request: AuthFetch,
): Promise<AuthSubmission> {
  try {
    const response = await request(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false, message: failureMessage(response, action), requestUrl };
    return { ok: true, destination, requestUrl };
  } catch {
    return { ok: false, message: "认证服务暂时不可用，请稍后重试。", requestUrl };
  }
}

export async function submitLogin(values: LoginValues, next?: string | null, request: AuthFetch = fetch): Promise<AuthSubmission> {
  const validationError = validateLogin(values);
  if (validationError) return { ok: false, message: validationError, requestUrl: "/api/auth/login" };
  return submitAuth("/api/auth/login", { identifier: values.username.trim(), password: values.password }, getSafeLoginDestination(next), "login", request);
}

export async function submitRegister(values: RegisterValues, _next?: string | null, request: AuthFetch = fetch): Promise<AuthSubmission> {
  const validationError = validateRegister(values);
  if (validationError) return { ok: false, message: validationError, requestUrl: "/api/auth/register" };
  return submitAuth("/api/auth/register", { username: values.username.trim(), email: values.email.trim(), password: values.password }, "/login?registered=1", "register", request);
}

export function validateLogin({ username, password }: LoginValues): string | null {
  return username.trim() && password.trim() ? null : "请填写账号和密码。";
}

export function validateRegister(values: RegisterValues): string | null {
  if (![values.username, values.email, values.password, values.confirm].every((value) => value.trim())) {
    return "请先完成所有必填字段。";
  }
  if (!values.email.includes("@")) return "请填写有效的邮箱地址。";
  if (values.password.length < 6) return "密码至少需要 6 位。";
  return values.password === values.confirm ? null : "两次输入的密码不一致。";
}

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}
