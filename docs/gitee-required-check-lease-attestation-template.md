# Gitee required-check template for S3

Status: `IMPLEMENTED_LOCAL`; this repository does not currently contain a Gitee CI configuration and no required check is claimed as enabled.

Protected CI must provision an Ed25519 public key, fetch the external signer's append-only signed ledger, and invoke exactly:

```bash
CHAOTANG_ATTESTATION_PUBLIC_KEY_PATH=/run/secrets/lease-attestation.pub \
  node scripts/integration-lease-gate.mjs --candidate "$GIT_COMMIT"
```

Repository administrators must configure this command as a mandatory Gitee protected-branch check. Until that external setting is verified, S3 must not be marked `ENFORCED`.
