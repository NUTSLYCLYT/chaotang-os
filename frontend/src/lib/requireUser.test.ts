import assert from "node:assert/strict";
import test from "node:test";

import { requireUser } from "./requireUser.ts";

test("requireUser redirects an absent session to the safe login next URL", async () => {
  await assert.rejects(
    () => requireUser("/shiguan", {
      getSessionId: async () => null,
      getCurrentUser: async () => ({ ok: false, kind: "unauthenticated" }),
      redirect: (location) => { throw new Error(location); },
    }),
    /\/login\?next=%2Fshiguan/,
  );
});

test("requireUser redirects a backend-rejected session to the safe login next URL", async () => {
  await assert.rejects(
    () => requireUser("/study", {
      getSessionId: async () => "opaque-session",
      getCurrentUser: async () => ({ ok: false, kind: "unauthenticated" }),
      redirect: (location) => { throw new Error(location); },
    }),
    /\/login\?next=%2Fstudy/,
  );
});

test("requireUser returns only the public user after server-side validation", async () => {
  const user = await requireUser("/study", {
    getSessionId: async () => "opaque-session",
    getCurrentUser: async (sessionId) => {
      assert.equal(sessionId, "opaque-session");
      return { ok: true, status: 200, user: { id: "user-1", username: "court", email: "court@example.com" } };
    },
    redirect: (location) => { throw new Error(location); },
  });

  assert.deepEqual(user, { id: "user-1", username: "court", email: "court@example.com" });
});

test("requireUser accepts every first-batch protected court route", async () => {
  const protectedPaths = [
    "/dadian",
    "/junjichu",
    "/command-center",
    "/liubu",
    "/liubu/hubu",
    "/liubu/hubu/duzhi",
    "/zhuanshu",
    "/zhuanshu/jinyiwei",
    "/zhuanshu/jinyiwei/signal-001",
  ] as const;

  for (const nextPath of protectedPaths) {
    const user = await requireUser(nextPath, {
      getSessionId: async () => "opaque-session",
      getCurrentUser: async () => ({ ok: true, status: 200, user: { id: "user-1", username: "court", email: "court@example.com" } }),
      redirect: (location) => { throw new Error(location); },
    });
    assert.equal(user.username, "court");
  }
});
