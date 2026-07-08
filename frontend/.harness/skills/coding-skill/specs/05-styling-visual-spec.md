# Coding Spec 05 — Styling and Visual Trust

Use for CSS, visual components, and UX changes.

## Responsibilities

- Preserve Chaotang visual language and Chinese-first presentation.
- Keep decision-weighting UI honest and evidence-backed.
- Maintain mobile/desktop usability.

## Rules

- Do not rewrite `src/app/globals.css` wholesale.
- Do not change frozen design tokens or animation timing unless the spec explicitly asks for design-system work.
- Visual emphasis on decisions, risk, verdicts, or recommendations is high-risk.
- UI text must not obscure LIVE / MIXED / DEMO boundaries.
- Use screenshots or Playwright evidence for meaningful visual changes.

## Verification

- targeted Playwright route screenshots
- `pnpm build`
- manual or scripted console-error check for release-facing views
