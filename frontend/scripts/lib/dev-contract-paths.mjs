import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contractRoot = path.join(root, 'dev', 'contracts');
const contractPrefixes = new Set(['schemas', 'loops', 'prompts', 'evals']);

export function contractPath(rel) {
  const normalized = String(rel).replace(/\\/g, '/');
  const [prefix] = normalized.split('/');
  if (contractPrefixes.has(prefix)) {
    return path.join(contractRoot, normalized);
  }
  return path.join(root, rel);
}

export function contractRead(rel) {
  return fs.readFileSync(contractPath(rel), 'utf8');
}

export function contractExists(rel) {
  return fs.existsSync(contractPath(rel));
}

export function contractReaddir(rel) {
  return fs.readdirSync(contractPath(rel));
}
