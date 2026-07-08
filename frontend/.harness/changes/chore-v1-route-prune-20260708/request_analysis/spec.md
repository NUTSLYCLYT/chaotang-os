# Spec

## Background

The 1.0 product surface needs a small fixed page map:
大殿, 上书房, 军机处, 六部, 诸司, 史馆, with only the requested second-level offices.

## Scope

- Keep existing page implementations.
- Move canonical App Router directories to the 1.0 paths.
- Retire extra page routes into attic instead of deleting irreversibly.
- Keep redirects for legacy URLs.

## Non-goals

- No visual redesign.
- No backend swarm changes.
- No new department capability claims.

## Acceptance

- `src/app` exposes only the 1.0 business routes plus auth/entry infrastructure.
- 六部 supports the requested second-level paths.
- TypeScript and production build pass.
