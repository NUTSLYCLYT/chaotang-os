# S3 external lease attestation evidence

Status: `IMPLEMENTED_LOCAL`. Gitee protected-branch required check is not configured by repository code and remains an administrator action.

Worker creates an unsigned request containing commit facts, covered paths, credential commitments (never nonce), and a digest of the ordered lease-audit checkpoint. Only the separate Ed25519 signer process reads `CHAOTANG_ATTESTATION_PRIVATE_KEY_PATH`. The repository and worker have no signing API or private key.

The mandatory integrator entry is `node scripts/integration-lease-gate.mjs --candidate <exact-40-char-sha>`. It fails closed without `CHAOTANG_ATTESTATION_PUBLIC_KEY_PATH`, externally signed envelope, matching append-only checkpoint, exact Git object facts, and valid non-revoked fencing epochs. Merge commits are rejected; integration must use fast-forward or cherry-pick.

Git changes are read with `git diff --name-status -z`; rename/copy records contribute both old and new paths, while delete, mode, symlink and gitlink paths remain explicit entries. Verification runs from an isolated checkout sharing the same repository identity.

Focused TDD: 9 passed, 0 failed. Negative coverage includes absent public key/signed proof (`--no-verify`), signature tamper, revoked/expired epoch, undeclared worktree and sibling path. A re-digested tamper matrix changes Task, owner, Lease owner/resource/mode and process identity and is rejected by signer-side DB reconstruction. Output scanning proves the unsigned request and signed envelope do not contain the holder nonce. Hook tests prove idempotent install/uninstall, retention of the dispatcher while another hook remains, and refusal to overwrite an existing hook. A real local Git/submodule test commits rename old+new, delete, executable-mode, symlink-target, gitlink and Unicode/space path changes and proves the request is built from those Git objects.

The hook is feedback only. Gitee configuration template: `docs/gitee-required-check-lease-attestation-template.md`.
