import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";

import { getCurrentUser, type BackendAuthResult, type PublicUser } from "./backendClient.ts";
import { SESSION_COOKIE_NAME } from "./session.ts";
import { BOARD_PATH, buildBoardPath, parseBoardPath, type BoardPath } from "../features/scene-packs/sceneBoardController.ts";

type ProtectedPath =
  | BoardPath
  | "/jinyiwei"
  | "/study"
  | "/shiguan"
  | "/dadian"
  | "/junjichu"
  | "/junjichu/scene-board"
  | `/scene-pack/${string}`
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
  if (nextPath.startsWith(BOARD_PATH)) {
    const board = parseBoardPath(nextPath);
    nextPath = board ? buildBoardPath(board) : "/dadian";
  }
  const sessionId = await dependencies.getSessionId();
  if (!sessionId) dependencies.redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const result = await dependencies.getCurrentUser(sessionId);
  if (!result.ok) {
    dependencies.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return result.user;
}
