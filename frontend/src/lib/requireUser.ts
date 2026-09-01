import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";

import { getCurrentUser, type BackendAuthResult, type PublicUser } from "./backendClient.ts";
import { SESSION_COOKIE_NAME } from "./session.ts";

type ProtectedPath =
  | "/jinyiwei"
  | "/study"
  | "/shiguan"
  | "/dadian"
  | "/junjichu"
  | "/honglusi"
  | "/command-center"
  | "/liubu"
  | `/liubu/${string}`
  | "/zhuanshu"
  | "/zhuanshu/jinyiwei"
  | `/zhuanshu/jinyiwei/${string}`;

interface RequireUserDependencies {
  getSessionId: () => Promise<string | null>;
  getCurrentUser: (sessionId: string) => Promise<BackendAuthResult>;
  redirect: (location: string) => never;
}

async function getServerSessionId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

const serverDependencies: RequireUserDependencies = {
  getSessionId: getServerSessionId,
  getCurrentUser: (sessionId) => getCurrentUser({ sessionId }),
  redirect,
};

export async function requireUser(
  nextPath: ProtectedPath,
  dependencies: RequireUserDependencies = serverDependencies,
): Promise<PublicUser> {
  const sessionId = await dependencies.getSessionId();
  if (!sessionId) dependencies.redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const result = await dependencies.getCurrentUser(sessionId);
  if (!result.ok) {
    if (result.kind === "unauthenticated") dependencies.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    throw new Error("Unable to validate the current session.");
  }
  return result.user;
}
