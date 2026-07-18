import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  fetchHealth,
  getShiguanStatistics,
  listShiguanArchives,
  recallShiguanArchives,
  submitDecree,
  updateShiguanReview,
} from "./backendClient.ts";

/**
 * 契约文件路径：`frontend/src/lib` -> `frontend/src` -> `frontend` -> 仓库根，
 * 再进入 `docs/contracts`。与后端 `backend/tests/test_contract_health.py` 引用
 * 的是同一份 `docs/contracts/health.schema.json`，避免任一侧硬编码契约副本。
 */
const CONTRACT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/contracts/health.schema.json",
);

/**
 * `docs/contracts/health.schema.json` 中 `responseBody` 字段实际使用到的 JSON
 * Schema 关键字子集。刻意不引入 ajv 等通用 JSON Schema 校验库：契约文件当前只用
 * 到 `type`/`properties`/`required`/`additionalProperties`/`enum`/`minLength`
 * 这几个关键字，手写一个覆盖这些关键字的最小校验函数即可满足「真正读取同一份
 * 契约文件、不硬编码字段列表」的目标，避免为此引入额外依赖。
 */
interface JsonSchemaFragment {
  type?: string;
  properties?: Record<string, JsonSchemaFragment>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  minLength?: number;
}

interface HealthContract {
  path: string;
  method: string;
  successStatus: number;
  responseBody: JsonSchemaFragment;
}

function loadHealthContract(): HealthContract {
  const raw = readFileSync(CONTRACT_PATH, "utf-8");
  return JSON.parse(raw) as HealthContract;
}

/** 对 `value` 做字段级校验，返回违反契约的描述列表（空数组代表通过）。 */
function validateAgainstSchema(value: unknown, schema: JsonSchemaFragment): string[] {
  const errors: string[] = [];

  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push("value 不是一个对象");
      return errors;
    }
    const obj = value as Record<string, unknown>;
    const properties = schema.properties ?? {};

    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in obj)) {
        errors.push(`缺少必填字段：${requiredKey}`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) {
          errors.push(`出现契约之外的字段：${key}`);
        }
      }
    }

    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in obj)) {
        continue;
      }
      errors.push(
        ...validateAgainstSchema(obj[key], propSchema).map((error) => `字段 ${key}：${error}`),
      );
    }

    return errors;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`应为字符串，实际是 ${typeof value}`);
      return errors;
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`长度应不小于 ${schema.minLength}`);
    }
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
      errors.push(`值 "${value}" 不在允许的枚举 ${JSON.stringify(schema.enum)} 中`);
    }
    return errors;
  }

  return errors;
}

/**
 * `validateAgainstSchema()` 目前只实现了 `type: "object"` 与 `type: "string"`
 * 两种分支，以及 `required`/`additionalProperties`/`enum`/`minLength` 四个约束
 * 关键字。对于未实现的 `type`（例如 `"number"`/`"array"`/`"boolean"`）或未实现的
 * 关键字（例如 `"pattern"`/`"minimum"`/`"items"`），函数会直接跳过而不报错——这
 * 意味着如果契约文件未来新增此类约束，`validateAgainstSchema()` 会静默放行不合规
 * 的响应体，而不是抛出「不认识这个关键字」的明确失败。
 *
 * 这两个常量 + 下面的守护测试把这个隐式假设显式化：一旦
 * `docs/contracts/health.schema.json` 用到这里未列出的 `type` 或关键字，测试会
 * 立刻失败并提示「先更新 validateAgainstSchema() 再扩展契约」，而不是让校验器
 * 悄悄变得比契约本身宽松。
 */
const SCHEMA_TYPES_HANDLED_BY_VALIDATOR = new Set(["object", "string"]);
const SCHEMA_KEYWORDS_HANDLED_BY_VALIDATOR = new Set([
  "required",
  "additionalProperties",
  "enum",
  "minLength",
]);
/** 描述性/结构性关键字：不代表一个需要被 `validateAgainstSchema()` 强制执行的约束。 */
const SCHEMA_KEYWORDS_IGNORED_BY_DESIGN = new Set(["$schema", "description", "type", "properties"]);

