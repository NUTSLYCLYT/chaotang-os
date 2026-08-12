import assert from "node:assert/strict";
import test from "node:test";
import { createGetHandler } from "./handler.ts";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (session = "opaque-session") => new Request("http://localhost/api/report-artifacts/x", { headers: session ? { cookie: `courtos_session=${session}` } : {} });

test("GET rejects missing session before backend call", async () => {
  let calls = 0;
  const handler = createGetHandler(async () => { calls += 1; throw new Error("must not call"); });
  assert.equal((await handler(request(""), context("artifact-1"))).status, 401);
  assert.equal(calls, 0);
});

for (const id of ["", " ", ".", "..", "a/b", "a%2Fb", "\\secret"]) {
  test(`GET rejects invalid artifact ID ${JSON.stringify(id)}`, async () => {
    let calls = 0;
    const handler = createGetHandler(async () => { calls += 1; throw new Error("must not call"); });
    assert.equal((await handler(request(), context(id))).status, 400);
    assert.equal(calls, 0);
  });
}

test("GET forwards session and streams only fixed XLSX headers and body", async () => {
  const bytes = new Uint8Array([80, 75, 3, 4]);
  let observed = "";
  const handler = createGetHandler(async (id, options) => {
    observed = `${id}|${options.sessionId}`;
    return { ok: true as const, response: new Response(bytes, { headers: {
      "content-type": XLSX, "content-disposition": "attachment; filename*=UTF-8''report.xlsx",
      "content-length": "4", "cache-control": "private, no-store",
      "x-content-type-options": "nosniff", "x-backend-url": "http://private-backend",
    } }) };
  });
  const response = await handler(request(), context("report 甲"));
  assert.equal(observed, "report 甲|opaque-session");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), XLSX);
  assert.equal(response.headers.get("x-backend-url"), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("GET replaces untrusted security headers and rejects malicious disposition and length", async () => {
  const handler = createGetHandler(async () => ({
    ok: true as const,
    response: new Response(new Uint8Array([80, 75]), { headers: {
      "content-type": `${XLSX}; charset=evil`,
      "content-disposition": "attachment; filename=\"../../secret.xlsx\"",
      "content-length": "02",
      "cache-control": "public, max-age=999999",
      "x-content-type-options": "off",
    } }),
  }));
  const response = await handler(request(), context("artifact-safe+v1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), XLSX);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-length"), null);
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment; filename\*=UTF-8''report-artifact\.xlsx$/);
});

test("GET refuses non-XLSX success without leaking body", async () => {
  const handler = createGetHandler(async () => ({ ok: true as const, response: new Response("private", { headers: { "content-type": "text/plain" } }) }));
  const response = await handler(request(), context("artifact-1"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private/);
});

for (const [kind, status] of [["unauthenticated", 401], ["not_found", 404], ["unavailable", 503]] as const) {
  test(`GET maps ${kind} to sanitized ${status}`, async () => {
    const handler = createGetHandler(async () => ({ ok: false as const, kind }));
    const response = await handler(request(), context("artifact-1"));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /opaque-session|private-backend/);
  });
}
