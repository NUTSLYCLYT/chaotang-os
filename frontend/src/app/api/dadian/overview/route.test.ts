import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { GET } from "./route.ts";

const backendOverview = {
  reply_count: 2,
  department_counts: [
    { department: "户部", count: 2 },
    { department: "兵部", count: 1 },
  ],
  recent_replies: [
    {
      id: "reply-1",
      title: "边储核验回奏",
      participating_departments: ["户部", "兵部"],
      reply_conclusion: "现有储备足以支应。",
      reply_time: "2026-07-24T08:00:00Z",
      created_at: "2026-07-24T08:00:01Z",
      respondent: "丞相",
    },
  ],
  pending_review_count: 1,
  today_focus: "复核边储调拨依据",
};

async function startOverviewStub(status = 200): Promise<{
  baseUrl: string;
  authorization: () => string | undefined;
  requestUrl: () => string | undefined;
  close(): Promise<void>;
}> {
  let lastAuthorization: string | undefined;
  let lastRequestUrl: string | undefined;
  const server: Server = createServer((request, response) => {
    lastAuthorization = request.headers.authorization;
    lastRequestUrl = request.url;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        status === 200
          ? backendOverview
          : { detail: "invalid department" },
      ),
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    authorization: () => lastAuthorization,
    requestUrl: () => lastRequestUrl,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function withBackendBaseUrl<T>(
  baseUrl: string,
  run: () => Promise<T>,
): Promise<T> {
  const original = process.env.BACKEND_BASE_URL;
  process.env.BACKEND_BASE_URL = baseUrl;
  try {
    return await run();
  } finally {
    if (original === undefined) delete process.env.BACKEND_BASE_URL;
    else process.env.BACKEND_BASE_URL = original;
  }
}

test("Dadian overview BFF rejects callers without the protected session cookie", async () => {
  const response = await GET(
    new Request("http://localhost/api/dadian/overview?department=户部"),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    status: "error",
    reason: "unauthenticated",
    message: "authentication required",
  });
});

test("Dadian overview BFF forwards only the session and selected department", async () => {
  const stub = await startOverviewStub();
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      GET(
        new Request(
          "http://localhost/api/dadian/overview?department=%E6%88%B7%E9%83%A8",
          { headers: { cookie: "courtos_session=opaque-session" } },
        ),
      ),
    );

    assert.equal(response.status, 200);
    assert.equal(stub.authorization(), "Bearer opaque-session");
    assert.equal(
      stub.requestUrl(),
      "/api/v1/shiguan/dadian-overview?department=%E6%88%B7%E9%83%A8",
    );
    assert.deepEqual(await response.json(), {
      status: "ok",
      overview: {
        replyCount: 2,
        departmentCounts: [
          { department: "户部", count: 2 },
          { department: "兵部", count: 1 },
        ],
        recentReplies: [
          {
            id: "reply-1",
            title: "边储核验回奏",
            participatingDepartments: ["户部", "兵部"],
            replyConclusion: "现有储备足以支应。",
            replyTime: "2026-07-24T08:00:00Z",
            createdAt: "2026-07-24T08:00:01Z",
            respondent: "丞相",
          },
        ],
        pendingReviewCount: 1,
        todayFocus: "复核边储调拨依据",
      },
    });
  } finally {
    await stub.close();
  }
});

test("Dadian overview BFF maps backend validation failure without leaking details", async () => {
  const stub = await startOverviewStub(422);
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      GET(
        new Request("http://localhost/api/dadian/overview?department=不存在", {
          headers: { cookie: "courtos_session=opaque-session" },
        }),
      ),
    );

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      status: "error",
      reason: "validation",
      message: "大殿概览暂时不可用，请稍后重试。",
    });
  } finally {
    await stub.close();
  }
});

test("Dadian overview BFF preserves a backend 401 as unauthenticated", async () => {
  const stub = await startOverviewStub(401);
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      GET(
        new Request("http://localhost/api/dadian/overview", {
          headers: { cookie: "courtos_session=expired-session" },
        }),
      ),
    );

    assert.equal(response.status, 401);
    assert.equal(stub.authorization(), "Bearer expired-session");
    assert.deepEqual(await response.json(), {
      status: "error",
      reason: "unauthenticated",
      message: "authentication required",
    });
  } finally {
    await stub.close();
  }
});
