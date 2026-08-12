import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function readRequired(root, relativePath, errors) {
  try {
    return await readFile(resolve(root, relativePath), "utf8");
  } catch (error) {
    errors.push(`${relativePath} is required: ${error.message}`);
    return "";
  }
}

export async function checkDeployment(root = process.cwd()) {
  const errors = [];
  const compose = await readRequired(root, "deploy/compose.yaml", errors);
  const caddyfile = await readRequired(root, "deploy/Caddyfile", errors);
  const envExample = await readRequired(
    root,
    "deploy/production.env.example",
    errors,
  );
  const nextConfig = await readRequired(
    root,
    "frontend/next.config.ts",
    errors,
  );
  const frontendDockerfile = await readRequired(
    root,
    "frontend/Dockerfile",
    errors,
  );
  const frontendDockerignore = await readRequired(
    root,
    "frontend/.dockerignore",
    errors,
  );
  const backendDockerfile = await readRequired(
    root,
    "backend/Dockerfile",
    errors,
  );

  if (!compose.includes('"80:80"') || !compose.includes('"443:443"')) {
    errors.push("Caddy must publish public 80/443");
  }
  for (const port of [3000, 8000]) {
    if (new RegExp(`ports:[\\s\\S]*?${port}:${port}`).test(compose)) {
      errors.push(`${port} must not be published`);
    }
  }
  if (/image:\s*\S*:latest\b/.test(compose)) {
    errors.push("floating image tag is forbidden");
  }
  if (!/read_only:\s*true/.test(compose)) {
    errors.push("services must use read_only: true");
  }
  if (!/^\s*backend:[\s\S]*?^\s{4}networks:\s*\[[^\]]*\begress\b[^\]]*\]/m.test(compose)) {
    errors.push("backend must have a dedicated outbound network");
  }
  if (!/^\s{2}egress:\s*\{\}\s*$/m.test(compose)) {
    errors.push("outbound network must be an unprivileged bridge");
  }
  if (
    !/@welcomeAssets\s+path\s+\/assets\/v5-pre-auth\/\*/.test(caddyfile) ||
    !/header\s+@welcomeAssets\s+>Cache-Control\s+"public, max-age=604800"/.test(caddyfile)
  ) {
    errors.push("welcome assets cache must be scoped to /assets/v5-pre-auth/*");
  }
  if (
    !/^\s*@optimizedImages[ \t]+path[ \t]+\/assets\/\*\.webp[ \t]+\/assets\/\*\/\*\.webp[ \t]+\/assets\/\*\/\*\/\*\.webp[ \t]+\/heroes\/\*\/\*\/\*\.webp[ \t]+\/shangshufang\/\*\.webp\s*$/m.test(
      caddyfile,
    ) ||
    !/^\s*header[ \t]+@optimizedImages[ \t]+>Cache-Control[ \t]+"public, max-age=604800, immutable"\s*$/m.test(
      caddyfile,
    )
  ) {
    errors.push("optimized image cache must use the scoped immutable policy");
  }
  if (
    /^\s*header\s+[>+?]?Cache-Control\b/m.test(caddyfile) ||
    /^\s*header\s*\{[^}]*^\s*[>+?]?Cache-Control\b[^}]*^\s*\}/ms.test(
      caddyfile,
    )
  ) {
    errors.push("global cache header is forbidden");
  }
  if (!/script-src[^";]*'unsafe-inline'/.test(caddyfile)) {
    errors.push("CSP must allow Next.js hydration inline scripts");
  }
  for (const name of ["DEEPSEEK_API_KEY", "WESTOCK_MCP_CREDENTIAL"]) {
    const match = envExample.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (match?.[1]) errors.push(`${name} must stay empty in examples`);
  }
  if (!/output:\s*["']standalone["']/.test(nextConfig)) {
    errors.push("frontend must enable standalone output");
  }
  if (!/^ARG NODE_IMAGE$/m.test(frontendDockerfile)) {
    errors.push("frontend Dockerfile must declare ARG NODE_IMAGE without a default");
  }
  if (!/^FROM \$\{NODE_IMAGE\} AS dependencies$/m.test(frontendDockerfile)) {
    errors.push("frontend dependencies stage must use NODE_IMAGE");
  }
  if (!/\bnpm ci\b/.test(frontendDockerfile)) {
    errors.push("frontend Dockerfile must install dependencies with npm ci");
  }
  if (!/^USER 10001:10001$/m.test(frontendDockerfile)) {
    errors.push("frontend container must run as UID/GID 10001");
  }
  if (/\b(?:groupadd|useradd)\b/.test(frontendDockerfile)) {
    errors.push("frontend Alpine image must use addgroup/adduser");
  }
  if (/\bNEXT_PUBLIC_[A-Z0-9_]*\b/.test(frontendDockerfile)) {
    errors.push("frontend Dockerfile must not declare NEXT_PUBLIC_* variables");
  }
  if (!/^\.env\*$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude .env*");
  }
  if (!/^\.next\/?$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude .next");
  }
  if (!/^COPY --from=builder \/build\/app \.\/app$/m.test(backendDockerfile)) {
    errors.push("backend runtime source must live at /app/app for persistent data paths");
  }
  if (!/^\*\*\/\*\.test\.\*$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude frontend tests");
  }
  return errors;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const errors = await checkDeployment();
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}
