### Task 1: Freeze the 108-entry source inventory and create a failing completeness gate

**Files:**

- Create: `docs/migrations/2026-07-27-only-worktree-dispositions.json`
- Create: `scripts/check_migration_completeness.mjs`
- Create: `scripts/check_migration_completeness.test.mjs`
- Modify: `.github/workflows/harness.yml`

**Interfaces:**

- Consumes: source `git status --porcelain=v1 --untracked-files=all`, source file SHA-256 values, restore commit `734b0aad`.
- Produces: a 108-entry manifest and `check_migration_completeness.mjs` CLI with default CI mode and optional `--source-worktree <absolute-path>` mode.

- [ ] **Step 1: Generate the frozen inventory as test input**

Use a temporary one-off Node command to read the source status and calculate hashes without modifying the source:

```powershell
node -e "const{execFileSync}=require('node:child_process');const{createHash}=require('node:crypto');const{readFileSync,existsSync}=require('node:fs');const{join}=require('node:path');const root='D:\\workspace\\chaotang-os-harness-only-worktree';const lines=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);const rows=lines.map(line=>{const status=line.slice(0,2).trim();const path=line.slice(3).replace(/^\"|\"$/g,'');const file=join(root,path);return{path,sourceStatus:status,sourceSha256:existsSync(file)?createHash('sha256').update(readFileSync(file)).digest('hex'):null};});console.log(JSON.stringify({count:rows.length,rows},null,2));"
```

Expected: `count` is `108`; status totals are `43 M`, `4 D`, and `61 ??`.

- [ ] **Step 2: Write negative checker tests**

`scripts/check_migration_completeness.test.mjs` must create temporary repositories/manifests and assert non-zero results for:

```js
const invalidCases = [
  "missing disposition",
  "duplicate source path",
  "count drift",
  "unknown source entry",
  "missing target path",
  "deleted source target still exists",
  "empty superseded or rejected reason",
  "source sha drift",
];
```

It must also assert that a complete 108-entry fixture exits zero in default mode and in `--source-worktree` mode.

- [ ] **Step 3: Run the checker test and verify RED**

Run:

```powershell
node --test scripts/check_migration_completeness.test.mjs
```

Expected: FAIL because `scripts/check_migration_completeness.mjs` and the manifest do not exist.

- [ ] **Step 4: Implement the manifest schema and checker**

The manifest top level must contain:

```json
{
  "sourceHead": "df037478d50f4681103a4d62de4f959e51a55856",
  "restoreCommit": "734b0aad07eb9b48469e9263e24cdd68fee1c4e4",
  "counts": {
    "total": 108,
    "modified": 43,
    "deleted": 4,
    "untracked": 61,
    "restoreIdentical": 58,
    "postRestoreModified": 37,
    "dirtyOnlyAdded": 13
  },
  "canonicalInventorySha256": "the lowercase SHA-256 of the canonical JSON serialization of entries",
  "entries": []
}
```

Each entry must have `path`, `sourceStatus`, `sourceLayer`, `sourceSha256`, `disposition`, `targetPaths`, `reason`, and `verification`. The checker must reject unknown keys, duplicate paths, wrong counts, missing targets, surviving targets for source deletions, generic/empty rejection reasons, and source SHA drift.

- [ ] **Step 5: Add the checker to CI and verify GREEN**

Add these commands to the harness job:

```yaml
- run: node --test scripts/check_migration_completeness.test.mjs
- run: node scripts/check_migration_completeness.mjs
```

Run:

```powershell
node --test scripts/check_migration_completeness.test.mjs
node scripts/check_migration_completeness.mjs --source-worktree D:\workspace\chaotang-os-harness-only-worktree
```

Expected: tests PASS; the live-source check remains RED until Tasks 2-7 have assigned valid target dispositions.

---

