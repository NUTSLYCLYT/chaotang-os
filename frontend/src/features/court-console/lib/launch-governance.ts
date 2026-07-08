export type LaunchEnvironment = 'demo' | 'internal' | 'pilot'

export function getLaunchEnvironment(): LaunchEnvironment {
  const raw = process.env.NEXT_PUBLIC_COURTOS_LAUNCH_MODE ?? process.env.COURTOS_LAUNCH_MODE ?? 'demo'
  return raw === 'internal' || raw === 'pilot' ? raw : 'demo'
}

export function requiresLaunchConfirmation() {
  const raw = process.env.NEXT_PUBLIC_COURTOS_LAUNCH_REQUIRES_CONFIRMATION ?? 'true'
  return raw !== 'false'
}

export function getLaunchEnvironmentLabel(environment: LaunchEnvironment) {
  if (environment === 'pilot') return 'Pilot'
  if (environment === 'internal') return 'Internal'
  return 'Demo'
}

export function getLaunchEnvironmentTone(environment: LaunchEnvironment) {
  if (environment === 'pilot') return 'var(--color-danger)'
  if (environment === 'internal') return 'var(--color-warning)'
  return 'var(--color-info)'
}

export function getLaunchStoreScope() {
  const raw =
    process.env.NEXT_PUBLIC_COURTOS_LAUNCH_STORE_SCOPE ??
    process.env.COURTOS_LAUNCH_STORE_SCOPE ??
    getLaunchEnvironment()

  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || getLaunchEnvironment()
}
