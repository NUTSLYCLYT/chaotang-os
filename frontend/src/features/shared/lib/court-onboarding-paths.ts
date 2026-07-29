const BLOCKED_EXACT_PATHS = ['/', '/welcome'];

const BLOCKED_PATH_PREFIXES = [
  '/chaotang',
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
  '/dadian',
  '/junjichu',
  '/liubu',
  '/shangshufang',
  '/shiguan',
  '/zhuanshu',
  '/throne',
];

export function shouldBlockCourtOnboarding(pathname: string) {
  const normalized = pathname.startsWith('/chaotang/')
    ? pathname.slice('/chaotang'.length)
    : pathname;
  return BLOCKED_EXACT_PATHS.includes(normalized)
    || BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix) || normalized.startsWith(prefix));
}
