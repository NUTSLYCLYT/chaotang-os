# Adaptive Routing Validator False Green

## Summary

The adaptive-routing harness originally accepted unsafe policy inversions as long as unrelated marker words remained somewhere in each entry-point file. This produced a false green for governance rules that determine workflow and authorization handling. A later merge check exposed a second environment false green: self-tests passed in the LF worktree but failed after Git checked the same fixtures out as CRLF on `dev`.

## Root Cause

`adaptiveRoutingPolicyErrors` first tried to infer meaning with linguistic matchers, then sealed only the text between Markdown sentinels. The second boundary still left the rest of each entry point unconstrained, left the prompt on an ordered regex, ignored the plan templates, and normalized away trailing whitespace. Conflicting policy before or after a valid block—and prompt prefix/suffix conflicts—could therefore pass while the plan silently drifted from the executable policy. Separately, the self-test loaded real files without canonicalizing their line endings before applying LF-based mutation targets, even though production validation canonicalized those same inputs. The test therefore depended on the worktree checkout format.

## Prevention

Make normalized whole-file SHA-256 equality authoritative for root instructions, guide, executable skill, OpenAI prompt, and the approved plan itself. Normalization changes only CRLF or bare CR to LF; it never trims content, BOM, or trailing spaces. Normalize all real-file self-test fixtures at the load boundary before applying canonical mutations, so test construction and production validation share the same newline domain. Aggregate any plan hash mismatch into all three Markdown entry errors so the four-entry fail-closed shape remains stable. Keep sentinels, template uniqueness, step binding, fence handling, and HTML-comment handling only as diagnostics; no successful parse can compensate for a plan hash mismatch. Register this named failure record in `REQUIRED_FILES` and in the approved plan's Files, verification, diff, and git-add scope so an untracked omission cannot pass. Intentional plan changes must update the approved plan, its expected hash, the real-file self-test fixture, and evidence together.

## Detection

Run `node scripts/check_harness.mjs --self-test` from both the implementation worktree and the post-merge checkout when their Git line-ending materialization differs. The fixture reads the real current four entries and plan, canonicalizes only CRLF or bare CR to LF, and compares the plan against a hard-coded expected digest. Explicit CRLF and bare-CR regression cases prove that canonical template mutations apply before the broader mutation suite runs. Root-cause mutations splice HTML comments into the Task 2 token in two ways and into Step 1-4, then prove that plan trailing spaces, BOM, and arbitrary comments all fail. Existing structural mutation cases remain diagnostic regression coverage. Every mutation asserts that it changed the fixture. Fully empty agents/guide/skill/prompt/plan must still return exactly four errors.

## Evidence

- Approved behavior: `docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md`
- Validator and mutation suite: `scripts/check_harness.mjs`
- Executable policy: `AGENTS.md` and `.agents/skills/codex-engineering-workflow/SKILL.md`
- Remediation plan: `docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md`
