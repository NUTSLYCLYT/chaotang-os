# Governance candidate verification

Candidate identity is pending commit.

- `node --test scripts/reviewer-successor-w08.nodetest.mjs`: PASS, 14/14.
- `node --test scripts/r0-amendment-check.nodetest.mjs`: PASS, 30/30.
- `node --test scripts/execution-authority-v2.nodetest.mjs`: PASS, 75/75.
- Historical W06/W07 reviewer and authority behavior remains green.
- No product candidate files were changed in the frozen product worktree.

The first governance candidate was rejected during security review because the
CLI entrypoint was not protected and the new exact verifier lacked direct
adversarial coverage. The successor candidate now protects the CLI and authority
schema, rejects unsafe repository-local Git state, pins committed evidence bytes,
uses candidate-scoped attributes for both diffs, and directly tests CLI drift,
mutable evidence, symlinks, hard links, and hostile local Git configuration.
Marked JSON evidence also rejects duplicate keys before parsing.

The next governance candidate was also rejected during exact-H review because
`info/grafts` could forge ancestry independently of replace refs. The verifier
now rejects graft files and shallow repositories, with direct negative tests.

Fresh pre-freeze verification after those corrections:

- execution-authority-v2: 75/75 PASS
- successor + amendment + professional matrix: 58/58 PASS
- professional-agent matrix CLI: PASS (8 assets; 6 VERIFIED; 2 PARTIAL)
- working-tree and product-to-governance `git diff --check`: PASS

G4 was rejected during exact-H review because a descendant activation commit
could still carry unreviewed non-authority product changes. The verifier now
requires one direct, single-parent carrier commit and an exact canonical path set
containing only the two manifests and the W08 evidence files.

Fresh pre-freeze verification after the G4 carrier fix repeated the complete
75/75 authority suite, 58/58 combined suite, matrix CLI, and both diff checks;
all passed.
