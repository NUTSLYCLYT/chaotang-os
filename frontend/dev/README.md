# Development Root

`dev/` is the single home for development-process files in this repository.

Use it for work notes, handoffs, release checklists, local artifacts, screenshots,
and temporary evidence. Do not add new loose files or ad-hoc directories at the
repository root unless a framework or toolchain must discover them there.

## Layout

- `notes/` - temporary analysis, review notes, and context recovery records.
- `handoffs/` - cross-agent or cross-day handoff documents.
- `release/` - release checklists, packaging notes, and launch records.
- `artifacts/` - generated build packages and machine output. Ignored by git.
- `screenshots/` - browser screenshots and visual QA output. Ignored by git.
- `tmp/` - disposable scratch files. Ignored by git.
- `reference/` - checked-in historical evidence and visual references.
- `contracts/` - CourtOS validation contracts: schemas, loops, prompts, and
  golden evals.

## Migration Rule

Keep existing source, test, framework, and toolchain directories in place until a
dedicated migration changes their references and validates the full workflow.
New development-process files should start here.
