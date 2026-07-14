const ALLOWED_ROOT_DIRECTORIES = new Set([
  '.claude',
  '.harness',
  'backend',
  'courtos-brain',
  'docs',
  'frontend',
  'scripts',
  'skills',
]);

const ALLOWED_ROOT_FILES = new Set([
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
]);

const RETIRED_ROOT_PREFIXES = ['plans/'];
const BACKEND_RUNTIME_PREFIXES = [
  'backend/data/',
  'backend/events/',
  'backend/memory/',
  'backend/traces/',
  'backend/sessions/',
  'backend/swarm_sessions/',
  'backend/direct_cache/',
  'backend/direct_feedback/',
  'backend/runs/',
  'backend/repairs/',
  'backend/drafts/',
  'backend/reports/',
  'backend/cases/',
  'backend/ab_tests/',
  'backend/var/',
];

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function validateRepositoryStructure(paths) {
  const errors = [];

  for (const rawPath of paths) {
    const path = normalizePath(rawPath);
    if (!path) continue;

    if (path === 'PROJECT_STATUS.md' || RETIRED_ROOT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      errors.push(`retired root path: ${path}`);
      continue;
    }

    if (path.startsWith('frontend/harness/')) {
      errors.push(`retired frontend evaluation path: ${path}`);
      continue;
    }

    if (BACKEND_RUNTIME_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      errors.push(`tracked backend runtime state: ${path}`);
      continue;
    }

    const slash = path.indexOf('/');
    const rootName = slash === -1 ? path : path.slice(0, slash);
    const allowed = slash === -1
      ? ALLOWED_ROOT_FILES.has(rootName) || ALLOWED_ROOT_DIRECTORIES.has(rootName)
      : ALLOWED_ROOT_DIRECTORIES.has(rootName);

    if (!allowed) errors.push(`unknown repository root: ${rootName}`);
  }

  return errors;
}

export const repositoryStructurePolicy = Object.freeze({
  allowedRootDirectories: [...ALLOWED_ROOT_DIRECTORIES].sort(),
  allowedRootFiles: [...ALLOWED_ROOT_FILES].sort(),
  backendRuntimePrefixes: [...BACKEND_RUNTIME_PREFIXES],
});
