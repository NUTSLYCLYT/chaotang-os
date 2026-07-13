import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LLM_ENV_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
]);

let loaded = false;

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.replace(/^\uFEFF/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const eq = normalized.indexOf('=');
  if (eq <= 0) return null;

  const key = normalized.slice(0, eq).trim();
  if (!LLM_ENV_KEYS.has(key)) return null;

  let value = normalized.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function hasDeepSeekConfig(): boolean {
  return Boolean(
    process.env.DEEPSEEK_API_KEY ||
      (process.env.OPENAI_BASE_URL?.includes('deepseek') && process.env.OPENAI_API_KEY),
  );
}

function hasAnyLlmConfig(): boolean {
  return Array.from(LLM_ENV_KEYS).some((key) => Boolean(process.env[key]));
}

function loadEnvFile(filePath: string | undefined): boolean {
  if (!filePath || !existsSync(filePath)) return false;
  let changed = false;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || !parsed.value || process.env[parsed.key]) continue;
    process.env[parsed.key] = parsed.value;
    changed = true;
  }
  return changed;
}

export function loadSharedLlmEnv(): void {
  if (process.env.CHAOTANG_IMPORT_JIQUN_ENV === '0') return;
  if (loaded && hasDeepSeekConfig()) return;

  const cwd = process.cwd();
  const candidates = [
    process.env.JIQUN_ENV_FILE,
    process.env.JIQUN_AI_ENV_FILE,
    path.resolve(cwd, '..', 'jiqun_ai', '.env'),
    path.resolve(cwd, '..', 'jiqun_ai_fresh', '.env'),
    path.resolve(cwd, '..', 'fengQun', 'jiqun_ai_fresh', '.env'),
  ];

  let changed = false;
  for (const filePath of candidates) {
    changed = loadEnvFile(filePath) || changed;
  }

  loaded = hasDeepSeekConfig() || (loaded && hasAnyLlmConfig()) || changed;
}
