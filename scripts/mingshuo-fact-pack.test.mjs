import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildExampleFactPack,
  summarizeMingshuoFactPack,
  validateMingshuoFactPack,
} from "./mingshuo-fact-pack.mjs";

const CLOCK = { now: "2026-09-05T12:00:00Z" };

function assertStopped(pack, options = CLOCK) {
  const validation = validateMingshuoFactPack(pack, options);
  const summary = summarizeMingshuoFactPack(pack, options);
  assert.equal(validation.decision, "STOP");
  assert.equal(summary.decision, "STOP");
  assert.deepEqual(summary.errors, validation.errors);
  assert.equal(summary.claimEvidenceCoverage, "0/0");
  for (const result of [validation, summary]) {
    assert.equal(result.nonAuthorizing, true);
    assert.equal(result.businessSuccessMeasured, false);
    assert.equal(result.productionPromotionAuthorized, false);
  }
}

test("MFP-01 every closed object enforces required, unknown keys and null/type", () => {
  const schema = JSON.parse(readFileSync(new URL("../docs/contracts/mingshuo-project-fact-pack.schema.json", import.meta.url)));
  const visit = (rule, value, parts = []) => {
    if (rule.type === "object" && rule.properties) {
      const mutate = (fn) => {
        const pack = buildExampleFactPack();
        fn(parts.reduce((node, part) => node[part], pack));
        assertStopped(pack);
      };
      for (const key of rule.required) mutate((obj) => { delete obj[key]; });
      mutate((obj) => { obj.unexpectedField = true; });
      for (const [key, child] of Object.entries(rule.properties)) visit(child, value[key], [...parts, key]);
    }
    if (rule.type === "array" && value.length) visit(rule.items, value[0], [...parts, 0]);
    if (parts.length && (rule.type === "object" || rule.type === "array")) {
      for (const replacement of [null, 123, "wrong"]) {
        const pack = buildExampleFactPack();
        const parent = parts.slice(0, -1).reduce((node, part) => node[part], pack);
        parent[parts.at(-1)] = replacement;
        assertStopped(pack);
      }
    }
  };
  visit(schema, buildExampleFactPack());
});

test("MFP-01 schema bounds, enums, constants, pattern and summary fail closed", () => {
  const mutations = [
    (p) => { p.tenant.id = ""; },
    (p) => { p.tenant.ownerUserId = "x"; },
    (p) => { p.project.name = "x".repeat(201); },
    (p) => { p.project.productLines = ["BOGUS"]; },
    (p) => { p.project.productLines = ["CELL", "CELL"]; },
    (p) => { p.project.productLines = [{ toString: null }, "CELL"]; },
    (p) => { p.project.markets = []; },
    (p) => { p.project.languages = ["x"]; },
    (p) => { p.skuCandidates = [null, null, null]; },
    (p) => { p.skuCandidates.push(...p.skuCandidates); },
    (p) => { p.skuCandidates[0].parameterStatus = "APPROVED"; },
    (p) => { p.sourcePolicy.imaMode = "WRITE"; },
    (p) => { p.sourcePolicy.externalModelMode = "FINAL_TRUTH"; },
    (p) => { p.sourcePolicy.knowledgePromotion = "ACTIVE"; },
    (p) => { p.evidence[0].digest = "sha256:bad"; },
    (p) => { p.evidence[0].adoptionStatus = "TRUST_ME"; },
    (p) => { p.facts[0].value = null; },
    (p) => { p.facts[0].evidenceRefs = [123]; },
    (p) => { p.claims[0].text = "x".repeat(501); },
    (p) => { p.claims[0].approvalStatus = "AUTO"; },
    (p) => { p.commercial.quoteStatus = "SEND"; },
    (p) => { p.channels[0].publicationAuthorized = "false"; },
    (p) => { p.safety.dangerousOperationalInstructionsPresent = "false"; },
  ];
  for (const mutate of mutations) { const pack = buildExampleFactPack(); mutate(pack); assertStopped(pack); }
  for (const value of [null, [], "bad", 5, true]) assertStopped(value);
});

test("MFP-02 only adopted unexpired evidence counts towards coverage", () => {
  for (const status of ["PROPOSED", "REJECTED"]) {
    const pack = buildExampleFactPack();
    pack.evidence[0].adoptionStatus = status;
    assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "HOLD");
    assert.equal(summarizeMingshuoFactPack(pack, CLOCK).claimEvidenceCoverage, "1/2");
  }
  for (const validUntil of ["2020-01-01", "2026-09-04"]) {
    const pack = buildExampleFactPack(); pack.evidence[0].validUntil = validUntil;
    assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "HOLD");
    assert.equal(summarizeMingshuoFactPack(pack, CLOCK).claimEvidenceCoverage, "1/2");
  }
  const pack = buildExampleFactPack();
  pack.evidence[0].validUntil = "2026-09-05";
  assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "PASS");
  pack.claims[0].evidenceRefs.push("missing");
  assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "HOLD");
  assert.equal(summarizeMingshuoFactPack(pack, CLOCK).claimEvidenceCoverage, "1/2");
});

