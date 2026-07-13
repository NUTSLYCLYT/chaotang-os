const JWT_KEY_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function normalizeJwtKeyId(value) {
  return typeof value === 'string' && JWT_KEY_ID_RE.test(value) ? value : null;
}

export function assertLoopbackBackendUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('JWT runtime probe URL must use HTTP(S) loopback');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('JWT runtime probe URL must not contain credentials, query, or fragment');
  }
  return url;
}

export function classifyJwtRuntimeIdentity({
  authEnabled,
  runtimeKeyId,
  expectedKeyId,
  probeTokenPresent,
  probeStatus,
}) {
  const runtime = normalizeJwtKeyId(runtimeKeyId);
  const expected = normalizeJwtKeyId(expectedKeyId);
  const failures = [];

  if (typeof authEnabled !== 'boolean') failures.push('runtime_auth_state_missing');
  else if (!authEnabled) failures.push('production_auth_disabled');
  if (!runtime) failures.push('runtime_jwt_key_id_missing_or_invalid');
  if (!expected) failures.push('expected_jwt_key_id_missing_or_invalid');
  if (runtime && expected && runtime !== expected) failures.push('jwt_key_id_mismatch');
  if (failures.length === 0 && !probeTokenPresent) failures.push('probe_token_missing');

  const shouldProbe = failures.length === 0 && probeStatus == null;
  if (failures.length === 0 && probeStatus != null && !(probeStatus >= 200 && probeStatus < 300)) {
    failures.push(`protected_probe_rejected:${probeStatus}`);
  }

  return {
    id: 'jwt-runtime-identity',
    ok: failures.length === 0 && probeStatus != null,
    state: failures.length === 0 && probeStatus != null ? 'ready' : 'stop',
    failures,
    shouldProbe,
    authEnabled: typeof authEnabled === 'boolean' ? authEnabled : null,
    runtimeKeyId: runtime,
    expectedKeyId: expected,
    probeStatus,
    detail: failures.length > 0
      ? failures.join('; ')
      : probeStatus == null
        ? 'protected JWT probe required'
        : 'runtime key id matches and protected JWT probe succeeded',
  };
}
