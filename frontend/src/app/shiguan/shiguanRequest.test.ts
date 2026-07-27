import assert from "node:assert/strict";
import test from "node:test";

import { ShiguanUiError } from "./shiguanController.ts";
import { requestShiguanJson } from "./shiguanRequest.ts";

test("empty and HTML 401 responses remain unauthenticated before JSON decoding", async () => {
  for (const response of [
    new Response(null, { status: 401 }),
    new Response("<html>expired</html>", {
      status: 401,
      headers: { "content-type": "text/html" },
    }),
  ]) {
    await assert.rejects(
      requestShiguanJson(
        "/api/shiguan/archives",
        {},
        () => [],
        async () => response,
      ),
      (error: unknown) =>
        error instanceof ShiguanUiError &&
        error.kind === "unauthenticated",
    );
  }
});

test("401 status never invokes a throwing JSON decoder", async () => {
  let jsonCalls = 0;
  const response = {
    status: 401,
    ok: false,
    json() {
      jsonCalls += 1;
      throw new Error("401 bodies must not be decoded");
    },
  } as unknown as Response;

  await assert.rejects(
    requestShiguanJson(
      "/api/shiguan/archives",
      {},
      () => [],
      async () => response,
    ),
    (error: unknown) =>
      error instanceof ShiguanUiError &&
      error.kind === "unauthenticated",
  );
  assert.equal(jsonCalls, 0);
});

test("401 status classifies immediately without waiting for a never-settling JSON decoder", async () => {
  let jsonCalls = 0;
  const response = {
    status: 401,
    ok: false,
    json() {
      jsonCalls += 1;
      return new Promise<never>(() => {});
    },
  } as unknown as Response;
  let classification = "pending";

  void requestShiguanJson(
    "/api/shiguan/archives",
    {},
    () => [],
    async () => response,
  ).then(
    () => {
      classification = "resolved";
    },
    (error: unknown) => {
      classification = error instanceof ShiguanUiError ? error.kind : "other";
    },
  );
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(jsonCalls, 0);
  assert.equal(classification, "unauthenticated");
});

test("non-401 error responses still decode their JSON body best-effort", async () => {
  let jsonCalls = 0;
  const response = {
    status: 422,
    ok: false,
    async json() {
      jsonCalls += 1;
      return {
        status: "error",
        reason: "validation",
        message: "invalid archive filter",
      };
    },
  } as unknown as Response;

  await assert.rejects(
    requestShiguanJson(
      "/api/shiguan/archives",
      {},
      () => [],
      async () => response,
    ),
    (error: unknown) =>
      error instanceof ShiguanUiError &&
      error.kind === "validation" &&
      error.message === "invalid archive filter",
  );
  assert.equal(jsonCalls, 1);
});