test("MFP-03 PRICE fact cannot bypass declared authority with NOT_REQUESTED", () => {
  for (const quoteStatus of ["NOT_REQUESTED", "DRAFT", "BLOCKED", "APPROVED"]) {
    for (const authority of [{status:"MISSING",approver:null},{status:"APPROVED",approver:null},{status:"APPROVED",approver:""},{status:"APPROVED",approver:" \t\n "}]) {
      const pack = buildExampleFactPack();
      pack.facts[0].kind = "PRICE";
      pack.commercial = { quoteStatus, priceAuthority: authority };
      const result = validateMingshuoFactPack(pack, CLOCK);
      assert.equal(result.decision, "BLOCK");
      assert.ok(result.blockReasons.includes("PRICE_AUTHORITY_MISSING"));
    }
  }
  const pack = buildExampleFactPack();
  pack.commercial = {quoteStatus:"NOT_REQUESTED",priceAuthority:{status:"MISSING",approver:null}};
  assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "PASS");
});

test("MFP-04 calendar and validation clock cannot disable expiry", () => {
  for (const date of ["2027-99-99", "2027-02-29", "2026-04-31", "2026-00-10", "2026-01-00"]) {
    const pack = buildExampleFactPack(); pack.evidence[0].validUntil = date; assertStopped(pack);
  }
  for (const now of [null, "", false, 123, "2026-02-29", "2026-09-05garbage", "2026-09-05T25:00:00Z", "2026-09-05T12:00:00+08:00"]) {
    assertStopped(buildExampleFactPack(), {now});
  }
  for (const now of ["2026-09-05", "2026-09-05T00:00:00Z", "2026-09-05T23:59:59.999Z"]) {
    assert.equal(validateMingshuoFactPack(buildExampleFactPack(), {now}).decision, "PASS");
  }
  const pack = buildExampleFactPack(); pack.evidence[0].validUntil = "2028-02-29";
  assert.equal(validateMingshuoFactPack(pack, CLOCK).decision, "PASS");
});

test("MFP-01 non-JSON values and sparse arrays cannot produce a trusted summary", () => {
  for (const mutate of [
    (p) => { p.facts[0].value = Number.NaN; },
    (p) => { p.facts[0].value = { toJSON: () => "hidden" }; },
    (p) => { p.facts[0].value = p; },
    (p) => { p.skuCandidates = new Array(3); },
    (p) => { delete p.skuCandidates[0]; p.skuCandidates.extra = "disguised-hole"; },
  ]) {
    const pack = buildExampleFactPack(); mutate(pack); assertStopped(pack);
  }
});

test("MFP-01 wide JSON arrays return STOP rather than overflowing error collection", () => {
  for (const field of ["facts", "claims"]) {
    const pack = buildExampleFactPack(); pack[field] = Array(140000).fill(null);
    assertStopped(pack);
  }
});

test("valid fact pack stays non-authorizing and evidence-bound", () => {
  const pack = buildExampleFactPack();
  const result = validateMingshuoFactPack(pack, { now: "2026-09-04T12:00:00Z" });
  assert.equal(result.decision, "PASS");
  assert.equal(result.nonAuthorizing, true);
  assert.deepEqual(result.holdReasons, []);
  assert.deepEqual(result.blockReasons, []);
  assert.equal(result.businessSuccessMeasured, false);
  assert.equal(result.productionPromotionAuthorized, false);

  const summary = summarizeMingshuoFactPack(pack, { now: "2026-09-04T12:00:00Z" });
  assert.equal(summary.productLines.join(","), "CELL,PACK_POWER");
  assert.equal(summary.claimCount, 2);
  assert.equal(summary.evidenceCount, 3);
  assert.equal(summary.claimEvidenceCoverage, "2/2");
});

