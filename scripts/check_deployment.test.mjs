import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { checkDeployment } from "./check_deployment.mjs";

const fixtureRoots = new Set();

test.afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), "chaotang-deployment-"));
  fixtureRoots.add(root);
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const path = join(root, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents, "utf8");
    }),
  );
  return root;
}

function resolveBashExecutable() {
  if (process.platform !== "win32") return "/usr/bin/bash";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const candidates = [
    process.env.CHAOTANG_GIT_BASH,
    join(programFiles, "Git", "bin", "bash.exe"),
    join(programFiles, "Git", "usr", "bin", "bash.exe"),
    join(programFilesX86, "Git", "bin", "bash.exe"),
    "C:\\Tools\\PortableGit\\bin\\bash.exe",
    "C:\\Tools\\PortableGit\\usr\\bin\\bash.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

test("rejects an incomplete frontend container source contract", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "frontend/next.config.ts": "const nextConfig = {};\nexport default nextConfig;\n",
    "frontend/Dockerfile": "FROM node:latest\nARG NEXT_PUBLIC_BACKEND_BASE_URL\nRUN groupadd app\nUSER root\n",
    "frontend/.dockerignore": "node_modules\n",
    "backend/Dockerfile": "FROM python:latest\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("standalone output")));
  assert.ok(errors.some((value) => value.includes("linux/amd64 image digests")));
  assert.ok(errors.some((value) => value.includes("npm ci")));
  assert.ok(errors.some((value) => value.includes("UID/GID 10001")));
  assert.ok(errors.some((value) => value.includes("addgroup/adduser")));
  assert.ok(errors.some((value) => value.includes(".env*")));
  assert.ok(errors.some((value) => value.includes(".next")));
  assert.ok(errors.some((value) => value.includes("NEXT_PUBLIC_*")));
  assert.ok(errors.some((value) => value.includes("source revision and tree labels")));
  assert.ok(errors.some((value) => value.includes("frontend tests")));
  assert.ok(errors.some((value) => value.includes("installed wheel")));
});

test("rejects public ingress and published application ports", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80"]\n  backend:\n    ports: ["8000:8000"]\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("loopback 8080")));
  assert.ok(errors.some((value) => value.includes("public 80/443")));
  assert.ok(errors.some((value) => value.includes("8000 must not be published")));
});

test("rejects domain and automatic TLS Caddy configuration", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["127.0.0.1:8080:8080"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  reverse_proxy frontend:3000\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("domain or automatic TLS")));
});

test("rejects privileged, root, writable, unhealthy and replicated services", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    image: example@sha256:${"a".repeat(64)}\n    user: "0:0"\n    privileged: true\n    read_only: false\n    deploy:\n      replicas: 2\n    networks: [app, egress]\n  caddy:\n    image: example@sha256:${"b".repeat(64)}\n    ports: ["127.0.0.1:8080:8080"]\n    read_only: true\nnetworks:\n  app:\n    internal: true\n  egress: {}\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("privileged")));
  assert.ok(errors.some((value) => value.includes("root user")));
  assert.ok(errors.some((value) => value.includes("read_only: true")));
  assert.ok(errors.some((value) => value.includes("healthcheck")));
  assert.ok(errors.some((value) => value.includes("exactly one backend worker")));
});

test("rejects floating images and secret literals", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    image: caddy:latest\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=real-value\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("floating image")));
  assert.ok(errors.some((value) => value.includes("must stay empty")));
});

test("rejects a missing read-only root filesystem", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    image: caddy:2.10.0\n    ports: ["127.0.0.1:8080:8080"]\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("read_only: true")));
});

test("requires backend network isolation by default without publishing its port", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    expose: ["8000"]\n    networks: [app]\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\nnetworks:\n  app:\n    internal: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(!errors.some((value) => value.includes("backend must stay on the internal application network")));
  assert.ok(!errors.some((value) => value.includes("8000 must not be published")));
});

test("rejects a default backend egress bridge", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    networks: [app, egress]\n  frontend:\n    networks: [edge, app]\n  caddy:\n    networks: [edge]\nnetworks:\n  edge:\n    internal: true\n  app:\n    internal: true\n  egress: {}\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("backend must stay on the internal application network")));
  assert.ok(errors.some((value) => value.includes("default outbound bridge is forbidden")));
});

