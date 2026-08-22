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
  const baseImages = await readRequired(root, "deploy/images.env.example", errors);
  const releaseSchema = await readRequired(
    root,
    "deploy/release-manifest.schema.json",
    errors,
  );
  const deploymentReadme = await readRequired(root, "deploy/README.md", errors);

  const serviceBlock = (name) =>
    compose.match(
      new RegExp(
        `^  ${name}:[ \\t]*$([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:[ \\t]*$|^networks:[ \\t]*$)`,
        "m",
      ),
    )?.[1] ?? "";

  const projectNames = compose.match(/^name:\s*\S+\s*$/gm) ?? [];
  if (projectNames.length !== 1 || projectNames[0] !== "name: chaotang-os") {
    errors.push("Compose must use the stable project name chaotang-os");
  }

  if (!compose.includes('"127.0.0.1:8080:8080"')) {
    errors.push("Caddy must publish loopback 8080 exactly");
  }
  const portKeys = compose.match(/^\s{4}ports:\s*.*$/gm) ?? [];
  const caddyService = serviceBlock("caddy");
  if (
    portKeys.length !== 1 ||
    !/^    ports:\s*\n      - "127\.0\.0\.1:8080:8080"\s*$/m.test(caddyService) ||
    /^    ports:[ \t]*\S+/m.test(caddyService)
  ) {
    errors.push("Caddy must have the only ports block and publish loopback 8080 exactly once");
  }
  if (/\b80:80\b|\b443:443(?:\/udp)?\b/.test(compose)) {
    errors.push("public 80/443 is forbidden");
  }
  const publishedPorts = [...compose.matchAll(/^\s+-\s+["']([^"']+)["']\s*$/gm)].map((match) => match[1]);
  if (publishedPorts.some((port) => port !== "127.0.0.1:8080:8080")) {
    errors.push("only loopback 8080 may be published");
  }
  for (const port of [3000, 8000]) {
    if (new RegExp(`ports:[\\s\\S]*?${port}:${port}`).test(compose)) {
      errors.push(`${port} must not be published`);
    }
  }
  if (/image:\s*\S*:latest\b|^FROM(?:\s+--platform=\S+)?\s+\S*:latest\b/m.test(`${compose}\n${frontendDockerfile}\n${backendDockerfile}`)) {
    errors.push("floating image tag is forbidden");
  }
  if (
    (compose.match(/^\s{4}image:\s+\$\{BACKEND_IMAGE:\?set digest-pinned BACKEND_IMAGE\}\s*$/gm) ?? []).length !== 1 ||
    (compose.match(/^\s{4}image:\s+\$\{FRONTEND_IMAGE:\?set digest-pinned FRONTEND_IMAGE\}\s*$/gm) ?? []).length !== 1
  ) errors.push("application image placeholders must be exact and fail closed");
  if (
    (compose.match(/^\s{4}image:\s+\$\{CADDY_IMAGE:\?set digest-pinned CADDY_IMAGE\}\s*$/gm) ?? []).length !== 1
  ) errors.push("Caddy image placeholder must be exact and fail closed");
  if (["backend", "frontend", "caddy"].some((name) => {
    const policies = serviceBlock(name).match(/^    pull_policy:\s*\S+\s*$/gm) ?? [];
    return policies.length !== 1 || policies[0] !== "    pull_policy: never";
  })) {
    errors.push("every service must use pull_policy: never for offline deployment");
  }
  const backendService = serviceBlock("backend");
  if (
    (backendService.match(/^      CHAOTANG_ACCOUNTING_SOURCE_DIR: \/app\/accounting\s*$/gm) ?? []).length !== 1 ||
    (backendService.match(/^      - \/srv\/chaotang-os\/accounting:\/app\/accounting:ro\s*$/gm) ?? []).length !== 1
  ) {
    errors.push("backend accounting source must use the exact read-only mounted path");
  }
  if (/\/app\/artifacts|\/srv\/chaotang-os\/artifacts/.test(`${compose}\n${backendDockerfile}`)) {
    errors.push("unused unbacked artifact mounts are forbidden");
  }
  const runbookContracts = [
    {
      valid:
        deploymentReadme.includes("chaotang.p15-operator-inputs.v1") &&
        deploymentReadme.includes("releaseExpectationDigest") &&
        deploymentReadme.includes("verifierDigest") &&
        deploymentReadme.includes("bundleDigest") &&
        deploymentReadme.includes("immutableSnapshotDigest") &&
        deploymentReadme.includes("backupToolDigest") &&
        deploymentReadme.includes("inputsDigest"),
      error: "runbook must define the closed P15 operator inputs",
    },
    {
      valid:
        deploymentReadme.includes("run_rc1_release_acceptance.mjs") &&
        deploymentReadme.includes("--operator-inputs") &&
        deploymentReadme.includes("env -i") &&
        deploymentReadme.includes("writer stop") &&
        deploymentReadme.includes("restore rehearsal"),
      error: "runbook must use the one controlled P15 COLD runner",
    },
    {
      valid:
        /require their own later release\s+authority/.test(deploymentReadme) &&
        deploymentReadme.includes("not permission to deploy") &&
        deploymentReadme.includes("Any failure is a STOP"),
      error: "runbook must keep deployment and restore separately authorized",
    },
  ];
  for (const contract of runbookContracts) {
    if (!contract.valid) errors.push(contract.error);
  }
  if (/\|\|\s*exit\s+1\b/.test(deploymentReadme)) {
    errors.push("runbook transaction failures must flow through the recovery trap");
  }
  if (/\bdocker(?:\s+compose|\s+image)?\s+pull\b/.test(deploymentReadme)) {
    errors.push("runbook must never pull images during offline deployment");
  }
  if (
    /\bdocker\s+compose\b|app\.operations\.sqlite_backup\s+backup\b|--writer-stop-session\b/.test(
      deploymentReadme,
    )
  ) {
    errors.push("runbook must not expose a manual COLD procedure that bypasses the controlled runner");
  }
  if ((compose.match(/^\s{4}read_only:\s*true\s*$/gm) ?? []).length !== 3) {
    errors.push("services must use read_only: true");
  }
  if (/^\s{4}privileged:\s*true\s*$/m.test(compose)) errors.push("privileged services are forbidden");
  if (/^\s{4}user:\s*["']?(?:0|root)(?::[^"'\s]+)?["']?\s*$/m.test(compose)) errors.push("root user is forbidden");
  if (/^\s{4}cap_add:\s*/m.test(compose)) errors.push("cap_add is forbidden");
  if (/^\s{4}(?:network_mode|pid|ipc):\s*["']?host["']?\s*$/m.test(compose)) {
    errors.push("host namespaces are forbidden");
  }
  if ((compose.match(/^\s{4}healthcheck:\s*$/gm) ?? []).length !== 3) errors.push("every service requires a healthcheck");
  if ((compose.match(/^\s{4}cap_drop:\s*\[ALL\]\s*$/gm) ?? []).length !== 3) errors.push("every service must drop all capabilities");
  if ((compose.match(/^\s{4}security_opt:\s*\[no-new-privileges:true\]\s*$/gm) ?? []).length !== 3) errors.push("every service must set no-new-privileges");
  if (/^\s{6}replicas:\s*(?:[2-9]|[1-9][0-9]+)\s*$/m.test(compose) || /--workers[= ](?:[2-9]|[1-9][0-9]+)/.test(backendDockerfile)) {
    errors.push("exactly one backend worker is required");
  }
  const servicesSection = compose.match(/^services:\s*$([\s\S]*?)^networks:\s*$/m)?.[1] ?? "";
  const serviceNames = [...servicesSection.matchAll(/^\s{2}([a-zA-Z0-9_-]+):\s*$/gm)].map((match) => match[1]);
  if (serviceNames.join(",") !== "backend,frontend,caddy") errors.push("deployment must contain exactly backend, frontend and caddy services");
  if (!/^\s*backend:[\s\S]*?^\s{4}networks:\s*\[app\]\s*$/m.test(compose)) {
    errors.push("backend must stay on the internal application network");
  }
  if (!/^\s*frontend:[\s\S]*?^\s{4}networks:\s*\[edge, app\]\s*$/m.test(compose) ||
      !/^\s*caddy:[\s\S]*?^\s{4}networks:\s*\[edge\]\s*$/m.test(compose)) {
    errors.push("frontend and Caddy must stay on internal-only networks");
  }
  if (/^\s{2}egress:\s*/m.test(compose)) {
    errors.push("default outbound bridge is forbidden");
  }
  const networksSection = compose.match(/^networks:[ \t]*$([\s\S]*)$/m)?.[1] ?? "";
  const networkBlock = (name) => {
    const headings = [...networksSection.matchAll(new RegExp(`^  ${name}:[ \\t]*(?:\\{\\})?[ \\t]*$`, "gm"))];
    if (headings.length !== 1) return "";
    const rest = networksSection.slice(headings[0].index + headings[0][0].length + 1);
    const next = rest.search(/^  [a-zA-Z0-9_-]+:[ \t]*(?:\{\})?[ \t]*$/m);
    return next === -1 ? rest : rest.slice(0, next);
  };
  if (!/^\s{4}internal:\s*true\s*$/m.test(networkBlock("app"))) {
    errors.push("application network must be internal");
  }
  if (!/^\s{4}internal:\s*true\s*$/m.test(networkBlock("edge"))) {
    errors.push("edge network must be internal");
  }
  if (!/^\s*\{\s*$/m.test(caddyfile) || !/^\s*auto_https\s+off\s*$/m.test(caddyfile)) {
    errors.push("Caddy must disable automatic HTTPS");
  }
  if (!/^:8080\s*\{/m.test(caddyfile) || /^[^#\s][^\s{]*\.[^\s{]+\s*\{/m.test(caddyfile)) {
    errors.push("Caddy domain or automatic TLS configuration is forbidden");
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
  if (
    !/X-Frame-Options\s+DENY/.test(caddyfile) ||
    !/base-uri\s+'self'/.test(caddyfile) ||
    !/object-src\s+'none'/.test(caddyfile) ||
    !/frame-ancestors\s+'none'/.test(caddyfile)
  ) errors.push("Caddy must deny framing and active object/base injection");
  for (const name of ["DEEPSEEK_API_KEY", "WESTOCK_MCP_CREDENTIAL"]) {
    const match = envExample.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (match?.[1]) errors.push(`${name} must stay empty in examples`);
  }
  if (!/output:\s*["']standalone["']/.test(nextConfig)) {
    errors.push("frontend must enable standalone output");
  }
  const pinnedImages = new Map();
  for (const line of baseImages.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(\S+)$/);
    if (!match || !/^[^\s@]+@sha256:[0-9a-f]{64}$/.test(match[2])) {
      errors.push("images.env.example must contain only digest-pinned image references");
      continue;
    }
    if (pinnedImages.has(match[1])) errors.push("images.env.example must not contain duplicate keys");
    pinnedImages.set(match[1], match[2]);
  }
  for (const name of ["NODE_IMAGE", "PYTHON_IMAGE", "CADDY_IMAGE"]) {
    if (!pinnedImages.has(name)) errors.push(`${name} must be pinned in images.env.example`);
  }
  if (pinnedImages.size !== 3) errors.push("images.env.example must contain exactly the approved three base image references");
  const fromLines = `${frontendDockerfile}\n${backendDockerfile}`.match(/^FROM\s+.*$/gm) ?? [];
  const pinnedFrom = /^FROM\s+--platform=linux\/amd64\s+[^\s@]+@sha256:[0-9a-f]{64}(?:\s+AS\s+[a-z][a-z0-9_-]*)?$/i;
  const stageFrom = /^FROM\s+[a-z][a-z0-9_-]+(?:\s+AS\s+[a-z][a-z0-9_-]*)?$/i;
  if (fromLines.length < 4 || fromLines.some((line) => !pinnedFrom.test(line) && !stageFrom.test(line))) {
    errors.push("Dockerfile FROM entries must pin linux/amd64 image digests");
  }
  const externalFromReferences = fromLines
    .map((line) => line.match(/^FROM\s+--platform=linux\/amd64\s+(\S+)/i)?.[1])
    .filter(Boolean);
  if (
    externalFromReferences.filter((reference) => reference === pinnedImages.get("NODE_IMAGE")).length !== 2 ||
    externalFromReferences.filter((reference) => reference === pinnedImages.get("PYTHON_IMAGE")).length !== 2 ||
    externalFromReferences.some((reference) => ![pinnedImages.get("NODE_IMAGE"), pinnedImages.get("PYTHON_IMAGE")].includes(reference))
  ) errors.push("Dockerfile base images must exactly match images.env.example");
  if (
    !pinnedImages.get("CADDY_IMAGE") ||
    !compose.includes("image: ${CADDY_IMAGE:?set digest-pinned CADDY_IMAGE}")
  ) {
    errors.push("Caddy image must exactly match images.env.example");
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
  if (!/org\.opencontainers\.image\.revision/.test(frontendDockerfile) || !/io\.chaotang\.source\.tree/.test(frontendDockerfile)) {
    errors.push("frontend image must bind source revision and tree labels");
  }
  if (!/^\.env\*$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude .env*");
  }
  if (!/^\.next\/?$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude .next");
  }
  if (
    /^COPY --from=builder \/build\/app\b/m.test(backendDockerfile) ||
    !/--target \/wheel-app/.test(backendDockerfile) ||
    !/COPY --from=builder \/wheel-app \/app/.test(backendDockerfile) ||
    !/dist\.read_text\('RECORD'\)/.test(backendDockerfile)
  ) {
    errors.push("backend runtime must import only the installed wheel projection from /app");
  }
  if (!/runtime_lock\.py prepare-install/.test(backendDockerfile) ||
      !/--require-hashes/.test(backendDockerfile) ||
      !/--only-binary=:all:/.test(backendDockerfile) ||
      !/pip wheel[^\n]*--no-build-isolation[^\n]*--no-deps/.test(backendDockerfile)) {
    errors.push("backend build must use the hashed lock without dependency resolution");
  }
  if (!/org\.opencontainers\.image\.revision/.test(backendDockerfile) || !/io\.chaotang\.source\.tree/.test(backendDockerfile)) {
    errors.push("backend image must bind source revision and tree labels");
  }
  if (!/^\*\*\/\*\.test\.\*$/m.test(frontendDockerignore)) {
    errors.push("frontend build context must exclude frontend tests");
  }
  try {
    const schema = JSON.parse(releaseSchema);
    if (schema.additionalProperties !== false || schema.$id === undefined) {
      errors.push("release manifest schema must be closed and identified");
    }
  } catch {
    errors.push("release manifest schema must be valid JSON");
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
