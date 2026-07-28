import assert from "node:assert/strict";
import test from "node:test";

import { createCasesHandler } from "./route.ts";

test("cases BFF returns 401 before consulting the backend when session is absent", async () => {
  let calls = 0;
  const handler = createCasesHandler(async () => {
    calls += 1;
    return { ok: true, data: [] };
  });

  const response = await handler(new Request("http://local/api/junjichu/cases"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    status: "error",
    reason: "unauthenticated",
    message: "authentication required",
  });
  assert.equal(calls, 0);
});

test("cases BFF rejects unsupported and owner query fields without forwarding them", async () => {
  let calls = 0;
  const handler = createCasesHandler(async () => {
    calls += 1;
    return { ok: true, data: [] };
  });

  for (const query of ["owner_user_id=owner-1", "unknown=value", "status=A&status=B"]) {
    const response = await handler(
      new Request(`http://local/api/junjichu/cases?${query}`, {
        headers: { cookie: "courtos_session=test-session" },
      }),
    );
    assert.equal(response.status, 400, query);
  }
  assert.equal(calls, 0);
});

test("cases BFF forwards only accepted filters and the opaque server session", async () => {
  let seen: unknown;
  const handler = createCasesHandler(async (options) => {
    seen = options;
    return { ok: true, data: [] };
  });

  const response = await handler(
    new Request("http://local/api/junjichu/cases?status=ARCHIVED&department=%E5%85%B5%E9%83%A8&keyword=%E8%BE%B9%E9%98%B2", {
      headers: { cookie: "courtos_session=test-session" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", cases: [] });
  assert.deepEqual(seen, {
    status: "ARCHIVED",
    department: "兵部",
    keyword: "边防",
    sessionId: "test-session",
  });
});

test("cases BFF maps backend failures without exposing backend details", async () => {
  const handler = createCasesHandler(async () => ({
    ok: false,
    kind: "storage",
    error: "D:/private/junjichu_cases.sqlite3",
  }));

  const response = await handler(
    new Request("http://local/api/junjichu/cases", {
      headers: { cookie: "courtos_session=test-session" },
    }),
  );

  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("junjichu_cases.sqlite3"), false);
});
