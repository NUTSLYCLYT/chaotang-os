#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();
const appName = 'chaotang-web-lyt';
const outRoot = resolve(root, 'dev', 'artifacts', 'release');
const stageRoot = join(outRoot, appName);
const archiveName = `${appName}-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
const archivePath = join(outRoot, archiveName);
const skipBuild = process.argv.includes('--skip-build');
const basePath = process.env.BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const nextBin = require.resolve('next/dist/bin/next');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const details = options.capture ? `${result.stdout ?? ''}${result.stderr ?? ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`);
  }
  return result.stdout ?? '';
}

function gitValue(args, fallback = 'unknown') {
  try {
    const output = run('git', args, { capture: true }).trim();
    return output || fallback;
  } catch {
    return fallback;
  }
}

function ensureExists(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${relative(root, path)}`);
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return true;
}

function purgeRuntimeArtifacts() {
  const paths = [
    'artifacts',
    'test-results',
    'playwright-report',
    '.playwright-cli',
    '.playwright-mcp',
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.chaotang-main-dev.db',
    '.chaotang-main-prod.db',
    '.chaotang-ledger-dev.db',
    '.chaotang-ledger-prod.db',
    join('public', 'intel-funnel.json'),
    join('public', '.intel-prev-snapshot.json'),
    'tsconfig.tsbuildinfo',
  ];
  for (const item of paths) {
    rmSync(join(stageRoot, item), { recursive: true, force: true });
  }
}

function assertArchiveClean(entries) {
  const banned = [
    /^\.env(?:\.|$)/,
    /\/\.env(?:\.|$)/,
    /\.chaotang-(?:main|ledger).*\.db$/,
    /(?:^|\/)test-results\//,
    /(?:^|\/)playwright-report\//,
    /(?:^|\/)\.playwright-/,
    /(?:^|\/)artifacts\//,
    /(?:^|\/)\.git\//,
    /(?:^|\/)tsconfig\.tsbuildinfo$/,
  ];
  const violations = entries.filter((entry) => banned.some((pattern) => pattern.test(entry)));
  if (violations.length > 0) {
    throw new Error(`release archive contains banned runtime artifacts:\n${violations.slice(0, 20).join('\n')}`);
  }
}

if (!skipBuild) {
  run(process.execPath, [nextBin, 'build', '--webpack'], {
    env: {
      BASE_PATH: basePath,
      NEXT_PUBLIC_BASE_PATH: basePath,
      NEXT_STANDALONE: '1',
    },
  });
}

const standaloneRoot = resolve(root, '.next', 'standalone');
const staticRoot = resolve(root, '.next', 'static');
const publicRoot = resolve(root, 'public');
ensureExists(join(standaloneRoot, 'server.js'), 'Next standalone server');
ensureExists(staticRoot, 'Next static assets');
ensureExists(publicRoot, 'public assets');

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });
cpSync(standaloneRoot, stageRoot, { recursive: true });
cpSync(staticRoot, join(stageRoot, '.next', 'static'), { recursive: true });
cpSync(publicRoot, join(stageRoot, 'public'), { recursive: true });
purgeRuntimeArtifacts();
copyIfExists(resolve(root, 'package.json'), join(stageRoot, 'package.json'));
copyIfExists(resolve(root, 'pnpm-lock.yaml'), join(stageRoot, 'pnpm-lock.yaml'));

const commit = gitValue(['rev-parse', 'HEAD']);
const branch = gitValue(['branch', '--show-current']);
const manifest = {
  app: appName,
  branch,
  commit,
  builtAt: new Date().toISOString(),
  basePath,
  startCommand: 'HOSTNAME=127.0.0.1 PORT=3050 ./start.sh',
  included: ['.next/standalone', '.next/static', 'public', 'package.json', 'pnpm-lock.yaml'],
  excluded: ['.env*', '.chaotang-*.db', 'artifacts', 'test-results', 'playwright-report', '.git', 'root node_modules'],
};
writeText(join(stageRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeText(join(stageRoot, 'start.sh'), `#!/usr/bin/env bash
set -euo pipefail
export BASE_PATH="\${BASE_PATH:-${basePath}}"
export NEXT_PUBLIC_BASE_PATH="\${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}"
export HOSTNAME="\${HOSTNAME:-127.0.0.1}"
export PORT="\${PORT:-3050}"
exec node server.js
`);
run('chmod', ['+x', join(stageRoot, 'start.sh')]);
writeText(join(stageRoot, 'INSTALL.md'), `# Chaotang Web LYT Release Package

This package is a Next.js standalone production bundle.

## Run

\`\`\`bash
tar xzf ${archiveName}
cd ${appName}
HOSTNAME=127.0.0.1 PORT=3050 ./start.sh
\`\`\`

## Required Runtime Environment

- Node.js compatible with this repository's Next.js runtime.
- jiqun backend reachable through the configured reverse proxy or \`JIQUN_API_URL\`.
- Production secrets supplied outside the package, for example via systemd or a local env file created on the target host.

To build an archive mounted under \`/chaotang\`, run:

\`\`\`bash
BASE_PATH=/chaotang NEXT_PUBLIC_BASE_PATH=/chaotang pnpm package:release
\`\`\`

The package intentionally excludes local env files, libSQL DB files, test output, Playwright artifacts, source git metadata, and root development dependencies.
`);

rmSync(archivePath, { force: true });
run('tar', ['-czf', archivePath, '-C', outRoot, appName]);
const archiveList = run('tar', ['-tzf', archivePath], { capture: true }).trim().split('\n').filter(Boolean);
assertArchiveClean(archiveList);

console.log(JSON.stringify({
  archive: relative(root, archivePath),
  staged: relative(root, stageRoot),
  entries: archiveList.length,
  commit,
  basePath,
}, null, 2));
