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
