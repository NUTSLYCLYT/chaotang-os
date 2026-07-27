import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  fetchHealth,
  getShiguanStatistics,
  listShiguanArchives,
  recallShiguanArchives,
  submitDecree,
  type JinyiweiReadOptions,
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
const JINYIWEI_MODEL_DUMP_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/jinyiwei-model-dump.json",
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

function memoryRequestOptions(
  body: unknown,
  status = 200,
  observe?: (input: RequestInfo | URL, init?: RequestInit) => void,
) {
  const fetchImpl: typeof fetch = async (input, init) => {
    observe?.(input, init);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    baseUrl: "https://unused.invalid",
    fetchImpl,
    scheduleTimeout: () => "deterministic-memory-timeout",
    cancelTimeout: (handle: unknown) => assert.equal(handle, "deterministic-memory-timeout"),
  };
}

test("fetchHealth：成功路径 - 后端返回符合契约的响应时报告健康", async () => {
  const result = await fetchHealth(memoryRequestOptions({
    status: "ok",
    service: "chaotang-os-backend",
    version: "0.1.0",
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      status: "ok",
      service: "chaotang-os-backend",
      version: "0.1.0",
    });
  }
});

test("fetchHealth：纯响应测试可注入内存 fetch 与确定性 timer", async () => {
  let fetchCalls=0,scheduled=0,cancelled=0;
  const result=await fetchHealth({
    baseUrl:"unsupported://unused",
    fetchImpl:async()=>{fetchCalls+=1;return new Response(JSON.stringify({status:"ok",service:"chaotang-backend",version:"0.1.0"}),{status:200});},
    scheduleTimeout:()=>{scheduled+=1;return "health-timeout";},
    cancelTimeout:(handle)=>{assert.equal(handle,"health-timeout");cancelled+=1;},
  });
  assert.equal(result.ok,true);
  assert.equal(fetchCalls,1);assert.equal(scheduled,1);assert.equal(cancelled,1);
});

test("fetchHealth：成功路径响应体符合 docs/contracts/health.schema.json 契约", async () => {
  const contract = loadHealthContract();
  assert.equal(contract.path, "/health");
  assert.equal(contract.method, "GET");
  assert.equal(contract.successStatus, 200);

  const result = await fetchHealth(memoryRequestOptions({
    status: "ok",
    service: "chaotang-os-backend",
    version: "0.1.0",
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    const errors = validateAgainstSchema(result.data, contract.responseBody);
    assert.deepEqual(errors, []);
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
  const result = await fetchHealth({
    ...memoryRequestOptions(null),
    fetchImpl: async () => { throw new TypeError("injected network failure"); },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.error, "string");
    assert.ok(result.error.length > 0);
  }
});

test("fetchHealth：失败路径 - 非 200 状态码时返回可判断的失败结果", async () => {
  const result = await fetchHealth(memoryRequestOptions({ status: "error" }, 500));
  assert.equal(result.ok, false);
});

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
  const result = await submitDecree("请核查国库存银", memoryRequestOptions(SINGLE_ROUTE_BODY));
  assert.equal(result.ok, true);
  if (result.ok) {
      assert.deepEqual(result.data, {
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
});

test("submitDecree：成功路径（multi 路由）- 军机处会审字段完整映射为 ok: true", async () => {
    const result = await submitDecree("兴修水利并征调粮草以工代赈", memoryRequestOptions(MULTI_ROUTE_BODY));
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
});

test("submitDecree：成功响应体缺少必需的新字段时回退为 kind: unknown", async () => {
  const incompleteBody: Record<string, unknown> = { ...SINGLE_ROUTE_BODY };
  delete incompleteBody.final_verdict;
    const result = await submitDecree("请核查国库存银", memoryRequestOptions(incompleteBody));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
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
    let fetchCalls = 0;
    let scheduled = 0;
    let cancelled = 0;
    const result = await submitDecree("请核查国库存银", {
      baseUrl: "https://unused.invalid",
      fetchImpl: async (_input, init) => {
        fetchCalls += 1;
        assert.equal(init?.method, "POST");
        return new Response(JSON.stringify(makeBody()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      scheduleTimeout: () => {
        scheduled += 1;
        return "deterministic-timeout";
      },
      cancelTimeout: (handle) => {
        assert.equal(handle, "deterministic-timeout");
        cancelled += 1;
      },
    });

    assert.equal(fetchCalls, 1);
    assert.equal(scheduled, 1);
    assert.equal(cancelled, 1);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  });
}

test("submitDecree：校验失败路径 - 422 映射为 kind: validation", async () => {
  const result = await submitDecree("", memoryRequestOptions({
    detail: [{ msg: "旨意长度不合法" }],
  },422));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "validation");
    assert.ok(result.error.length > 0);
  }
});

test("submitDecree：配置失败路径 - 503 映射为 kind: config", async () => {
  const result = await submitDecree("请核查国库存银", memoryRequestOptions({
    status: "error",
    reason: "config_unavailable",
    message: "后端配置暂不可用，请稍后重试。",
  },503));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "config");
    assert.equal(result.error, "后端配置暂不可用，请稍后重试。");
  }
});

test("submitDecree：模型失败路径 - 502 映射为 kind: model", async () => {
  const result = await submitDecree("请核查国库存银", memoryRequestOptions({
    status: "error",
    reason: "model_unavailable",
    message: "丞相暂时无法给出回奏，请稍后重试。",
  },502));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "model");
    assert.equal(result.error, "丞相暂时无法给出回奏，请稍后重试。");
  }
});

