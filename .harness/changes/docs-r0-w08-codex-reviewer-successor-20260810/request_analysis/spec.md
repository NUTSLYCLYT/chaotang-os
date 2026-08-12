# Specification

## Goal

Permit an exact-H R0-W08 review by two independent Codex QA sessions when Claude
Code is unavailable, while preserving the existing product candidate and all
historical reviewer evidence.

## Required properties

- Applies only while `R0-W08` is `ACTIVE`.
- Keeps global `independentReviewer: Claude Code` unchanged.
- Keeps `reviewerReassignment` for W07 byte-for-byte unchanged.
- Requires two distinct canonical agent identities, no fork context, no writes,
  no candidate mutation, `GO`, `HIGH=0`, and `MEDIUM=0`.
- Binds the product base, product H, product tree, and exact binary diff.
- Separately binds this governance candidate H, tree, and exact binary diff.
- Rejects missing, altered, unsafe, duplicated, or post-review-drifted evidence.
- Expires after `R0-W08_MERGED_AND_VERIFIED` and never authorizes W09.

## Non-goals

- No product runtime, API, frontend, database, deployment, or provider changes.
- No global reviewer replacement.
- No rewrite of W07 history.
- No production-readiness claim.