test("requires a cache header scoped to versioned welcome assets", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  reverse_proxy frontend:3000\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("welcome assets cache")));
});

test("requires immutable caching scoped to optimized images", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("optimized image cache")));
});

test("rejects a global cache header alongside the optimized image cache", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  @optimizedImages path /assets/*.webp /assets/*/*.webp /assets/*/*/*.webp /heroes/*/*/*.webp /shangshufang/*.webp\n  header @optimizedImages >Cache-Control "public, max-age=604800, immutable"\n  header >Cache-Control "public, max-age=604800, immutable"\n  header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("global cache header")));
});

test("rejects Cache-Control inside an unscoped header block", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  @optimizedImages path /assets/*.webp /assets/*/*.webp /assets/*/*/*.webp /heroes/*/*/*.webp /shangshufang/*.webp\n  header @optimizedImages >Cache-Control "public, max-age=604800, immutable"\n  header {\n    X-Content-Type-Options nosniff\n    Cache-Control "public, max-age=604800, immutable"\n    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n  }\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("global cache header")));
});

test("rejects every unscoped Cache-Control setting operator", async (t) => {
  const directives = {
    "direct set": 'header Cache-Control "public"',
    "direct deferred set": 'header >Cache-Control "public"',
    "direct add": 'header +Cache-Control "public"',
    "direct default": 'header ?Cache-Control "public"',
    "block set": 'header {\n    Cache-Control "public"\n  }',
    "block deferred set": 'header {\n    >Cache-Control "public"\n  }',
    "block add": 'header {\n    +Cache-Control "public"\n  }',
    "block default": 'header {\n    ?Cache-Control "public"\n  }',
  };

  for (const [name, directive] of Object.entries(directives)) {
    await t.test(name, async () => {
      const root = await fixture({
        "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
        "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
        "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  @optimizedImages path /assets/*.webp /assets/*/*.webp /assets/*/*/*.webp /heroes/*/*/*.webp /shangshufang/*.webp\n  header @optimizedImages >Cache-Control "public, max-age=604800, immutable"\n  ${directive}\n  header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n}\n`,
      });

      const errors = await checkDeployment(root);

      assert.ok(errors.some((value) => value.includes("global cache header")));
    });
  }
});

test("allows Cache-Control deletion and named matcher operations", async (t) => {
  const directives = {
    "direct delete": "header -Cache-Control",
    "block delete": "header {\n    -Cache-Control\n  }",
    "matched add": 'header @welcomeAssets +Cache-Control "public"',
    "matched default": 'header @welcomeAssets ?Cache-Control "public"',
  };

  for (const [name, directive] of Object.entries(directives)) {
    await t.test(name, async () => {
      const root = await fixture({
        "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
        "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
        "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  @optimizedImages path /assets/*.webp /assets/*/*.webp /assets/*/*/*.webp /heroes/*/*/*.webp /shangshufang/*.webp\n  header @optimizedImages >Cache-Control "public, max-age=604800, immutable"\n  ${directive}\n  header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n}\n`,
      });

      const errors = await checkDeployment(root);

      assert.ok(!errors.some((value) => value.includes("global cache header")));
    });
  }
});

test("rejects extra paths in the optimized image matcher", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  @optimizedImages path /assets/*.webp /assets/*/*.webp /assets/*/*/*.webp /heroes/*/*/*.webp /shangshufang/*.webp /assets/*\n  header @optimizedImages >Cache-Control "public, max-age=604800, immutable"\n  header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("optimized image cache")));
});

test("rejects a CSP that blocks Next.js hydration scripts", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
    "deploy/Caddyfile": `app.example.test {\n  @welcomeAssets path /assets/v5-pre-auth/*\n  header @welcomeAssets >Cache-Control "public, max-age=604800"\n  header Content-Security-Policy "default-src 'self'; script-src 'self'"\n}\n`,
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("Next.js hydration")));
});

test("rejects inline extra ports, root UID variants, added capabilities and host namespaces", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    user: "0:10002"\n    cap_add: [NET_ADMIN]\n    network_mode: host\n    networks: [app, egress]\n  frontend:\n    networks: [edge, app]\n  caddy:\n    ports: ["127.0.0.1:8080:8080", "0.0.0.0:8080:8080"]\n    networks: [edge]\nnetworks:\n  edge:\n    internal: true\n  egress: {}\n  app:\n    internal: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("only ports block")));
  assert.ok(errors.some((value) => value.includes("root user")));
  assert.ok(errors.some((value) => value.includes("cap_add")));
  assert.ok(errors.some((value) => value.includes("host namespaces")));
});

test("requires internal edge and exact Dockerfile and Caddy base image projections", async () => {
  const digest = `sha256:${"a".repeat(64)}`;
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    networks: [app, egress]\n  frontend:\n    networks: [edge, app]\n  caddy:\n    image: caddy@${digest}\n    ports:\n      - "127.0.0.1:8080:8080"\n    networks: [edge]\nnetworks:\n  edge: {}\n  egress: {}\n  app:\n    internal: true\n`,
    "deploy/images.env.example": `NODE_IMAGE=node@${digest}\nPYTHON_IMAGE=python@${digest}\nCADDY_IMAGE=approved-caddy@${digest}\n`,
    "frontend/Dockerfile": `FROM --platform=linux/amd64 wrong-node@${digest} AS dependencies\nFROM dependencies AS builder\nFROM --platform=linux/amd64 wrong-node@${digest} AS runner\n`,
    "backend/Dockerfile": `FROM --platform=linux/amd64 wrong-python@${digest} AS builder\nFROM --platform=linux/amd64 wrong-python@${digest} AS runner\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("edge network must be internal")));
  assert.ok(errors.some((value) => value.includes("exactly match images.env.example")));
  assert.ok(errors.some((value) => value.includes("Caddy image must exactly match")));
});

test("rejects overrideable application image placeholders", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    image: \${BACKEND_IMAGE:-backend:latest}\n  frontend:\n    image: \${FRONTEND_IMAGE:-frontend:latest}\n  caddy:\n    ports:\n      - "127.0.0.1:8080:8080"\n`,
    "deploy/README.md": "docker compose --env-file ./images.env up -d\n",
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("application image placeholders")));
});

test("requires the one backed-up accounting mount and forbids a second artifact write root", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    environment:\n      CHAOTANG_ACCOUNTING_SOURCE_DIR: /wrong/accounting\n    volumes:\n      - /srv/chaotang-os/accounting:/app/accounting:rw\n      - /srv/chaotang-os/artifacts:/app/artifacts\n  frontend: {}\n  caddy: {}\n`,
    "backend/Dockerfile": "RUN mkdir -p /app/artifacts\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("exact read-only mounted path")));
  assert.ok(errors.some((value) => value.includes("unbacked artifact mounts")));
});

test("requires every service to use the offline-only image pull policy", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    image: \${BACKEND_IMAGE:?set digest-pinned BACKEND_IMAGE}\n    pull_policy: always\n  frontend:\n    image: \${FRONTEND_IMAGE:?set digest-pinned FRONTEND_IMAGE}\n    pull_policy: never\n  caddy:\n    image: caddy@sha256:${"a".repeat(64)}\n    ports:\n      - "127.0.0.1:8080:8080"\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(
    errors.some((value) =>
      value.includes("every service must use pull_policy: never"),
    ),
  );
});

test("rejects duplicate pull policies that leave another service unguarded", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `name: chaotang-os\nservices:\n  backend:\n    image: \${BACKEND_IMAGE:?set digest-pinned BACKEND_IMAGE}\n    pull_policy: never\n    pull_policy: never\n  frontend:\n    image: \${FRONTEND_IMAGE:?set digest-pinned FRONTEND_IMAGE}\n  caddy:\n    image: \${CADDY_IMAGE:?set digest-pinned CADDY_IMAGE}\n    pull_policy: never\n    ports:\n      - "127.0.0.1:8080:8080"\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(
    errors.some((value) =>
      value.includes("every service must use pull_policy: never"),
    ),
  );
});

test("requires one stable Compose project identity", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    image: \${BACKEND_IMAGE:?set digest-pinned BACKEND_IMAGE}\n    pull_policy: never\n  frontend:\n    image: \${FRONTEND_IMAGE:?set digest-pinned FRONTEND_IMAGE}\n    pull_policy: never\n  caddy:\n    image: \${CADDY_IMAGE:?set digest-pinned CADDY_IMAGE}\n    pull_policy: never\n    ports:\n      - "127.0.0.1:8080:8080"\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("stable project name")));
});

test("rejects image-fetch commands in the offline runbook", async () => {
  const root = await fixture({
    "deploy/compose.yaml": "name: chaotang-os\nservices: {}\n",
    "deploy/README.md": "docker image pull example.invalid/app@sha256:deadbeef\n",
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(
    errors.some((value) => value.includes("never pull images")),
  );
});

test("requires the closed operator inputs and controlled COLD runner", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    image: \${BACKEND_IMAGE:?set digest-pinned BACKEND_IMAGE}\n    pull_policy: never\n  frontend:\n    image: \${FRONTEND_IMAGE:?set digest-pinned FRONTEND_IMAGE}\n    pull_policy: never\n  caddy:\n    image: caddy@sha256:${"a".repeat(64)}\n    pull_policy: never\n    ports:\n      - "127.0.0.1:8080:8080"\n`,
    "deploy/README.md": "Any failure is a STOP. This is not permission to deploy. Candidate image import and restore require their own later release authority.\n",
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  for (const contract of [
    "closed P15 operator inputs",
    "one controlled P15 COLD runner",
  ]) {
    assert.ok(
      errors.some((value) => value.includes(contract)),
      `missing rejection for ${contract}: ${errors.join(" | ")}`,
    );
  }
});

test("rejects manual COLD procedures and explicit exits that bypass recovery", async () => {
  const root = await fixture({
    "deploy/compose.yaml": "name: chaotang-os\nservices: {}\n",
    "deploy/README.md": `
chaotang.p15-operator-inputs.v1
releaseExpectationDigest verifierDigest bundleDigest immutableSnapshotDigest backupToolDigest inputsDigest
run_rc1_release_acceptance.mjs --operator-inputs
env -i writer stop restore rehearsal
Candidate image import and production restore require their own later release authority.
This is not permission to deploy. Any failure is a STOP.
docker compose stop backend
python -m app.operations.sqlite_backup backup --writer-stop-session /tmp/session
test healthy = unhealthy || exit 1
`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("manual COLD procedure")));
  assert.ok(errors.some((value) => value.includes("flow through the recovery trap")));
});

test("runbook keeps deployment and restore separately authorized", async () => {
  const root = await fixture({
    "deploy/compose.yaml": "name: chaotang-os\nservices: {}\n",
    "deploy/README.md": `
chaotang.p15-operator-inputs.v1
releaseExpectationDigest verifierDigest bundleDigest immutableSnapshotDigest backupToolDigest inputsDigest
run_rc1_release_acceptance.mjs --operator-inputs
env -i writer stop restore rehearsal
Any failure is a STOP.
`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("deployment and restore separately authorized")));
});

test("bare transactional assertions invoke the recovery trap", () => {
  const bash = resolveBashExecutable();
  assert.ok(
    bash,
    "Git Bash executable not found; set CHAOTANG_GIT_BASH to an absolute bash.exe path",
  );
  for (const assertion of [
    "printf '%s\\n' invalid | /usr/bin/grep -Eq '^valid$'",
    "test failed = healthy",
  ]) {
    const result = spawnSync(bash, ["-c", `
set -Eeuo pipefail
recover_previous_release() {
  STATUS=$?
  trap - ERR INT TERM
  printf 'RECOVERED:%s\\n' "$STATUS"
  exit "$STATUS"
}
trap recover_previous_release ERR INT TERM
${assertion}
printf 'BYPASSED\\n'
`], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /^RECOVERED:[1-9][0-9]*\n$/);
    assert.doesNotMatch(result.stdout, /BYPASSED/);
  }
});