test("submitDecree：后端不可达路径 - 映射为 kind: network，且不抛出异常", async () => {
  const result = await submitDecree("请核查国库存银", {
    ...memoryRequestOptions(null),
    fetchImpl: async()=>{throw new TypeError("injected network failure");},
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "network");
    assert.ok(result.error.length > 0);
  }
});

test("submitDecree：请求耗时超过自定义 timeoutMs 时超时中止，映射为 kind: network", async () => {
  /**
   * `DECREE_TIMEOUT_MS` 默认值已上调至 120000ms（见模块内注释与新 ADR），本测试不
   * 依赖该默认值、也不真实等待 120s：通过显式传入一个远小于服务端响应延迟的
   * `timeoutMs`，覆盖默认值来验证超时（`AbortController`）分支本身仍然生效。
   */
  const result = await submitDecree("请核查国库存银", {
    baseUrl:"https://unused.invalid",
    timeoutMs:10,
    fetchImpl:async(_input,init)=>new Promise<Response>((_resolve,reject)=>{
      init?.signal?.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true});
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "network");
    assert.equal(result.error, "请求超时");
  }
});

test("submitDecree：非预期状态码路径 - 映射为 kind: unknown", async () => {
  const result = await submitDecree("请核查国库存银", memoryRequestOptions({detail:"internal error"},500));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "unknown");
  }
});

test("submitDecree：非法 JSON 响应体路径 - 映射为 kind: unknown", async () => {
  const result = await submitDecree("请核查国库存银", memoryRequestOptions("not-json{"));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "unknown");
  }
});

