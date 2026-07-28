import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const VIEW_PATHS = [
  "../app/jinyiwei/page.tsx",
  "../features/junjichu-visual/JunjichuScene.tsx",
  "../features/ministries-visual/DepartmentScene.tsx",
  "../features/ministries-visual/OfficeScene.tsx",
  "../features/shiguan-visual/ShiguanArchiveDetail.tsx",
  "../features/shiguan-visual/ShiguanWorkspace.tsx",
  "../features/study-visual/StudySideDrawers.tsx",
  "../features/study-visual/DevStudyWorkspace.tsx",
] as const;

const DISPLAY_FIELDS = [
  "replyTime",
  "createdAt",
  "updatedAt",
  "asOf",
  "retrievedAt",
  "completedAt",
  "startedAt",
  "repliedAt",
  "publishedAt",
  "reviewedAt",
  "expiresAt",
  "notBefore",
  "investigationStartedAt",
  "investigationCompletedAt",
] as const;

function assertNoDirectBusinessTimeRendering(source: string, label: string): void {
  const visibleSource = source.replace(
    /dateTime=\{[^{}]*\}/g,
    "",
  );
  const aliases = new Map<string, string>();

  for (const match of visibleSource.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    for (const binding of match[1].split(",")) {
      const [property, alias = property] = binding.split(":").map((part) => part.trim());
      if (DISPLAY_FIELDS.includes(property as typeof DISPLAY_FIELDS[number])) {
        aliases.set(alias, property);
      }
    }
  }

  for (const field of DISPLAY_FIELDS) {
    const assignmentPattern = new RegExp(
      `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;\\n]*(?:\\?\\.|\\.)${field}\\b`,
      "g",
    );
    for (const match of visibleSource.matchAll(assignmentPattern)) {
      aliases.set(match[1], field);
    }
  }

  for (const interpolation of visibleSource.matchAll(/(?:\$\{|\{)([^{}\n]+)\}/g)) {
    const expression = interpolation[1];
    if (/\bformatBusinessTime\s*\(/.test(expression)) continue;

    for (const field of DISPLAY_FIELDS) {
      const directAccess = new RegExp(
        `(?:\\?\\.|\\.)${field}\\b|\\[\\s*["']${field}["']\\s*\\]`,
      );
      assert.doesNotMatch(expression, directAccess, `${label} directly renders ${field}`);
    }
    for (const [alias, field] of aliases) {
      assert.doesNotMatch(
        expression,
        new RegExp(`\\b${alias}\\b`),
        `${label} directly renders ${field} through ${alias}`,
      );
    }
  }
}

test("direct business-time guard rejects JSX and template-literal rendering", () => {
  assert.throws(
    () => assertNoDirectBusinessTimeRendering("<span>{archive.replyTime}</span>", "jsx"),
    /directly renders replyTime/,
  );
  assert.throws(
    () => assertNoDirectBusinessTimeRendering("<span>{`at ${archive?.replyTime}`}</span>", "template"),
    /directly renders replyTime/,
  );
  assert.throws(
    () => assertNoDirectBusinessTimeRendering("<span>{archive['replyTime']}</span>", "bracket"),
    /directly renders replyTime/,
  );
  assert.throws(
    () => assertNoDirectBusinessTimeRendering(
      "const { replyTime: renderedAt } = archive; <span>{renderedAt}</span>",
      "destructured alias",
    ),
    /directly renders replyTime through renderedAt/,
  );
  assert.throws(
    () => assertNoDirectBusinessTimeRendering(
      "const renderedAt = archive.replyTime; <span>{renderedAt}</span>",
      "assigned alias",
    ),
    /directly renders replyTime through renderedAt/,
  );
});

test("direct business-time guard allows semantic dateTime attributes", () => {
  assert.doesNotThrow(() => assertNoDirectBusinessTimeRendering(
    "<time dateTime={archive.replyTime}>{formatBusinessTime(archive.replyTime)}</time>",
    "semantic time",
  ));
});

test("user-visible business times use the shared formatter in every migrated view", async () => {
  for (const path of VIEW_PATHS) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");

    assert.match(source, /import\s+\{\s*formatBusinessTime\s*\}\s+from\s+["'][^"']*formatBusinessTime["'];/, path);
    assert.match(source, /formatBusinessTime\(/, path);
    assert.doesNotMatch(source, /toLocaleString\s*\(/, path);
    assert.doesNotMatch(source, /function\s+(?:when|displayDate)\s*\(/, path);

    assertNoDirectBusinessTimeRendering(source, path);
  }
});
