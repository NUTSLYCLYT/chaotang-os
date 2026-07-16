/**
 * Emergency rollout gate for the presentation-only court projection.
 *
 * Default-on keeps existing deployments on the canonical backend projection. Any explicit value
 * other than the allowlisted on-values fails closed to a non-decision waiting state; it never
 * restores the retired frontend decision engines.
 */
export function isCanonicalProjectionEnabled(
  raw = process.env.NEXT_PUBLIC_COURTOS_CANONICAL_PROJECTION,
): boolean {
  if (raw === undefined) return true;
  return ['1', 'true', 'on', 'canonical'].includes(raw.trim().toLowerCase());
}
