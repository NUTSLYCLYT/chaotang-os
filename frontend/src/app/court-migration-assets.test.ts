import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  assert.ok(source.trim().length > 0, `${path} must not be empty`);
  return source;
}

test("court migration keeps valid image assets wired to their actual consumers", async () => {
  const assets = [
    {
      file: "../../public/assets/zhuangyuan/04-zhuangyuan-liubu-manors.webp",
      publicPath: "/assets/zhuangyuan/04-zhuangyuan-liubu-manors.webp",
      consumer: "../features/ministries-visual/MinistryOverviewScene.tsx",
      format: "webp",
    },
    {
      file: "../../public/shangshufang/portrait-chancellor.webp",
      publicPath: "/shangshufang/portrait-chancellor.webp",
      consumer: "../features/court-visuals/CourtQuickDock.tsx",
      format: "webp",
    },
    {
      file: "../../public/shangshufang/portrait-wang.webp",
      publicPath: "/shangshufang/portrait-wang.webp",
      consumer: "../features/court-visuals/CourtQuickDock.tsx",
      format: "webp",
    },
  ] as const;

  for (const asset of assets) {
    const assetUrl = new URL(asset.file, import.meta.url);
    const [metadata, bytes, consumer] = await Promise.all([
      stat(assetUrl),
      readFile(assetUrl),
      readSource(asset.consumer),
    ]);
    assert.ok(metadata.isFile(), `${asset.file} must remain a file`);
    assert.ok(metadata.size >= 12, `${asset.file} must contain a WebP header`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(bytes.readUInt32LE(4) + 8, metadata.size);
    assert.ok(
      consumer.includes(asset.publicPath),
      `${asset.consumer} must consume ${asset.publicPath}`,
    );
  }
});

test("migrated court clients import their production scenes and workspaces", async () => {
  const migratedImports = [
    ["./dadian/DadianOverviewClient.tsx", /import\s+\{\s*DadianScene\s*\}\s+from\s+"..\/..\/features\/dadian-visual\/DadianScene"/],
    ["../features/junjichu-visual/JunjichuClient.tsx", /import\s+\{\s*JunjichuScene\s*\}\s+from\s+"\.\/JunjichuScene"/],
    ["../features/ministries-visual/MinistryOverviewClient.tsx", /import\s+\{\s*DepartmentScene\s*\}\s+from\s+"\.\/DepartmentScene"/],
    ["../features/ministries-visual/MinistryOverviewClient.tsx", /import\s+\{\s*MinistryOverviewScene\s*\}\s+from\s+"\.\/MinistryOverviewScene"/],
    ["../features/ministries-visual/MinistryOverviewClient.tsx", /import\s+\{\s*OfficeScene\s*\}\s+from\s+"\.\/OfficeScene"/],
    ["./shiguan/ShiguanClient.tsx", /import\s+\{\s*ShiguanWorkspace\s*\}\s+from\s+"..\/..\/features\/shiguan-visual\/ShiguanWorkspace"/],
    ["./study/StudyClient.tsx", /import\s+\{\s*DevStudyWorkspace\s*\}\s+from\s+"..\/..\/features\/study-visual\/DevStudyWorkspace"/],
  ] as const;

  for (const [path, expectedImport] of migratedImports) {
    assert.match(await readSource(path), expectedImport);
  }
});

test("shared court shell and migrated workspaces import the quick dock and edict stage", async () => {
  const shell = await readSource("../features/court-visuals/ImmersiveCourtShell.tsx");
  assert.match(
    shell,
    /import\s+\{\s*CourtQuickDock\s*\}\s+from\s+"\.\/CourtQuickDock"/,
  );
  assert.match(
    shell,
    /<CourtQuickDock\s+centerSlot=\{quickDockCenter\}\s+showHandle=\{showQuickDockHandle\}\s*\/>/,
    "the shared shell must forward its optional center module and handle visibility to the quick dock",
  );

  const edictConsumers = [
    "../features/junjichu-visual/JunjichuScene.tsx",
    "../features/ministries-visual/DepartmentVisualPrimitives.tsx",
    "../features/shiguan-visual/ShiguanWorkspace.tsx",
    "../features/study-visual/DevStudyWorkspace.tsx",
  ] as const;

  for (const consumer of edictConsumers) {
    const source = await readSource(consumer);
    assert.match(source, /court-visuals\/edict\/EdictStage/);
    assert.match(source, /<EdictStage\b/);
  }
});

test("court quick dock renders portraits through Next Image", async () => {
  const quickDock = await readSource("../features/court-visuals/CourtQuickDock.tsx");
  assert.match(quickDock, /import Image from ["']next\/image["']/);
  assert.doesNotMatch(quickDock, /<img\b/);
});

test("legacy department demo files stay deleted", async () => {
  const deletedFiles = [
    "../features/department-demo/DepartmentDemoViews.tsx",
    "../features/department-demo/departmentDemo.module.css",
    "../features/department-demo/departmentDemoData.ts",
    "../features/department-demo/departmentDemoData.test.ts",
  ] as const;

  for (const path of deletedFiles) {
    await assert.rejects(stat(new URL(path, import.meta.url)), { code: "ENOENT" });
  }
});
