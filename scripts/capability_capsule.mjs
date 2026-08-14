#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const CAPABILITY_SCHEMA = JSON.parse(readFileSync(resolve(SCRIPT_DIR, "../docs/contracts/capability-capsule.schema.json"), "utf8"));
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const STATUSES = new Set(["quarantined", "normalized", "candidate", "shadow", "canary", "stable", "deprecated", "revoked"]);
const PRODUCTION_ALLOWED = new Set(["quarantined", "normalized", "candidate"]);
const ARTIFACTS = ["prompt", "contract", "policy", "behavior", "adapter", "evaluations", "telemetry", "rollback"];
const TOP_KEYS = new Set(["schema_version", "capability_id", "version", "status", "evaluation_scope", "production_boundary", "content_digests", "artifacts", "authority_ref", "requested_permissions", "controls"]);
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const TRANSITIONS = new Map([
  ["quarantined", new Set(["normalized", "revoked"])], ["normalized", new Set(["candidate", "revoked"])],
  ["candidate", new Set(["shadow", "deprecated", "revoked"])], ["shadow", new Set(["canary", "candidate", "deprecated", "revoked"])],
  ["canary", new Set(["stable", "shadow", "deprecated", "revoked"])], ["stable", new Set(["deprecated", "revoked"])],
  ["deprecated", new Set(["revoked"])], ["revoked", new Set()],
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => isObject(value) && Object.keys(value).length === keys.size && Object.keys(value).every((key) => keys.has(key));
const stringSet = (value) => Array.isArray(value) && value.length <= 128 && value.every((item) => typeof item === "string" && item.trim() && item.length <= 256) && new Set(value).size === value.length;
const add = (errors, condition, code) => { if (condition) errors.add(code); };

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function canonicalDigest(value) {
  const bytes = typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(canonical(value));
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function assertSupportedSchema(schema) {
  const supported = new Set(["$schema", "$id", "$ref", "$defs", "title", "type", "additionalProperties", "required", "properties", "const", "enum", "pattern", "minLength", "maxLength", "minItems", "maxItems", "uniqueItems", "items", "minimum", "maximum"]);
  const visit = (node) => {
    if (!isObject(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!supported.has(key)) throw new Error(`schema_keyword_unsupported:${key}`);
      if (key === "properties" || key === "$defs") Object.values(value).forEach(visit);
      else if (key === "items" && isObject(value)) visit(value);
    }
  };
  visit(schema);
}

function safeArtifact(root, path) {
  if (typeof path !== "string" || !path || isAbsolute(path) || path.includes("\0")) return null;
  const rootReal = realpathSync(root);
  const target = resolve(rootReal, path);
  const lexical = relative(rootReal, target);
  if (lexical.startsWith("..") || isAbsolute(lexical)) return null;
  try {
    const targetReal = realpathSync(target);
    const resolvedRelative = relative(rootReal, targetReal);
    const stat = statSync(targetReal);
    if (resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative) || !stat.isFile() || stat.size > MAX_ARTIFACT_BYTES) return null;
    return targetReal;
  } catch { return null; }
}

function shapeErrors(capsule) {
  const errors = new Set();
  if (!exact(capsule, TOP_KEYS)) return new Set(["capsule_shape_invalid"]);
  add(errors, capsule.schema_version !== "1.0.0", "schema_version_invalid");
  add(errors, typeof capsule.capability_id !== "string" || !ID.test(capsule.capability_id) || capsule.capability_id.length > 128, "capability_id_invalid");
  add(errors, typeof capsule.version !== "string" || !VERSION.test(capsule.version), "version_invalid");
  add(errors, !STATUSES.has(capsule.status), "status_invalid");
  add(errors, capsule.evaluation_scope !== "synthetic-offline-only", "evaluation_scope_invalid");
  add(errors, capsule.production_boundary !== "not-registered-no-execution-authority", "production_boundary_invalid");
  const digestKeys = new Set(["prompt", "contract", "policy", "evaluation"]);
  add(errors, !exact(capsule.content_digests, digestKeys) || Object.values(capsule.content_digests ?? {}).some((v) => typeof v !== "string" || !DIGEST.test(v)), "content_digests_invalid");
  const artifactKeys = new Set([...ARTIFACTS, "provenance"]);
  add(errors, !exact(capsule.artifacts, artifactKeys), "artifacts_invalid");
  for (const name of ARTIFACTS) {
    const item = capsule.artifacts?.[name];
    add(errors, !exact(item, new Set(["path", "digest"])) || typeof item?.path !== "string" || !DIGEST.test(item?.digest ?? ""), "artifact_invalid");
  }
  const provenance = capsule.artifacts?.provenance;
  add(errors, !exact(provenance, new Set(["repository", "commit", "path"])) || ![provenance?.repository, provenance?.path].every((v) => typeof v === "string" && v.trim()), "provenance_invalid");
  add(errors, typeof provenance?.commit !== "string" || !COMMIT.test(provenance.commit), "provenance_commit_floating");
  const provenanceSegments = typeof provenance?.path === "string" ? provenance.path.split("/") : [];
  add(errors, typeof provenance?.path !== "string" || provenance.path.includes("\0") || provenance.path.includes("\\") || /^[A-Za-z]:/.test(provenance.path) || provenance.path.startsWith("//") || isAbsolute(provenance.path) || provenanceSegments.some((part) => part === "" || part === "." || part === ".."), "provenance_path_invalid");
  const requestKeys = new Set(["tools", "data_domains", "may_write_external"]);
  add(errors, !exact(capsule.authority_ref, new Set(["issuer", "projection_digest"])) || typeof capsule.authority_ref?.issuer !== "string" || !ID.test(capsule.authority_ref?.issuer ?? "") || !DIGEST.test(capsule.authority_ref?.projection_digest ?? ""), "authority_ref_invalid");
  add(errors, !exact(capsule.requested_permissions, requestKeys) || !stringSet(capsule.requested_permissions?.tools) || !stringSet(capsule.requested_permissions?.data_domains) || typeof capsule.requested_permissions?.may_write_external !== "boolean", "requested_permissions_invalid");
  const controls = capsule.controls;
  add(errors, !exact(controls, new Set(["kill_switches", "taint", "context_rent"])), "controls_invalid");
  add(errors, !exact(controls?.kill_switches, new Set(["capability_enabled", "tenant_enabled", "tools_enabled"])) || Object.values(controls?.kill_switches ?? {}).some((v) => typeof v !== "boolean"), "kill_switches_invalid");
  add(errors, !exact(controls?.taint, new Set(["external_content_taints_context", "tainted_context_allows_tools"])) || Object.values(controls?.taint ?? {}).some((v) => typeof v !== "boolean"), "taint_invalid");
  const rent = controls?.context_rent;
  add(errors, !exact(rent, new Set(["max_tokens", "direct_fallback", "minimum_expected_gain"])) || !Number.isInteger(rent?.max_tokens) || rent.max_tokens < 1 || rent.max_tokens > 32768 || typeof rent?.direct_fallback !== "boolean" || typeof rent?.minimum_expected_gain !== "number" || rent.minimum_expected_gain < 0 || rent.minimum_expected_gain > 1, "context_rent_invalid");
  return errors;
}

export function validateCapabilityCapsule(capsule, options = {}) {
  assertSupportedSchema(options.schema ?? CAPABILITY_SCHEMA);
  const errors = shapeErrors(capsule);
  if (errors.has("capsule_shape_invalid")) return { ok: false, errors: [...errors] };
  if (options.environment === "production" && !PRODUCTION_ALLOWED.has(capsule.status)) errors.add("production_status_forbidden");
  const trustedAuthority = options.trustedAuthority;
  const authorityKeys = new Set(["capability_id", "issuer", "grants", "digest"]);
  const grantKeys = new Set(["approved_tools", "approved_data_domains", "may_write_external", "human_confirmation_required"]);
  const grants = trustedAuthority?.grants;
  if (!exact(trustedAuthority, authorityKeys) || !exact(grants, grantKeys) || !stringSet(grants?.approved_tools) || !stringSet(grants?.approved_data_domains) || typeof grants?.may_write_external !== "boolean" || typeof grants?.human_confirmation_required !== "boolean") errors.add("trusted_authority_required");
  if (trustedAuthority && (trustedAuthority.capability_id !== capsule.capability_id || trustedAuthority.issuer !== capsule.authority_ref?.issuer || trustedAuthority.digest !== capsule.authority_ref?.projection_digest || canonicalDigest({ capability_id: trustedAuthority.capability_id, issuer: trustedAuthority.issuer, grants: trustedAuthority.grants }) !== trustedAuthority.digest)) errors.add("trusted_authority_digest_mismatch");
  const grantedTools = new Set(grants?.approved_tools ?? []);
  const grantedDomains = new Set(grants?.approved_data_domains ?? []);
  if ((capsule.requested_permissions?.tools ?? []).some((v) => !grantedTools.has(v)) || (capsule.requested_permissions?.data_domains ?? []).some((v) => !grantedDomains.has(v)) || (capsule.requested_permissions?.may_write_external === true && grants?.may_write_external !== true)) errors.add("permission_self_grant");
  if (capsule.status === "candidate" && ((capsule.requested_permissions?.tools?.length ?? 0) > 0 || (capsule.requested_permissions?.data_domains?.length ?? 0) > 0 || capsule.requested_permissions?.may_write_external !== false)) errors.add("candidate_permissions_forbidden");
  for (const [key, value] of Object.entries(capsule.controls?.kill_switches ?? {})) if (value === false) errors.add(`${key}_killed`);
  if (capsule.controls?.taint?.external_content_taints_context !== true) errors.add("external_content_taint_required");
  if (capsule.controls?.taint?.tainted_context_allows_tools !== false) errors.add("tainted_context_tool_access_forbidden");
  if (capsule.controls?.context_rent?.direct_fallback !== true) errors.add("direct_fallback_required");
  if (capsule.content_digests && capsule.artifacts) {
    for (const [digestName, artifactName] of [["prompt", "prompt"], ["contract", "contract"], ["policy", "policy"], ["evaluation", "evaluations"]]) {
      if (capsule.content_digests[digestName] !== capsule.artifacts[artifactName]?.digest) errors.add("content_digest_binding_mismatch");
    }
  }
  if (options.root && capsule.artifacts) {
    for (const name of ARTIFACTS) {
      const item = capsule.artifacts[name];
      const path = safeArtifact(options.root, item?.path);
      if (!path) errors.add("artifact_path_outside_root");
      else if (canonicalDigest(readFileSync(path)) !== item.digest) errors.add("artifact_digest_mismatch");
    }
  }
  return { ok: errors.size === 0, errors: [...errors].sort() };
}

export function transitionCapability(from, to) {
  const ok = STATUSES.has(from) && STATUSES.has(to) && (TRANSITIONS.get(from)?.has(to) ?? false);
  return { ok, from, to, errors: ok ? [] : ["lifecycle_transition_forbidden"] };
}

export function buildCapabilityLockfile(capsule, { root, trustedAuthority }) {
  const validation = validateCapabilityCapsule(capsule, { root, environment: "offline", trustedAuthority });
  if (!validation.ok) throw new Error(`capsule_invalid:${validation.errors.join(",")}`);
  return {
    schema_version: "1.0.0",
    capability_id: capsule.capability_id,
    version: capsule.version,
    capsule_digest: canonicalDigest(capsule),
    objects: Object.fromEntries(ARTIFACTS.map((name) => [capsule.artifacts[name].path, capsule.artifacts[name].digest]).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function verifyCapabilityLockfile(capsule, lockfile, { root }) {
  const errors = new Set();
  if (!isObject(capsule) || !isObject(capsule.artifacts) || ARTIFACTS.some((name) => !isObject(capsule.artifacts[name])) || !isObject(capsule.authority_ref)) return { ok: false, errors: ["capsule_shape_invalid"] };
  if (!isObject(lockfile)) return { ok: false, errors: ["lockfile_shape_invalid"] };
  if (!exact(lockfile, new Set(["schema_version", "capability_id", "version", "capsule_digest", "objects"])) || lockfile.schema_version !== "1.0.0" || lockfile.capability_id !== capsule.capability_id || lockfile.version !== capsule.version || !DIGEST.test(lockfile.capsule_digest ?? "") || !isObject(lockfile.objects)) errors.add("lockfile_shape_invalid");
  if (lockfile.capsule_digest !== canonicalDigest(capsule)) errors.add("lock_capsule_digest_mismatch");
  const expected = Object.fromEntries(ARTIFACTS.map((name) => [capsule.artifacts[name].path, capsule.artifacts[name].digest]));
  if (JSON.stringify(canonical(lockfile.objects)) !== JSON.stringify(canonical(expected))) errors.add("lock_object_set_mismatch");
  for (const [pathName, digest] of Object.entries(lockfile.objects ?? {})) {
    const path = safeArtifact(root, pathName);
    if (!path) errors.add("lock_object_path_outside_root");
    else {
      try {
        const actual = canonicalDigest(readFileSync(path));
        if (actual !== digest) errors.add("lock_object_digest_mismatch");
      } catch { errors.add("lock_object_invalid"); }
    }
  }
  return { ok: errors.size === 0, errors: [...errors].sort() };
}

export function resolveTrustedAuthority(manifest, capabilityId) {
  const errors = new Set();
  const manifestKeys = new Set(["schema_version", "issuer", "projections"]);
  if (!exact(manifest, manifestKeys) || manifest.schema_version !== "1.0.0" || typeof manifest.issuer !== "string" || !ID.test(manifest.issuer) || !isObject(manifest.projections)) return { ok: false, authority: undefined, errors: ["authority_manifest_invalid"] };
  const authority = manifest.projections[capabilityId];
  const authorityKeys = new Set(["capability_id", "issuer", "grants", "digest"]);
  const grantKeys = new Set(["approved_tools", "approved_data_domains", "may_write_external", "human_confirmation_required"]);
  if (!exact(authority, authorityKeys) || authority.capability_id !== capabilityId || authority.issuer !== manifest.issuer || !exact(authority.grants, grantKeys) || !stringSet(authority.grants.approved_tools) || !stringSet(authority.grants.approved_data_domains) || typeof authority.grants.may_write_external !== "boolean" || typeof authority.grants.human_confirmation_required !== "boolean" || !DIGEST.test(authority.digest ?? "")) errors.add("authority_projection_invalid");
  if (errors.size === 0 && canonicalDigest({ capability_id: authority.capability_id, issuer: authority.issuer, grants: authority.grants }) !== authority.digest) errors.add("authority_projection_digest_mismatch");
  return { ok: errors.size === 0, authority: errors.size === 0 ? authority : undefined, errors: [...errors].sort() };
}
