const BLOCKED_EXACT_PATHS = ['/', '/welcome'];

const BLOCKED_PATH_PREFIXES = [
  '/intro',
  '/login',
  '/register',
  '/onboarding',
  '/overview',
  '/departments',
  '/manor-dept',
  '/court-briefing',
  '/command-center',
  '/archive',
  '/governance',
  '/health',
  '/hanlin',
  '/jiqun',
  '/manors',
  '/prime',
  '/study',
  '/throne',
];

export function shouldBlockCourtOnboarding(pathname: string) {
  return BLOCKED_EXACT_PATHS.includes(pathname) || BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