test("submitDecree：final_verdict 全是空白的成功响应被拒绝为 unknown", async () => {
    const result = await submitDecree("请核查国库存银", memoryRequestOptions({ ...SINGLE_ROUTE_BODY, final_verdict: "   " }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
});

test("submitDecree：ministry_opinions 中某一部门 opinion 为空白时被拒绝为 unknown", async () => {
  const result = await submitDecree("请核查国库存银", memoryRequestOptions({
    ...SINGLE_ROUTE_BODY,
    ministry_opinions: [{ department: "户部", bureau_opinions: [{ bureau: "预算司", opinion: "预算可控。" }], opinion: "   " }],
  }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
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
  type: "REPLY",
  title: "整顿漕运回奏",
  content: "裁撤冗费并按月核验。",
  matter_type: "漕运",
  department: "户部",
  related_archive_ids: [],
  evidence: [{ source: "奏折原文", reality_label: "LIVE", note: "实盘" }],
  created_at: "2026-07-17T00:00:00+00:00",
  lessons_learned: "先核验账册再拨款。",
  pitfalls: "不可把演示账册当真实账册。",
  source_kind: "DECREE",
  source_text: "着户部会同工部核查漕运。",
  participating_departments: ["户部", "工部"],
  reply_process: "户部核账，工部复核河工。",
  reply_conclusion: "准行。",
  reply_time: "2026-07-17T00:10:00+00:00",
  respondent: "户部尚书",
  review_status: {
    status: "PARTIAL",
    reviewed_at: "2026-07-17T00:20:00+00:00",
    note: "仍需观察河工进度。",
  },
  evidence_references: [],
};

const JINYIWEI_EVIDENCE = {
  evidence_id: "ev-1", fact_key: "amount", value: { amount: 12, rows: [true, null, { unit: "两" }] },
  unit: "两", as_of: "2026-07-20T01:00:00+00:00", retrieved_at: "2026-07-20T01:01:00+00:00",
  source_url: "https://example.invalid/source", publisher: "官署公报", source_type: "PUBLIC_API",
  quality: "AUTHORITATIVE", stance: "SUPPORTS", excerpt: "记载十二两。", content_hash: "a".repeat(64), confidence: 0.9,
};

const JINYIWEI_DETAIL = {
  pack_id: "pack-1", investigation_id: "inv/一", status: "RESOLVED",
  request: { requesting_agent: "户部度支司", question: "数额为何？", required_facts: [{ key: "amount", description: "核定数额", expected_unit: "两", expected_shape: "number" }], decision_context: "用于司级意见", freshness: { max_age_seconds: 3600, not_before: null }, existing_evidence_ids: [], request_id: "req-1", timeout_seconds: 30, source_scope: ["PUBLIC_API"] },
  investigation_plan: { fact_keys: ["amount"], source_scope: ["PUBLIC_API"] },
  evidence_by_fact: { amount: [JINYIWEI_EVIDENCE] }, historical_evidence_by_fact: { amount: [] },
  resolved_facts: ["amount"], unresolved_facts: [], conflicts: [],
  source_attempts: [{ source_type: "PUBLIC_API", source_name: "Wikidata", status: "SUCCEEDED", started_at: "2026-07-20T01:00:00+00:00", completed_at: "2026-07-20T01:01:00+00:00", error: null, facts_attempted: ["amount"], call_audits: [] }],
  investigation_started_at: "2026-07-20T01:00:00+00:00", investigation_completed_at: "2026-07-20T01:01:00+00:00",
  cache: { hit: false, cache_key: null, cached_at: null, expires_at: null }, do_not_infer: [],
  adoptions: [{ evidence_id: "ev-1", reply_id: "reply-1", status: "CONFIRMED", created_at: "2026-07-20T01:02:00+00:00", updated_at: "2026-07-20T01:03:00+00:00", confirmed_at: "2026-07-20T01:03:00+00:00" }],
};

Object.assign(JINYIWEI_DETAIL.request.required_facts[0], {
  category: "PUBLIC_STATISTIC", data_scope: "EXTERNAL_PUBLIC",
  subject: "National treasury", jurisdiction: "CN",
});
Object.assign(JINYIWEI_EVIDENCE, {
  published_at: "2026-07-20T01:00:00+00:00", coverage: ["CN"],
  license_note: "Free public source.", access_url: null, access_metadata: null,
});

function jinyiweiReadOptions(body: unknown): JinyiweiReadOptions {
  return {
    baseUrl: "https://unused.invalid",
    fetchImpl: async (_input, init) => {
      assert.equal(init?.method, "GET");
      return new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    scheduleTimeout: () => "deterministic-jinyiwei-timeout",
    cancelTimeout: (handle) => {
      assert.equal(handle, "deterministic-jinyiwei-timeout");
    },
  };
}

test("锦衣卫客户端接受真实后端 model_dump 的 MCP、历史证据与访问溯源字段", async () => {
  const fixture = JSON.parse(readFileSync(JINYIWEI_MODEL_DUMP_PATH, "utf-8")) as {
    _provenance: string;
    investigation_detail: unknown;
  };
  assert.match(fixture._provenance, /schema-v4 backend/);
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  const result = await getJinyiweiInvestigation(
    "inv-model-dump",
    jinyiweiReadOptions(fixture.investigation_detail),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.request.requiredFacts[0].dataScope, "EXTERNAL_PUBLIC");
    assert.equal(result.data.request.sourceScope[0], "MCP");
    assert.equal(result.data.evidenceByFact.quote[0].sourceType, "MCP");
    assert.equal(
      result.data.evidenceByFact.quote[0].accessUrl,
      "https://example.test/mcp/quote/002594",
    );
    assert.equal(
      result.data.evidenceByFact.quote[0].accessMetadata?.mcp_tool_name,
      "data_quote",
    );
    assert.equal(result.data.historicalEvidenceByFact.quote[0].evidenceId, "ev-api-historical");
    assert.equal(result.data.sourceAttempts[0].callAudits[0].toolName, "data_quote");
    assert.equal(result.data.sourceAttempts[0].callAudits[0].responseBytes, 512);
  }
});

test("Jinyiwei client maps typed fact and public-source metadata", async () => {
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  const result = await getJinyiweiInvestigation("inv-1", jinyiweiReadOptions(JINYIWEI_DETAIL));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.request.requiredFacts[0].category, "PUBLIC_STATISTIC");
    assert.equal(result.data.request.requiredFacts[0].subject, "National treasury");
    assert.equal(result.data.request.requiredFacts[0].jurisdiction, "CN");
    assert.equal(result.data.evidenceByFact.amount[0].publishedAt, "2026-07-20T01:00:00+00:00");
    assert.deepEqual(result.data.evidenceByFact.amount[0].coverage, ["CN"]);
    assert.equal(result.data.evidenceByFact.amount[0].licenseNote, "Free public source.");
  }
});

test("Jinyiwei client rejects missing fact category", async () => {
  const body = structuredClone(JINYIWEI_DETAIL);
  delete (body.request.required_facts[0] as { category?: string }).category;
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  const result = await getJinyiweiInvestigation("inv-1", jinyiweiReadOptions(body));
  assert.equal(result.ok, false);
});

test("锦衣卫纯契约拒绝可注入内存 fetch 与确定性 timer", async () => {
  let fetchCalls = 0;
  let scheduled = 0;
  let cancelled = 0;
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");

  const result = await getJinyiweiInvestigation("inv", {
    baseUrl: "unsupported://unused",
    fetchImpl: async (_input, init) => {
      fetchCalls += 1;
      assert.equal(init?.method, "GET");
      return new Response(JSON.stringify({ ...JINYIWEI_DETAIL, surprise: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    scheduleTimeout: () => {
      scheduled += 1;
      return "deterministic-timeout";
    },
    cancelTimeout: (handle) => {
      assert.equal(handle, "deterministic-timeout");
      cancelled += 1;
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(scheduled, 1);
  assert.equal(cancelled, 1);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.kind, "unknown");
});

test("锦衣卫客户端严格映射 summary/list/detail，并编码详情 ID", async () => {
  const seen: string[] = [];
  const options: JinyiweiReadOptions = {
    baseUrl: "https://backend.invalid",
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      seen.push(url.pathname + url.search);
      assert.equal(init?.method, "GET");
      assert.ok(init?.signal instanceof AbortSignal);

      let body: unknown = JINYIWEI_DETAIL;
      if (url.pathname === "/api/v1/jinyiwei/summary") {
        body = {
          total_investigations: 1,
          resolved_count: 1,
          partial_count: 0,
          blocked_count: 0,
          unavailable_count: 0,
          distinct_evidence_count: 1,
          pending_adoption_count: 0,
          confirmed_adoption_count: 1,
        };
      } else if (url.search) {
        body = {
          items: [{
            investigation_id: "inv/一",
            request_id: "req-1",
            requesting_agent: "户部度支司",
            question: "数额为何？",
            status: "RESOLVED",
            started_at: "2026-07-20T01:00:00+00:00",
            completed_at: "2026-07-20T01:01:00+00:00",
            source_attempt_count: 1,
            evidence_count: 1,
            linked_reply_count: 1,
          }],
          total: 1,
          limit: 10,
          offset: 0,
        };
      }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    scheduleTimeout: () => "deterministic-jinyiwei-timeout",
    cancelTimeout: (handle) => {
      assert.equal(handle, "deterministic-jinyiwei-timeout");
    },
  };
  const {
    getJinyiweiSummary,
    listJinyiweiInvestigations,
    getJinyiweiInvestigation,
  } = await import("./backendClient.ts");

  const summary = await getJinyiweiSummary(options);
  assert.equal(summary.ok && summary.data.totalInvestigations, 1);

  const page = await listJinyiweiInvestigations({
    ...options,
    status: "RESOLVED",
    limit: 10,
    offset: 0,
  });
  assert.equal(page.ok && page.data.items[0].requestingAgent, "户部度支司");

  const detail = await getJinyiweiInvestigation("inv/一", options);
  assert.equal(
    detail.ok && detail.data.evidenceByFact.amount[0].value instanceof Object,
    true,
  );
  assert.ok(seen.includes("/api/v1/jinyiwei/investigations/inv%2F%E4%B8%80"));
  assert.ok(
    seen.includes(
      "/api/v1/jinyiwei/investigations?status=RESOLVED&limit=10&offset=0",
    ),
  );
});

test("锦衣卫客户端嵌套契约额外字段与证据分组不匹配时整包拒绝", async () => {
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  for (const body of [
    { ...JINYIWEI_DETAIL, surprise: true },
    { ...JINYIWEI_DETAIL, evidence_by_fact: { amount: [{ ...JINYIWEI_EVIDENCE, fact_key: "other" }] } },
    { ...JINYIWEI_DETAIL, evidence_by_fact: { amount: [{ ...JINYIWEI_EVIDENCE, content_hash: "bad" }] } },
  ]) {
    const result=await getJinyiweiInvestigation("inv",jinyiweiReadOptions(body));
    assert.equal(result.ok,false);
    if(!result.ok)assert.equal(result.kind,"unknown");
  }
});

test("锦衣卫详情拒绝跨字段不一致、越界时序和非法采用状态", async () => {
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  const secondEvidence = { ...JINYIWEI_EVIDENCE, evidence_id: "ev-2" };
  const invalidBodies = [
    { ...JINYIWEI_DETAIL, investigation_plan: { ...JINYIWEI_DETAIL.investigation_plan, fact_keys: ["other"] } },
    { ...JINYIWEI_DETAIL, investigation_plan: { ...JINYIWEI_DETAIL.investigation_plan, source_scope: ["PUBLIC_WEB"] } },
    { ...JINYIWEI_DETAIL, evidence_by_fact: { amount: [JINYIWEI_EVIDENCE, { ...secondEvidence, evidence_id: "ev-1" }] } },
    { ...JINYIWEI_DETAIL, conflicts: [{ fact_key: "amount", evidence_ids: ["ev-1", "missing"], summary: "冲突" }] },
    { ...JINYIWEI_DETAIL, conflicts: [{ fact_key: "other", evidence_ids: ["ev-1", "ev-2"], summary: "冲突" }], evidence_by_fact: { amount: [JINYIWEI_EVIDENCE, secondEvidence] } },
    { ...JINYIWEI_DETAIL, investigation_completed_at: "2026-07-20T00:59:00+00:00" },
    { ...JINYIWEI_DETAIL, source_attempts: [{ ...JINYIWEI_DETAIL.source_attempts[0], completed_at: "2026-07-20T00:59:00+00:00" }] },
    { ...JINYIWEI_DETAIL, source_attempts: [{ ...JINYIWEI_DETAIL.source_attempts[0], facts_attempted: ["other"] }] },
    { ...JINYIWEI_DETAIL, adoptions: [{ ...JINYIWEI_DETAIL.adoptions[0], evidence_id: "missing" }] },
    { ...JINYIWEI_DETAIL, adoptions: [{ ...JINYIWEI_DETAIL.adoptions[0], status: "PENDING", confirmed_at: JINYIWEI_DETAIL.adoptions[0].confirmed_at }] },
    { ...JINYIWEI_DETAIL, adoptions: [{ ...JINYIWEI_DETAIL.adoptions[0], confirmed_at: null }] },
    { ...JINYIWEI_DETAIL, adoptions: [{ ...JINYIWEI_DETAIL.adoptions[0], updated_at: "2026-07-20T01:01:00+00:00" }] },
  ];
  for (const body of invalidBodies) {
    const result = await getJinyiweiInvestigation("inv", jinyiweiReadOptions(body));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, "unknown");
  }
});

test("锦衣卫详情拒绝不完整事实分区和已解决状态中的限制", async () => {
  const { getJinyiweiInvestigation } = await import("./backendClient.ts");
  for (const body of [
    { ...JINYIWEI_DETAIL, resolved_facts: [], unresolved_facts: [] },
    { ...JINYIWEI_DETAIL, unresolved_facts: ["amount"], do_not_infer: ["amount: do not infer"] },
  ]) {
    assert.equal((await getJinyiweiInvestigation("inv", jinyiweiReadOptions(body))).ok, false);
  }
});

test("锦衣卫详情接受后端契约允许的计划来源子集", async () => {
  const body={
    ...JINYIWEI_DETAIL,
    request:{...JINYIWEI_DETAIL.request,source_scope:["PUBLIC_API","PUBLIC_WEB"]},
  };
  const {getJinyiweiInvestigation}=await import("./backendClient.ts");
  assert.equal((await getJinyiweiInvestigation("inv",jinyiweiReadOptions(body))).ok,true);
});

test("锦衣卫详情接受后端契约允许的空证据分组", async () => {
  const body={...JINYIWEI_DETAIL,status:"PARTIAL",evidence_by_fact:{},resolved_facts:[],unresolved_facts:["amount"],do_not_infer:[],adoptions:[]};
  const {getJinyiweiInvestigation}=await import("./backendClient.ts");
  assert.equal((await getJinyiweiInvestigation("inv",jinyiweiReadOptions(body))).ok,true);
});

test("锦衣卫详情接受后端契约允许的自由文本不可推断说明", async () => {
  const body={...JINYIWEI_DETAIL,status:"PARTIAL",resolved_facts:[],unresolved_facts:["amount"],do_not_infer:["现有材料不足，不得推断数额。"]};
  const {getJinyiweiInvestigation}=await import("./backendClient.ts");
  assert.equal((await getJinyiweiInvestigation("inv",jinyiweiReadOptions(body))).ok,true);
});

test("锦衣卫详情接受后端契约允许的调查尝试位于卷宗时间之外", async () => {
  const body={...JINYIWEI_DETAIL,source_attempts:[{...JINYIWEI_DETAIL.source_attempts[0],started_at:"2026-07-20T00:58:00+00:00",completed_at:"2026-07-20T00:59:00+00:00"}]};
  const {getJinyiweiInvestigation}=await import("./backendClient.ts");
  assert.equal((await getJinyiweiInvestigation("inv",jinyiweiReadOptions(body))).ok,true);
});

test("史馆档案兼容空引用和完整不可变证据引用", async () => {
  const archiveSnapshot = {
    ...JINYIWEI_EVIDENCE,
    category: "PUBLIC_STATISTIC",
    data_scope: "EXTERNAL_PUBLIC",
    subject: "National treasury",
    jurisdiction: "CN",
  };
  const full = {
    ...SHIGUAN_ARCHIVE_BODY,
    evidence_references: [{
      pack_id: "pack-1",
      investigation_id: "inv-1",
      snapshot: archiveSnapshot,
      ordinal: 0,
      evidence_id: "ev-1",
      snapshot_hash: "b".repeat(64),
    }],
  };

  for (const body of [SHIGUAN_ARCHIVE_BODY, full]) {
    const result = await listShiguanArchives(memoryRequestOptions([body]));
    assert.equal(result.ok, true);
  }

  const malformed = {
    ...full,
    evidence_references: [{ ...full.evidence_references[0], extra: true }],
  };
  const result = await listShiguanArchives(memoryRequestOptions([malformed]));
  assert.equal(result.ok, false);
});

test("史馆客户端接受真实后端 model_dump 的完整 MCP 归档溯源", async () => {
  const fixture = JSON.parse(readFileSync(JINYIWEI_MODEL_DUMP_PATH, "utf-8")) as {
    _provenance: string;
    archive_evidence_snapshot: Record<string, unknown>;
  };
  assert.match(fixture._provenance, /schema-v4 backend/);
  let fetchCalls = 0;
  const archive = {
    ...SHIGUAN_ARCHIVE_BODY,
    evidence_references: [{
      pack_id: "pack-model-dump",
      investigation_id: "inv-model-dump",
      snapshot: fixture.archive_evidence_snapshot,
      ordinal: 0,
      evidence_id: "ev-mcp-current",
      snapshot_hash: "d".repeat(64),
    }],
  };
  const result = await listShiguanArchives({
    baseUrl: "unsupported://unused",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify([archive]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    scheduleTimeout: () => "deterministic-shiguan-timeout",
    cancelTimeout: (handle) => assert.equal(handle, "deterministic-shiguan-timeout"),
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.ok, true);
  if (result.ok) {
    const reference = result.data[0].evidenceReferences[0];
    const snapshot = reference.snapshot;
    assert.equal(reference.packId, "pack-model-dump");
    assert.equal(reference.investigationId, "inv-model-dump");
    assert.equal(reference.evidenceId, snapshot.evidenceId);
    assert.equal(snapshot.category, "MARKET_QUOTE");
    assert.equal(snapshot.dataScope, "EXTERNAL_PUBLIC");
    assert.equal(snapshot.subject, "BYD");
    assert.equal(snapshot.jurisdiction, "CN");
    assert.equal(snapshot.sourceType, "MCP");
    assert.equal(snapshot.accessUrl, "https://example.test/mcp/quote/002594");
    assert.equal(snapshot.accessMetadata?.mcp_tool_name, "data_quote");
  }
});

function createShiguanMemoryStub() {
  const seenUrls: string[] = [];
  const options={
    ...memoryRequestOptions(null),
    fetchImpl:async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input));const route=url.pathname+url.search;seenUrls.push(`${init?.method??"GET"} ${route}`);
    if (init?.method === "GET" && url.pathname === "/api/v1/shiguan/archives") {
      return new Response(JSON.stringify([SHIGUAN_ARCHIVE_BODY]),{status:200});
    }
    if (init?.method === "GET" && url.pathname === "/api/v1/shiguan/statistics") {
      return new Response(JSON.stringify({
          total: 2,
          achieved: 1,
          not_achieved: 0,
          partial: 1,
          observing: 0,
          pending_review: 0,
          success_rate: 0.5,
        }),{status:200});
    }
    if (init?.method === "POST" && url.pathname === "/api/v1/shiguan/recall") {
      return new Response(JSON.stringify([
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
        ]),{status:200});
    }
    if (init?.method === "PATCH" && url.pathname === "/api/v1/shiguan/archives/archive-1/review") {
      return new Response(JSON.stringify({
          status: "ACHIEVED",
          reviewed_at: "2026-07-17T01:00:00+00:00",
          note: "已达成。",
        }),{status:200});
    }
    return new Response(JSON.stringify({status:"error"}),{status:404});
  }};
  return {options,seenUrls};
}

test("史馆客户端：列表、统计、召回与复盘更新映射为前端 camelCase 契约", async () => {
  const stub = createShiguanMemoryStub();
    const archives = await listShiguanArchives({
      ...stub.options,
      type: "REPLY",
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
      assert.equal(archives.data[0].sourceKind, "DECREE");
      assert.equal(archives.data[0].sourceText, "着户部会同工部核查漕运。");
      assert.deepEqual(archives.data[0].participatingDepartments, ["户部", "工部"]);
      assert.equal(archives.data[0].replyProcess, "户部核账，工部复核河工。");
      assert.equal(archives.data[0].replyConclusion, "准行。");
      assert.equal(archives.data[0].replyTime, "2026-07-17T00:10:00+00:00");
      assert.equal(archives.data[0].respondent, "户部尚书");
    }

    const statistics = await getShiguanStatistics(stub.options);
    assert.equal(statistics.ok, true);
    if (statistics.ok) {
      assert.equal(statistics.data.notAchieved, 0);
      assert.equal(statistics.data.pendingReview, 0);
      assert.equal(statistics.data.successRate, 0.5);
    }

    const recall = await recallShiguanArchives({
      ...stub.options,
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
      ...stub.options,
    });
    assert.equal(review.ok, true);
    if (review.ok) {
      assert.equal(review.data.status, "ACHIEVED");
      assert.equal(review.data.note, "已达成。");
    }

    assert.ok(
      stub.seenUrls.includes(
        "GET /api/v1/shiguan/archives?type=REPLY&matter_type=%E6%BC%95%E8%BF%90&department=%E6%88%B7%E9%83%A8&limit=10",
      ),
    );
});

test("史馆客户端：后端校验失败时返回 validation，不抛异常", async () => {
  const result = await recallShiguanArchives(memoryRequestOptions({
        status: "error",
        reason: "validation_failed",
        message: "至少提供 matter_type 或 department",
      },422));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "validation");
      assert.equal(result.error, "至少提供 matter_type 或 department");
    }
});

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
  const validResult = await recallShiguanArchives(
    memoryRequestOptions([validRecall]),
  );
  assert.equal(validResult.ok, true);
  if (validResult.ok) {
    assert.equal(validResult.data[0].historicalConclusion, "准行。");
    assert.equal(
      validResult.data[0].reviewStatus?.reviewedAt,
      "2026-07-17T00:20:00+00:00",
    );
  }

  const invalidResult = await recallShiguanArchives(memoryRequestOptions([{
    ...validRecall,
    review_status: { status: "PARTIAL", reviewed_at: 123 },
  }]));
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.kind, "unknown");
  }
});

test("史馆客户端：畸形档案复盘、不完整 REPLY 和旧类型返回 unknown", async () => {
  for (const body of [
    [{ ...SHIGUAN_ARCHIVE_BODY, review_status: { status: "PARTIAL" } }],
    [{ ...SHIGUAN_ARCHIVE_BODY, review_status: undefined }],
    [{ ...SHIGUAN_ARCHIVE_BODY, reply_process: null }],
    [{ ...SHIGUAN_ARCHIVE_BODY, source_kind: "UNKNOWN" }],
    [{ ...SHIGUAN_ARCHIVE_BODY, type: "DECISION" }],
  ]) {
    const result = await listShiguanArchives(memoryRequestOptions(body));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  }
});

test("史馆客户端：MEMORIAL 禁止携带回奏专属字段", async () => {
  const result = await listShiguanArchives(
    memoryRequestOptions([{ ...SHIGUAN_ARCHIVE_BODY, type: "MEMORIAL" }]),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "unknown");
  }
});

test("史馆客户端：旨意来源的 REPLY 禁止关联其他档案", async () => {
  const result = await listShiguanArchives(
    memoryRequestOptions([{
      ...SHIGUAN_ARCHIVE_BODY,
      related_archive_ids: ["archive-memorial"],
    }]),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "unknown");
  }
});

