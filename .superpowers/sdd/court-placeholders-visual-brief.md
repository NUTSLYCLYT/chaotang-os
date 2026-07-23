# Court entry visual shell brief

## Scope

Improve the visual shells of the protected dev-only court entry routes without adding invented workflow data or APIs:

- `frontend/src/components/chaotang/CourtPlaceholderPage.*`
- the existing pages under `frontend/src/app/{dadian,junjichu,command-center,liubu,zhuanshu}/**`
- relevant focused tests
- copy only the exact dev art assets needed: Dadian hall stage, Junjichu scene/war-room, and Liubu scene.

## Contract

- Keep the existing server `requireUser` protection and route parameters intact.
- Preserve the explicit honest state: these are visual entry points with no current business surface; they must say `功能筹备中`, never show mock cases, statistics, people, messages, or pretend live data.
- Apply the corresponding dev visual identity per route (Dadian hall, Junjichu command, Liubu ministry, Zhuangshu secret archives), responsive in the shared component.
- Do not import dev components, Tailwind, Lucide, legacy hooks/stores/API clients or change existing APIs/session/auth.
- Static visual-only links may only use actual existing routes.

## Verification

TDD with a focused red test first; then focused tests, lint, typecheck, full frontend suite, production build and `git diff --check`. Do not commit/push. Write `.superpowers/sdd/court-placeholders-visual-report.md`.