interface SchemaFacts {
  types: Set<string>;
  keywords: Set<string>;
}

/** 递归收集一份 JSON Schema 片段中实际用到的 `type` 值与约束关键字。 */
function collectSchemaFacts(schema: JsonSchemaFragment, facts: SchemaFacts = { types: new Set(), keywords: new Set() }): SchemaFacts {
  if (schema.type !== undefined) {
    facts.types.add(schema.type);
  }
  for (const key of Object.keys(schema)) {
    if (SCHEMA_KEYWORDS_IGNORED_BY_DESIGN.has(key)) {
      continue;
    }
    facts.keywords.add(key);
  }
  if (schema.properties) {
    for (const propertySchema of Object.values(schema.properties)) {
      collectSchemaFacts(propertySchema, facts);
    }
  }
  return facts;
}

/** 启动一个只响应 `GET /health` 契约的本地 stub 服务，返回 base URL 和关闭函数。 */
async function startHealthStub(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const body = JSON.stringify({
        status: "ok",
        service: "chaotang-os-backend",
        version: "0.1.0",
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

/** 找一个当前空闲、但调用时保证没有服务监听的端口。 */
async function findUnusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

test("fetchHealth：成功路径 - 后端返回符合契约的响应时报告健康", async () => {
  const stub = await startHealthStub();
  try {
    const result = await fetchHealth({ baseUrl: stub.baseUrl });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        status: "ok",
        service: "chaotang-os-backend",
        version: "0.1.0",
      });
    }
  } finally {
    await stub.close();
  }
});

test("fetchHealth：成功路径响应体符合 docs/contracts/health.schema.json 契约", async () => {
  const contract = loadHealthContract();
  assert.equal(contract.path, "/health");
  assert.equal(contract.method, "GET");
  assert.equal(contract.successStatus, 200);

  const stub = await startHealthStub();
  try {
    const result = await fetchHealth({ baseUrl: stub.baseUrl });

    assert.equal(result.ok, true);
    if (result.ok) {
      const errors = validateAgainstSchema(result.data, contract.responseBody);
      assert.deepEqual(errors, []);
    }
  } finally {
    await stub.close();
  }
});

test("契约健全性检查：违反契约的响应体应被同一份 schema 判定为不合规", () => {
  const contract = loadHealthContract();

  const invalidPayloads: unknown[] = [
    { status: "not-ok", service: "chaotang-os-backend", version: "0.1.0" },
    { status: "ok", service: "chaotang-os-backend" },
    { status: "ok", service: "chaotang-os-backend", version: "0.1.0", extra: "field" },
    { status: "ok", service: "chaotang-os-backend", version: 1 },
  ];

  for (const payload of invalidPayloads) {
    const errors = validateAgainstSchema(payload, contract.responseBody);
    assert.ok(
      errors.length > 0,
      `期望被判定为违反契约，但校验通过：${JSON.stringify(payload)}`,
    );
  }
});

test("守护测试：validateAgainstSchema() 已实现契约当前用到的每个 type/关键字", () => {
  const contract = loadHealthContract();
  const facts = collectSchemaFacts(contract.responseBody);

  for (const type of facts.types) {
    assert.ok(
      SCHEMA_TYPES_HANDLED_BY_VALIDATOR.has(type),
      `docs/contracts/health.schema.json 用到了 type="${type}"，但 validateAgainstSchema()` +
        " 尚未实现对该类型的校验分支——请先扩展 validateAgainstSchema() 再依赖这条约束，" +
        "否则该类型的字段会被静默放行。",
    );
  }
  for (const keyword of facts.keywords) {
    assert.ok(
      SCHEMA_KEYWORDS_HANDLED_BY_VALIDATOR.has(keyword),
      `docs/contracts/health.schema.json 用到了关键字 "${keyword}"，但` +
        " validateAgainstSchema() 尚未实现该关键字的约束——请先扩展 validateAgainstSchema()" +
        " 再依赖这条约束，否则违反该约束的响应体会被静默放行。",
    );
  }
});

