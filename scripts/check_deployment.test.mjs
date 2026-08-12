import assert from "node:assert/strict";
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
  assert.ok(errors.some((value) => value.includes("ARG NODE_IMAGE")));
  assert.ok(errors.some((value) => value.includes("npm ci")));
  assert.ok(errors.some((value) => value.includes("UID/GID 10001")));
  assert.ok(errors.some((value) => value.includes("addgroup/adduser")));
  assert.ok(errors.some((value) => value.includes(".env*")));
  assert.ok(errors.some((value) => value.includes(".next")));
  assert.ok(errors.some((value) => value.includes("NEXT_PUBLIC_*")));
  assert.ok(errors.some((value) => value.includes("frontend tests")));
  assert.ok(errors.some((value) => value.includes("/app/app")));
});

test("rejects public ingress and published application ports", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: ["8080:8080"]\n  backend:\n    ports: ["8000:8000"]\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("public 80/443")));
  assert.ok(errors.some((value) => value.includes("8000 must not be published")));
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

test("requires backend outbound access without publishing its port", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  backend:\n    expose: ["8000"]\n    networks: [app]\n  caddy:\n    ports: ["80:80", "443:443"]\n    read_only: true\nnetworks:\n  app:\n    internal: true\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=\nWESTOCK_MCP_CREDENTIAL=\n",
  });

  const errors = await checkDeployment(root);

  assert.ok(errors.some((value) => value.includes("dedicated outbound network")));
  assert.ok(errors.some((value) => value.includes("unprivileged bridge")));
  assert.ok(!errors.some((value) => value.includes("8000 must not be published")));
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
