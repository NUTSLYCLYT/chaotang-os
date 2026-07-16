import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENGINE_NAMES = [
  'ministry-review-loop',
  'yushitai-auditor',
  'imperial-report-synthesizer',
  'unified-decision-loop',
];

const ALLOWED_ENGINE_IMPORTS = new Map();

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;

function isProductionSource(path) {
  return !/(?:\.nodetest|\.itest|\.test)\.[cm]?[jt]sx?$|\/__tests__\//.test(path);
}

export function validateProductionImportText(relativePath, source) {
  if (!isProductionSource(relativePath)) return [];
  const violations = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier.includes('dev/_attic')) {
      violations.push(`${relativePath}: restricted production import ${specifier}`);
      continue;
    }
    const engineName = ENGINE_NAMES.find((name) => specifier.includes(name));
    const allowedEngines = ALLOWED_ENGINE_IMPORTS.get(relativePath);
    if (engineName && !allowedEngines?.has(engineName)) {
      violations.push(`${relativePath}: restricted local decision-engine import ${specifier}`);
    }
  }
  return violations;
}

export function findRestrictedProductionImports(root = FRONTEND_ROOT) {
  const files = globSync('src/**/*.{ts,tsx,js,mjs}', { cwd: root });
  return files.flatMap((path) =>
    validateProductionImportText(
      relative(root, resolve(root, path)).replaceAll('\\', '/'),
      readFileSync(resolve(root, path), 'utf8'),
    ),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = findRestrictedProductionImports();
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exit(1);
  }
  console.log('architecture import guard: ok');
}
