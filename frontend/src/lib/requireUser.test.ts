import assert from "node:assert/strict";
import test from "node:test";

import { requireUser } from "./requireUser.ts";

test("A1 board login preserves only valid closed navigation", async () => {
  const good = "/junjichu/scene-board?mission=m-a&filter=high&panel=detail" as const;
  for (const [path, expected] of [[good, good], ["/junjichu/scene-board?mission=a&mission=b", "/dadian"], ["/junjichu/scene-board?panel=detail", "/dadian"]] as const) {
    await assert.rejects(() => requireUser(path, {
      getSessionId: async () => null,
      getCurrentUser: async () => { throw new Error("must not query without session"); },
      redirect: location => { throw new Error(location); },
    }), {message: "/login?next=" + encodeURIComponent(expected)});
  }
});

test("requireUser redirects an absent session to the safe login next URL", async () => {
  await assert.rejects(
    () => requireUser("/jinyiwei", {
      getSessionId: async () => null,
      getCurrentUser: async () => ({ ok: false, kind: "unauthenticated" }),
      redirect: (location) => { throw new Error(location); },
    }),
    /\/login\?next=%2Fjinyiwei/,
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

test("requireUser redirects stale sessions when the auth service cannot validate them", async () => {
  await assert.rejects(
    () => requireUser("/honglusi", {
      getSessionId: async () => "stale-session",
      getCurrentUser: async () => ({ ok: false, kind: "network" }),
      redirect: (location) => { throw new Error(location); },
    }),
    /\/login\?next=%2Fhonglusi/,
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
    "/jinyiwei",
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
