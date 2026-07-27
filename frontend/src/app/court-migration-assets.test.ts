import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  assert.ok(source.trim().length > 0, `${path} must not be empty`);
  return source;
}

test("court migration keeps the three shared binary assets non-empty", async () => {
  const assets = [
    "../../public/assets/zhuangyuan/04-zhuangyuan-new.webp",
    "../../public/shangshufang/portrait-chancellor.webp",
    "../../public/shangshufang/portrait-wang.webp",
  ] as const;

  for (const asset of assets) {
    const metadata = await stat(new URL(asset, import.meta.url));
    assert.ok(metadata.isFile(), `${asset} must remain a file`);
    assert.ok(metadata.size > 0, `${asset} must not be empty`);
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
  assert.match(shell, /<CourtQuickDock\s*\/>/);

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