test("fetchHealth：失败路径 - 后端不可达时返回可判断的失败结果而不抛出异常", async () => {
  const unusedPort = await findUnusedPort();

  const result = await fetchHealth({
    baseUrl: `http://127.0.0.1:${unusedPort}`,
    timeoutMs: 1000,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.error, "string");
    assert.ok(result.error.length > 0);
  }
});

test("fetchHealth：失败路径 - 非 200 状态码时返回可判断的失败结果", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "error" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  try {
    const result = await fetchHealth({ baseUrl: `http://127.0.0.1:${address.port}` });
    assert.equal(result.ok, false);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

/**
 * 启动一个只响应 `POST /api/v1/decrees/chancellor` 的本地 stub 服务，返回固定的
 * `status`/`body`；用于离线测试 `submitDecree` 的各条分支，不依赖真实网络/DeepSeek。
 */
async function startDecreeStub(
  status: number,
  body: unknown,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/v1/decrees/chancellor") {
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(payload);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const SINGLE_ROUTE_BODY = {
  status: "ok",
  chancellor: "丞相",
  route_type: "single",
  rationale: "此事职责明确，交由户部办理即可。",
  processing_path: ["上书房", "丞相（首次分流）", "户部", "户部·预算司", "户部（部级补充）", "丞相（最终汇总）"],
  departments: ["户部"],
  ministry_opinions: [{ department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" }],
  council_verdict: null,
  final_verdict: "丞相汇总：预算可控，可分期拨付。",
  recommendations: ["核定预算", "分期拨付", "设置审计节点"],
};

const MULTI_ROUTE_BODY = {
  status: "ok",
  chancellor: "丞相",
  route_type: "multi",
  rationale: "此事涉及工程与钱粮，需户部、工部会同办理。",
  processing_path: ["上书房", "丞相（首次分流）", "军机处（召集）", "户部", "工部", "军机处（会审）", "丞相（最终汇总）"],
  departments: ["户部", "工部"],
  ministry_opinions: [
    { department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" },
    { department: "工部", bureau_opinions: [{ bureau: "进度司", opinion: "可分段施工。" }], opinion: "工部补充：按里程碑验收。" },
  ],
  council_verdict: "军机处会审：分期拨付并按里程碑验收。",
  final_verdict: "丞相汇总：准予分阶段兴修水利。",
  recommendations: ["先完成勘察", "分期拨付预算", "按里程碑验收"],
};

test("submitDecree：成功路径（single 路由）- 后端返回符合契约的响应时映射为 ok: true", async () => {
  const stub = await startDecreeStub(200, SINGLE_ROUTE_BODY);
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, true);
    if (result!.ok) {
      assert.deepEqual(result!.data, {
        status: "ok",
        chancellor: "丞相",
        routeType: "single",
        rationale: "此事职责明确，交由户部办理即可。",
        processingPath: SINGLE_ROUTE_BODY.processing_path,
        departments: ["户部"],
        ministryOpinions: [{ department: "户部", bureauOpinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "户部补充：分期拨付。" }],
        councilVerdict: null,
        finalVerdict: "丞相汇总：预算可控，可分期拨付。",
        recommendations: ["核定预算", "分期拨付", "设置审计节点"],
      });
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：成功路径（multi 路由）- 军机处会审字段完整映射为 ok: true", async () => {
  const stub = await startDecreeStub(200, MULTI_ROUTE_BODY);
  try {
    const result = await submitDecree("兴修水利并征调粮草以工代赈", { baseUrl: stub.baseUrl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.routeType, "multi");
      assert.deepEqual(result.data.departments, ["户部", "工部"]);
      assert.equal(result.data.ministryOpinions.length, 2);
      assert.equal(result.data.processingPath.includes("军机处（会审）"), true);
      assert.equal(result.data.councilVerdict, MULTI_ROUTE_BODY.council_verdict);
      assert.equal(result.data.recommendations.length, 3);
      assert.ok(result.data.finalVerdict.length > 0);
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：成功响应体缺少必需的新字段时回退为 kind: unknown", async () => {
  const incompleteBody: Record<string, unknown> = { ...SINGLE_ROUTE_BODY };
  delete incompleteBody.final_verdict;
  const stub = await startDecreeStub(200, incompleteBody);
  try {
    const result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  } finally {
    await stub.close();
  }
});

const INVALID_LAYERED_BODIES: Array<[string, () => Record<string, unknown>]> = [
  ["route_type 非 single/multi", () => ({ ...SINGLE_ROUTE_BODY, route_type: "other" })],
  [
    "部门与意见顺序不对应",
    () => ({
      ...SINGLE_ROUTE_BODY,
      ministry_opinions: [{ ...SINGLE_ROUTE_BODY.ministry_opinions[0], department: "工部" }],
    }),
  ],
  [
    "司级意见为空",
    () => ({
      ...SINGLE_ROUTE_BODY,
      ministry_opinions: [{ ...SINGLE_ROUTE_BODY.ministry_opinions[0], bureau_opinions: [] }],
    }),
  ],
  [
    "部门意见含额外字段",
    () => ({
      ...SINGLE_ROUTE_BODY,
      ministry_opinions: [{ ...SINGLE_ROUTE_BODY.ministry_opinions[0], extra: true }],
    }),
  ],
  [
    "司级意见含额外字段",
    () => ({
      ...SINGLE_ROUTE_BODY,
      ministry_opinions: [{
        ...SINGLE_ROUTE_BODY.ministry_opinions[0],
        bureau_opinions: [{ ...SINGLE_ROUTE_BODY.ministry_opinions[0].bureau_opinions[0], extra: true }],
      }],
    }),
  ],
  [
    "司级 opinion 为空白",
    () => ({
      ...SINGLE_ROUTE_BODY,
      ministry_opinions: [{
        ...SINGLE_ROUTE_BODY.ministry_opinions[0],
        bureau_opinions: [{ ...SINGLE_ROUTE_BODY.ministry_opinions[0].bureau_opinions[0], opinion: "   " }],
      }],
    }),
  ],
  ["single 含军机处结论", () => ({ ...SINGLE_ROUTE_BODY, council_verdict: "不应存在" })],
  ["multi 缺少军机处结论", () => ({ ...MULTI_ROUTE_BODY, council_verdict: null })],
  ["multi 军机处结论为空白", () => ({ ...MULTI_ROUTE_BODY, council_verdict: "   " })],
  ["建议不足三项", () => ({ ...SINGLE_ROUTE_BODY, recommendations: ["一", "二"] })],
  ["建议超过三项", () => ({ ...SINGLE_ROUTE_BODY, recommendations: ["一", "二", "三", "四"] })],
  ["建议含空白项", () => ({ ...SINGLE_ROUTE_BODY, recommendations: ["一", "   ", "三"] })],
  ["建议含非字符串项", () => ({ ...SINGLE_ROUTE_BODY, recommendations: ["一", 2, "三"] })],
  [
    "建议去空白后重复",
    () => ({ ...SINGLE_ROUTE_BODY, recommendations: ["同一项", " 同一项 ", "第三项"] }),
  ],
];

for (const [name, makeBody] of INVALID_LAYERED_BODIES) {
  test(`submitDecree：${name}的成功响应被拒绝为 unknown`, async () => {
    const stub = await startDecreeStub(200, makeBody());
    try {
      const result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.kind, "unknown");
      }
    } finally {
      await stub.close();
    }
  });
}

test("submitDecree：校验失败路径 - 422 映射为 kind: validation", async () => {
  const stub = await startDecreeStub(422, {
    detail: [{ msg: "旨意长度不合法" }],
  });
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, false);
    if (!result!.ok) {
      assert.equal(result!.kind, "validation");
      assert.equal(typeof result!.error, "string");
      assert.ok(result!.error.length > 0);
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：配置失败路径 - 503 映射为 kind: config", async () => {
  const stub = await startDecreeStub(503, {
    status: "error",
    reason: "config_unavailable",
    message: "后端配置暂不可用，请稍后重试。",
  });
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, false);
    if (!result!.ok) {
      assert.equal(result!.kind, "config");
      assert.equal(result!.error, "后端配置暂不可用，请稍后重试。");
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：模型失败路径 - 502 映射为 kind: model", async () => {
  const stub = await startDecreeStub(502, {
    status: "error",
    reason: "model_unavailable",
    message: "丞相暂时无法给出回奏，请稍后重试。",
  });
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, false);
    if (!result!.ok) {
      assert.equal(result!.kind, "model");
      assert.equal(result!.error, "丞相暂时无法给出回奏，请稍后重试。");
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：后端不可达路径 - 映射为 kind: network，且不抛出异常", async () => {
  const unusedPort = await findUnusedPort();

  let threw = false;
  let result;
  try {
    result = await submitDecree("请核查国库存银", {
      baseUrl: `http://127.0.0.1:${unusedPort}`,
      timeoutMs: 1000,
    });
  } catch {
    threw = true;
  }

  assert.equal(threw, false, "submitDecree 不应抛出异常");
  assert.ok(result);
  assert.equal(result!.ok, false);
  if (!result!.ok) {
    assert.equal(result!.kind, "network");
    assert.equal(typeof result!.error, "string");
    assert.ok(result!.error.length > 0);
  }
});

test("submitDecree：请求耗时超过自定义 timeoutMs 时超时中止，映射为 kind: network", async () => {
  /**
   * `DECREE_TIMEOUT_MS` 默认值已上调至 120000ms（见模块内注释与新 ADR），本测试不
   * 依赖该默认值、也不真实等待 120s：通过显式传入一个远小于服务端响应延迟的
   * `timeoutMs`，覆盖默认值来验证超时（`AbortController`）分支本身仍然生效。
   */
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/v1/decrees/chancellor") {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(SINGLE_ROUTE_BODY));
      }, 500);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  try {
    const result = await submitDecree("请核查国库存银", {
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 50,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "network");
      assert.equal(result.error, "请求超时");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("submitDecree：非预期状态码路径 - 映射为 kind: unknown", async () => {
  const stub = await startDecreeStub(500, { detail: "internal error" });
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, false);
    if (!result!.ok) {
      assert.equal(result!.kind, "unknown");
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：非法 JSON 响应体路径 - 映射为 kind: unknown", async () => {
  const stub = await startDecreeStub(200, "not-json{");
  try {
    let threw = false;
    let result;
    try {
      result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "submitDecree 不应抛出异常");
    assert.ok(result);
    assert.equal(result!.ok, false);
    if (!result!.ok) {
      assert.equal(result!.kind, "unknown");
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：final_verdict 全是空白的成功响应被拒绝为 unknown", async () => {
  const stub = await startDecreeStub(200, { ...SINGLE_ROUTE_BODY, final_verdict: "   " });
  try {
    const result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  } finally {
    await stub.close();
  }
});

test("submitDecree：ministry_opinions 中某一部门 opinion 为空白时被拒绝为 unknown", async () => {
  const stub = await startDecreeStub(200, {
    ...SINGLE_ROUTE_BODY,
    ministry_opinions: [{ department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "   " }],
  });
  try {
    const result = await submitDecree("请核查国库存银", { baseUrl: stub.baseUrl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  } finally {
    await stub.close();
  }
});

test("getBackendBaseUrl", async () => {
  const { getBackendBaseUrl } = await import("./backendClient.ts");
  const original = process.env.BACKEND_BASE_URL;
  try {
    delete process.env.BACKEND_BASE_URL;
    assert.equal(getBackendBaseUrl(), "http://127.0.0.1:8000");

    process.env.BACKEND_BASE_URL = "http://example.invalid:9000";
    assert.equal(getBackendBaseUrl(), "http://example.invalid:9000");
  } finally {
    if (original === undefined) {
      delete process.env.BACKEND_BASE_URL;
    } else {
      process.env.BACKEND_BASE_URL = original;
    }
  }
});

const SHIGUAN_ARCHIVE_BODY = {
  id: "archive-1",
  type: "DECISION",
  title: "整顿漕运",
  content: "裁撤冗费并按月核验。",
  matter_type: "漕运",
  department: "户部",
  related_archive_ids: [],
  evidence: [{ source: "奏折原文", reality_label: "LIVE", note: "实盘" }],
  created_at: "2026-07-17T00:00:00+00:00",
  lessons_learned: "先核验账册再拨款。",
  pitfalls: "不可把演示账册当真实账册。",
  participating_departments: ["户部", "工部"],
  decision_process: "户部核账，工部复核河工。",
  decision_conclusion: "准行。",
  decision_time: "2026-07-17T00:10:00+00:00",
  responsible_owner: "户部尚书",
  review_status: {
    status: "PARTIAL",
    reviewed_at: "2026-07-17T00:20:00+00:00",
    note: "仍需观察河工进度。",
  },
};

async function startShiguanStub(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
  seenUrls: string[];
}> {
  const seenUrls: string[] = [];
  const server: Server = createServer((req, res) => {
    seenUrls.push(`${req.method} ${req.url}`);
    if (req.method === "GET" && req.url?.startsWith("/api/v1/shiguan/archives")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([SHIGUAN_ARCHIVE_BODY]));
      return;
    }
    if (req.method === "GET" && req.url === "/api/v1/shiguan/statistics") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          total: 2,
          achieved: 1,
          not_achieved: 0,
          partial: 1,
          observing: 0,
          pending_review: 0,
          success_rate: 0.5,
        }),
      );
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/shiguan/recall") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify([
          {
            archive_id: "archive-1",
            match_reason: "事项类型一致",
            historical_conclusion: "准行。",
            evidence_labels: ["LIVE"],
            review_status: {
              status: "PARTIAL",
              reviewed_at: "2026-07-17T00:20:00+00:00",
              note: "仍需观察河工进度。",
            },
            lessons_learned: "先核验账册再拨款。",
            pitfalls: "不可把演示账册当真实账册。",
          },
        ]),
      );
      return;
    }
    if (req.method === "PATCH" && req.url === "/api/v1/shiguan/archives/archive-1/review") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ACHIEVED",
          reviewed_at: "2026-07-17T01:00:00+00:00",
          note: "已达成。",
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "not found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    seenUrls,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test("史馆客户端：列表、统计、召回与复盘更新映射为前端 camelCase 契约", async () => {
  const stub = await startShiguanStub();
  try {
    const archives = await listShiguanArchives({
      baseUrl: stub.baseUrl,
      type: "DECISION",
      matterType: "漕运",
      department: "户部",
      limit: 10,
    });
    assert.equal(archives.ok, true);
    if (archives.ok) {
      assert.equal(archives.data[0].id, "archive-1");
      assert.equal(archives.data[0].matterType, "漕运");
      assert.equal(archives.data[0].evidence[0].realityLabel, "LIVE");
      assert.equal(archives.data[0].reviewStatus?.status, "PARTIAL");
      assert.deepEqual(archives.data[0].participatingDepartments, ["户部", "工部"]);
    }

    const statistics = await getShiguanStatistics({ baseUrl: stub.baseUrl });
    assert.equal(statistics.ok, true);
    if (statistics.ok) {
      assert.equal(statistics.data.notAchieved, 0);
      assert.equal(statistics.data.pendingReview, 0);
      assert.equal(statistics.data.successRate, 0.5);
    }

    const recall = await recallShiguanArchives({
      baseUrl: stub.baseUrl,
      matterType: "漕运",
      department: "户部",
    });
    assert.equal(recall.ok, true);
    if (recall.ok) {
      assert.equal(recall.data[0].archiveId, "archive-1");
      assert.deepEqual(recall.data[0].evidenceLabels, ["LIVE"]);
      assert.equal(recall.data[0].historicalConclusion, "准行。");
      assert.equal(recall.data[0].reviewStatus?.status, "PARTIAL");
      assert.equal(recall.data[0].lessonsLearned, "先核验账册再拨款。");
    }

    const review = await updateShiguanReview("archive-1", "ACHIEVED", "已达成。", {
      baseUrl: stub.baseUrl,
    });
    assert.equal(review.ok, true);
    if (review.ok) {
      assert.equal(review.data.status, "ACHIEVED");
      assert.equal(review.data.note, "已达成。");
    }

    assert.ok(
      stub.seenUrls.includes(
        "GET /api/v1/shiguan/archives?type=DECISION&matter_type=%E6%BC%95%E8%BF%90&department=%E6%88%B7%E9%83%A8&limit=10",
      ),
    );
  } finally {
    await stub.close();
  }
});

test("史馆客户端：后端校验失败时返回 validation，不抛异常", async () => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(422, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "error",
        reason: "validation_failed",
        message: "至少提供 matter_type 或 department",
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  try {
    const result = await recallShiguanArchives({
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "validation");
      assert.equal(result.error, "至少提供 matter_type 或 department");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function withShiguanBody(
  body: unknown,
  path: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("史馆客户端：召回接受真实后端字段并拒绝畸形对象型复盘", async () => {
  const validRecall = {
    archive_id: "archive-1",
    match_reason: "事项类型+部门匹配",
    historical_conclusion: "准行。",
    evidence_labels: ["LIVE", "MIXED"],
    review_status: {
      status: "PARTIAL",
      reviewed_at: "2026-07-17T00:20:00+00:00",
      note: "仍需观察。",
    },
    lessons_learned: "先核账。",
    pitfalls: null,
  };
  await withShiguanBody([validRecall], "", async (baseUrl) => {
    const result = await recallShiguanArchives({ baseUrl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data[0].historicalConclusion, "准行。");
      assert.equal(result.data[0].reviewStatus?.reviewedAt, "2026-07-17T00:20:00+00:00");
    }
  });
  await withShiguanBody(
    [{ ...validRecall, review_status: { status: "PARTIAL", reviewed_at: 123 } }],
    "",
    async (baseUrl) => {
      const result = await recallShiguanArchives({ baseUrl });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.kind, "unknown");
    },
  );
});

test("史馆客户端：畸形档案复盘和不完整 DECISION 留痕返回 unknown", async () => {
  for (const body of [
    [{ ...SHIGUAN_ARCHIVE_BODY, review_status: { status: "PARTIAL" } }],
    [{ ...SHIGUAN_ARCHIVE_BODY, review_status: undefined }],
    [{ ...SHIGUAN_ARCHIVE_BODY, decision_process: null }],
  ]) {
    await withShiguanBody(body, "", async (baseUrl) => {
      const result = await listShiguanArchives({ baseUrl });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.kind, "unknown");
    });
  }
});

test("史馆客户端：非 JSON 与网络错误使用稳定中文", async () => {
  await withShiguanBody("not-json", "", async (baseUrl) => {
    const result = await getShiguanStatistics({ baseUrl });
    assert.deepEqual(result, {
      ok: false,
      kind: "unknown",
      error: "史馆后端响应不是合法 JSON",
    });
  });
  const result = await getShiguanStatistics({ baseUrl: "http://127.0.0.1:1", timeoutMs: 100 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "无法连接后端，请稍后重试");
});
