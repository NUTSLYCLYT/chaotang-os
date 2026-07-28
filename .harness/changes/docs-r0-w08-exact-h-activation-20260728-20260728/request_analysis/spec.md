# 规格说明：docs-r0-w08-exact-h-activation-20260728-20260728

## Background

R0-W08 was previously defined as `Product Acceptance Hardening` and the
professional gate has been satisfied by assigning:

- `security = r0-security-owner`
- `legal = r0-legal-owner`
- `release = r0-release-owner`

The next governance step is to activate W08 so product acceptance work can run
under a single scoped authority.

## Design

This candidate adds an R0-W08 active-packet profile and updates the v2 manifest
to bind W08 to exact evidence:

```text
review base = 39bd654b4cac8ee0fa59ddcbd7ad6a79f5ee9097
candidateH = 80940d237a39f176b458763fd70e2c33d4ccac07
candidate tree = 6477274dbb6e6d8a8472ccf17875102f356e5675
review package sha256 =
  f5ee905dddfa2ce778fa0418102cefd5cd54ad0f5d32116d914822337ac32b7c
activation intent sha256 =
  0194067bd5f4ad74eeeb767272349d61d5a70a44fd4ac4e3f0643359eacd57be
owner approval sha256 =
  e085f7572f2d1d204b9168d0eb6164e2d37f548c459f385c3f57f76e90c9dd24
review sha256 =
  497b0ce5e5623095882c4b1eaef830dfde7f469728d23ce9fa028a71adbc4770
```

The W08 review package covers the previously integrated professional
reassignment candidate, which is the direct prerequisite for W08 activation.

## Expected CLI Behavior

| State | W08 authorization |
| --- | --- |
| isolated candidate before EXT fast-forward | `STOP / INVALID_EXECUTION_AUTHORITY` because EXT ref does not equal pinned HEAD |
| integrated local EXT candidate | `GO / APPROVED_WORK_PACKAGE` |
| W09 request | `STOP / BLOCKED_DEPENDENCY` until W08 is closed |

## Acceptance Criteria

- v2 schema remains structurally valid
- W08 active profile validates its review package and evidence
- professional reassignment gate no longer blocks W08
- pre-integration candidate fails closed on EXT ref mismatch
- root doctor passes
- authority v2 tests pass
- no production/runtime action occurs