test("3-5 SKU candidate slots may exist without fabricated parameters", () => {
  const pack = buildExampleFactPack();
  pack.skuCandidates = [
    { id: "sku-slot-1", label: "候选位 1", status: "RESERVED", parameterStatus: "MISSING" },
    { id: "sku-slot-2", label: "候选位 2", status: "RESERVED", parameterStatus: "MISSING" },
    { id: "sku-slot-3", label: "候选位 3", status: "RESERVED", parameterStatus: "MISSING" },
  ];
  pack.facts = [];
  pack.claims = [];
  const result = validateMingshuoFactPack(pack, { now: "2026-09-04T12:00:00Z" });
  assert.equal(result.decision, "HOLD");
  assert.ok(result.holdReasons.includes("FACTS_MISSING"));
  assert.ok(result.holdReasons.includes("CLAIMS_MISSING"));
  assert.ok(!result.blockReasons.includes("SKU_PARAMETER_FABRICATION"));
});

test("claims, facts and certifications fail closed when evidence is absent or stale", () => {
  const noClaimEvidence = buildExampleFactPack();
  noClaimEvidence.claims[0].evidenceRefs = [];
  assert.ok(
    validateMingshuoFactPack(noClaimEvidence, { now: "2026-09-04T12:00:00Z" }).holdReasons.includes("CLAIM_EVIDENCE_MISSING"),
  );

  const staleCertification = buildExampleFactPack();
  staleCertification.evidence[1].validUntil = "2026-01-01";
  assert.ok(
    validateMingshuoFactPack(staleCertification, { now: "2026-09-04T12:00:00Z" }).holdReasons.includes("EVIDENCE_EXPIRED"),
  );

  const missingFactEvidence = buildExampleFactPack();
  missingFactEvidence.facts[0].evidenceRefs = ["missing-evidence"];
  assert.ok(
    validateMingshuoFactPack(missingFactEvidence, { now: "2026-09-04T12:00:00Z" }).holdReasons.includes("FACT_EVIDENCE_UNRESOLVED"),
  );
});

test("price, publication, knowledge promotion and dangerous instructions block", () => {
  const quoteWithoutAuthority = buildExampleFactPack();
  quoteWithoutAuthority.commercial.priceAuthority = { status: "MISSING", approver: null };
  assert.ok(
    validateMingshuoFactPack(quoteWithoutAuthority, { now: "2026-09-04T12:00:00Z" }).blockReasons.includes("PRICE_AUTHORITY_MISSING"),
  );

  const externalPublication = buildExampleFactPack();
  externalPublication.channels[0].publicationAuthorized = true;
  assert.ok(
    validateMingshuoFactPack(externalPublication, { now: "2026-09-04T12:00:00Z" }).blockReasons.includes("EXTERNAL_PUBLICATION_NOT_AUTHORIZED"),
  );

  const activeKnowledge = buildExampleFactPack();
  activeKnowledge.knowledgeWriteBack.status = "ACTIVE";
  assert.ok(
    validateMingshuoFactPack(activeKnowledge, { now: "2026-09-04T12:00:00Z" }).blockReasons.includes("KNOWLEDGE_AUTO_PROMOTION_FORBIDDEN"),
  );

  const dangerous = buildExampleFactPack();
  dangerous.safety.dangerousOperationalInstructionsPresent = true;
  assert.ok(
    validateMingshuoFactPack(dangerous, { now: "2026-09-04T12:00:00Z" }).blockReasons.includes("DANGEROUS_OPERATIONAL_INSTRUCTIONS_FORBIDDEN"),
  );
});

test("closed contract rejects duplicates, unknown fields and second truth source attempts", () => {
  const duplicateEvidence = buildExampleFactPack();
  duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0] });
  assert.ok(
    validateMingshuoFactPack(duplicateEvidence, { now: "2026-09-04T12:00:00Z" }).errors.includes("EVIDENCE_ID_DUPLICATE"),
  );

  const unknownField = buildExampleFactPack();
  unknownField.autonomousRelease = true;
  assert.ok(
    validateMingshuoFactPack(unknownField, { now: "2026-09-04T12:00:00Z" }).errors.includes("UNKNOWN_TOP_LEVEL_FIELD"),
  );

  const secondTruth = buildExampleFactPack();
  secondTruth.sourcePolicy.finalTruthSource = "IMA";
  assert.ok(
    validateMingshuoFactPack(secondTruth, { now: "2026-09-04T12:00:00Z" }).blockReasons.includes("SECOND_TRUTH_SOURCE_FORBIDDEN"),
  );
});

test("CLI check is deterministic and non-authorizing", () => {
  const first = spawnSync(process.execPath, ["scripts/mingshuo-fact-pack.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const second = spawnSync(process.execPath, ["scripts/mingshuo-fact-pack.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  const parsed = JSON.parse(first.stdout);
  assert.equal(parsed.decision, "PASS");
  assert.equal(parsed.nonAuthorizing, true);
  assert.equal(parsed.productionPromotionAuthorized, false);
  assert.equal(parsed.businessSuccessMeasured, false);
  assert.equal(parsed.canPublishExternally, undefined);
});
