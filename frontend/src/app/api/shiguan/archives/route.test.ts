import { test } from "node:test";
import assert from "node:assert/strict";

import { GET } from "./route.ts";

test("史馆档案 BFF：旧 DECISION 类型返回 400，且不转发后端", async () => {
  const response = await GET(
    new Request("http://localhost/api/shiguan/archives?type=DECISION"),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    status: "error",
    reason: "validation",
    message: "未知的史馆档案类型。",
  });
});
