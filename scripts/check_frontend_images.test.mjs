import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkFrontendImages } from "./check_frontend_images.mjs";

async function withFixture(files, run) {
  const root = await mkdtemp(path.join(tmpdir(), "frontend-images-"));

  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = path.join(root, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("rejects legacy raster formats", async () => {
  await withFixture(
    { "frontend/public/assets/scene.png": Buffer.alloc(1) },
    async (root) => {
      const errors = await checkFrontendImages(root);
      assert.ok(errors.some((error) => error.includes("legacy raster")));
    },
  );
});

test("enforces background, portrait, and aggregate byte budgets", async () => {
  await withFixture(
    {
      "frontend/public/assets/large-background.webp": Buffer.alloc(600 * 1024 + 1),
      "frontend/public/heroes/large-portrait.webp": Buffer.alloc(150 * 1024 + 1),
      "frontend/public/assets/aggregate.webp": Buffer.alloc(12 * 1024 * 1024),
    },
    async (root) => {
      const errors = await checkFrontendImages(root);
      assert.ok(errors.some((error) => error.includes("600 KiB")));
      assert.ok(errors.some((error) => error.includes("150 KiB")));
      assert.ok(errors.some((error) => error.includes("12 MiB")));
    },
  );
});

test("reports source references whose public files are missing", async () => {
  await withFixture(
    { "frontend/src/example.tsx": 'const image = "/assets/missing.webp";\n' },
    async (root) => {
      const errors = await checkFrontendImages(root);
      assert.ok(errors.some((error) => error.includes("missing image reference")));
    },
  );
});

test("reports source references that resolve to directories", async () => {
  await withFixture(
    {
      "frontend/public/assets/directory/placeholder.txt": "fixture",
      "frontend/src/example.ts": 'const image = "/assets/directory";\n',
    },
    async (root) => {
      const errors = await checkFrontendImages(root);
      assert.ok(errors.some((error) => error.includes("missing image reference")));
    },
  );
});

test("accepts referenced WebP background and portrait within budgets", async () => {
  await withFixture(
    {
      "frontend/public/assets/background.webp": Buffer.alloc(600 * 1024),
      "frontend/public/heroes/portrait-guide.webp": Buffer.alloc(150 * 1024),
      "frontend/src/example.css":
        '.hero { background: url("/assets/background.webp"); }\n' +
        '.portrait { background: url("/heroes/portrait-guide.webp"); }\n',
    },
    async (root) => {
      assert.deepEqual(await checkFrontendImages(root), []);
    },
  );
});
