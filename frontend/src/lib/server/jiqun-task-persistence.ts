import 'server-only';

type Dict = Record<string, unknown>;

export interface JiqunPersistedTask {
  taskId: string;
  id?: string;
  title?: string;
  rawCommand?: string;
  status?: string;
  mode?: string;
  progressPct?: number;
  createdAt?: string;
  updatedAt?: string;
  result?: Dict;
}

export interface PersistJiqunTaskInput {
  taskId?: string;
  command: string;
  title?: string;
  status?: string;
  mode?: string;
  result?: Dict;
  at?: string;
}

export interface PatchJiqunTaskInput {
  command?: string;
  title?: string;
  status?: string;
  mode?: string;
  result?: Dict;
  at?: string;
}

const WRITE_TIMEOUT_MS = 5_000;
const READ_TIMEOUT_MS = 2_500;

function jiqunBaseUrl(): string {
  return (process.env.JIQUN_API_URL ?? process.env.JIQUN_BASE_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
}

function readCookieToken(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)(?:courtos\.access_token|token)=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function authHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {};
  const adminToken = process.env.JIQUN_ADMIN_TOKEN?.trim();
  const requestAuth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const cookieToken = readCookieToken(cookie);

  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  else if (requestAuth) headers.Authorization = requestAuth;
  else if (cookieToken) headers.Authorization = `Bearer ${cookieToken}`;

  if (cookie) headers.Cookie = cookie;
  return headers;
}

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTask(value: unknown): JiqunPersistedTask | null {
  if (!isDict(value)) return null;
  const taskId = typeof value.taskId === 'string' ? value.taskId : typeof value.id === 'string' ? value.id : null;
  if (!taskId) return null;
  return {
    taskId,
    id: typeof value.id === 'string' ? value.id : taskId,
    title: typeof value.title === 'string' ? value.title : undefined,
    rawCommand: typeof value.rawCommand === 'string' ? value.rawCommand : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    mode: typeof value.mode === 'string' ? value.mode : undefined,
    progressPct: typeof value.progressPct === 'number' ? value.progressPct : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    result: isDict(value.result) ? value.result : undefined,
  };
}

async function readEnvelope(response: Response): Promise<unknown> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isDict(payload)) return null;
  if (payload.success === false) return null;
  return payload.data ?? payload;
}

export async function upsertJiqunPersistentTask(
  request: Request,
  input: PersistJiqunTaskInput,
): Promise<JiqunPersistedTask | null> {
  try {
    const response = await fetch(`${jiqunBaseUrl()}/api/chaotang/tasks/persist`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders(request),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return normalizeTask(await readEnvelope(response));
  } catch {
    return null;
  }
}

export async function patchJiqunPersistentTask(
  request: Request,
  taskId: string,
  input: PatchJiqunTaskInput,
): Promise<JiqunPersistedTask | null> {
  try {
    const response = await fetch(`${jiqunBaseUrl()}/api/chaotang/tasks/${encodeURIComponent(taskId)}/persist`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders(request),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return normalizeTask(await readEnvelope(response));
  } catch {
    return null;
  }
}

export async function listJiqunPersistentTasks(
  request: Request,
  limit = 20,
): Promise<JiqunPersistedTask[] | null> {
  try {
    const qs = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 200)) });
    const response = await fetch(`${jiqunBaseUrl()}/api/chaotang/tasks?${qs.toString()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...authHeaders(request),
      },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await readEnvelope(response);
    if (!Array.isArray(data)) return null;
    return data.map(normalizeTask).filter((task): task is JiqunPersistedTask => Boolean(task));
  } catch {
    return null;
  }
}

export async function getJiqunPersistentTaskDetail(request: Request, taskId: string): Promise<Dict | null> {
  try {
    const response = await fetch(`${jiqunBaseUrl()}/api/chaotang/tasks/${encodeURIComponent(taskId)}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...authHeaders(request),
      },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await readEnvelope(response);
    if (isDict(data) && isDict(data.task)) return data.task;
    return isDict(data) ? data : null;
  } catch {
    return null;
  }
}