test("史馆客户端：奏折来源的 REPLY 必须且只能关联一份奏折", async () => {
  for (const relatedArchiveIds of [[], ["memorial-1", "memorial-2"]]) {
    const result = await listShiguanArchives(
      memoryRequestOptions([{
        ...SHIGUAN_ARCHIVE_BODY,
        source_kind: "MEMORIAL",
        related_archive_ids: relatedArchiveIds,
      }]),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, "unknown");
    }
  }
});

test("史馆客户端：非 JSON 与网络错误使用稳定中文", async () => {
  const malformedResult = await getShiguanStatistics(
    memoryRequestOptions("not-json"),
  );
  assert.deepEqual(malformedResult, {
    ok: false,
    kind: "unknown",
    error: "史馆后端响应不是合法 JSON",
  });

  const networkResult = await getShiguanStatistics({
    ...memoryRequestOptions(null),
    fetchImpl: async () => {
      throw new TypeError("injected network failure");
    },
  });
  assert.equal(networkResult.ok, false);
  if (!networkResult.ok) {
    assert.equal(networkResult.error, "无法连接后端，请稍后重试");
  }
});

test("史馆客户端：注入的超时调度通过 AbortSignal 中止请求", async () => {
  let scheduledDelay: number | undefined;
  let cancelled = 0;
  const result = await getShiguanStatistics({
    baseUrl: "https://backend.invalid",
    timeoutMs: 100,
    scheduleTimeout: (callback, delayMs) => {
      scheduledDelay = delayMs;
      callback();
      return "injected-abort-timeout";
    },
    cancelTimeout: (handle) => {
      assert.equal(handle, "injected-abort-timeout");
      cancelled += 1;
    },
    fetchImpl: async (_input, init) => {
      assert.equal(init?.signal?.aborted, true);
      throw new DOMException("aborted", "AbortError");
    },
  });

  assert.equal(scheduledDelay, 100);
  assert.equal(cancelled, 1);
  assert.deepEqual(result, {
    ok: false,
    kind: "network",
    error: "请求超时",
  });
});

test("authenticated backend calls send Bearer sessions and preserve a backend 401", async () => {
  let authorization: string | undefined;
  const decree = await submitDecree("authenticated decree", {
    baseUrl: "https://backend.invalid",
    sessionId: "test-session",
    fetchImpl: async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? undefined;
      return new Response(JSON.stringify({ message: "invalid credentials" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(authorization, "Bearer test-session");
  assert.deepEqual(decree, {
    ok: false,
    kind: "unauthenticated",
    error: "authentication required",
  });
});
