/**
 * 本地用户存储（开发/离线场景）。
 * 当真实后端不可用时，用于注册和登录的 mock 持久化。
 *
 * 存在 globalThis 上，同一 Node 进程内共享。
 */

export interface LocalUser {
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'lh_' + Math.abs(hash).toString(36);
}

declare global {
  // eslint-disable-next-line no-var
  var __courtosLocalUsers: Map<string, LocalUser> | undefined;
}

function getLocalUsers(): Map<string, LocalUser> {
  if (!globalThis.__courtosLocalUsers) {
    globalThis.__courtosLocalUsers = new Map();
  }
  return globalThis.__courtosLocalUsers;
}

export function findLocalUser(username: string): LocalUser | undefined {
  return getLocalUsers().get(username);
}

export function registerLocalUser(
  username: string,
  email: string,
  password: string,
): { ok: true; user: LocalUser } | { ok: false; error: string } {
  const users = getLocalUsers();

  if (users.has(username)) {
    return { ok: false, error: '该用户名已被注册。' };
  }

  for (const u of users.values()) {
    if (u.email === email) {
      return { ok: false, error: '该邮箱已被注册。' };
    }
  }

  const user: LocalUser = {
    username,
    email,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
  };

  users.set(username, user);
  return { ok: true, user };
}

export function verifyLocalPassword(username: string, password: string): boolean {
  const user = findLocalUser(username);
  if (!user) return false;
  return user.passwordHash === simpleHash(password);
}

export function getAllLocalUsersCount(): number {
  return getLocalUsers().size;
}
