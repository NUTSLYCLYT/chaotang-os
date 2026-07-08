export const DEMO_ACCOUNTS: Record<string, { password: string; role: string }> = {
  emperor: { password: 'emperor', role: 'emperor' },
  chancellor: { password: 'chancellor', role: 'chancellor' },
  scribe: { password: 'scribe', role: 'scribe' },
  demo: { password: 'demo', role: 'emperor' },
  admin: { password: 'admin', role: 'emperor' },
};

export function normalizeLoginInput(username: string, password: string) {
  return {
    username: username.trim(),
    password: password.trim(),
  };
}

export function validateLoginInput(username: string, password: string) {
  const normalized = normalizeLoginInput(username, password);

  if (!normalized.username || !normalized.password) {
    return {
      ok: false as const,
      error: '请先填写账号和密码。',
      credentials: normalized,
    };
  }

  return {
    ok: true as const,
    credentials: normalized,
  };
}

export function resolveDemoUser(username: string, password: string) {
  const normalized = normalizeLoginInput(username, password);
  const demo = DEMO_ACCOUNTS[normalized.username];
  if (!demo || demo.password !== normalized.password) return null;
  return {
    username: normalized.username,
    role: demo.role,
  };
}

export function isDemoFallbackEnabled(env: Record<string, string | undefined> = process.env) {
  return env.COURTOS_AUTH_ALLOW_DEMO_FALLBACK === '1' || env.NEXT_PUBLIC_API_MODE === 'mock';
}

export interface AuthRouteUser {
  username: string;
  role: string;
}

export type BackendLoginResult =
  | { ok: true; token: string; user: AuthRouteUser }
  | { ok: false; status: number };

export type AuthSessionDecision =
  | { status: 200; body: { user: AuthRouteUser; authSource: 'backend' | 'demo' }; token: string }
  | { status: 401 | 422 | 503; body: { error: string } };

export async function resolveAuthSessionDecision({
  username,
  password,
  loginBackend,
  createDemoToken,
  env = process.env,
}: {
  username: string;
  password: string;
  loginBackend: (credentials: { username: string; password: string }) => Promise<BackendLoginResult>;
  createDemoToken: () => string;
  env?: Record<string, string | undefined>;
}): Promise<AuthSessionDecision> {
  const validation = validateLoginInput(username, password);
  if (!validation.ok) {
    return {
      status: 422,
      body: { error: validation.error },
    };
  }

  const credentials = validation.credentials;
  let backendUnavailable = false;

  try {
    const backend = await loginBackend(credentials);
    if (backend.ok) {
      return {
        status: 200,
        body: { user: backend.user, authSource: 'backend' },
        token: backend.token,
      };
    }
    if (backend.status !== 401) {
      return {
        status: 503,
        body: { error: '服务暂时不可用，请稍后重试' },
      };
    }
  } catch {
    backendUnavailable = true;
  }

  if (isDemoFallbackEnabled(env)) {
    const demoUser = resolveDemoUser(credentials.username, credentials.password);
    if (demoUser) {
      return {
        status: 200,
        body: { user: demoUser, authSource: 'demo' },
        token: createDemoToken(),
      };
    }
  }

  if (backendUnavailable) {
    return {
      status: 503,
      body: { error: '登录服务暂时不可用，请稍后重试' },
    };
  }

  return {
    status: 401,
    body: { error: '账号或密码错误' },
  };
}
