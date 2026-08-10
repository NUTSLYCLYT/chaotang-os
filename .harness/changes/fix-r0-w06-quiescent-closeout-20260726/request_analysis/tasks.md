# Tasks: R0-W06 Quiescent Closeout

- [x] Freeze design `1ca2c267`.
- [x] Freeze implementation plan `80e3049f`.
- [x] Observe real-repository quiescent RED: `51 passed / 1 failed`.
- [x] Set W06 to `MERGED_AND_VERIFIED`.
- [x] Set `activeWorkPackage=null`.
- [x] Verify W06 and W07 both stop with `NO_ACTIVE_WORK_PACKAGE`.
- [x] Run complete authority and harness verification: `62 passed`, both
  doctors clean.
- [x] Receive independent read-only GO.
- [x] Record `VERIFIED_COMPLETE / ACCEPTED_NOT_INTEGRATED`.
- [x] Receive explicit local EXT integration approval.
- [x] Fast-forward accepted Packet `5d33c53e` into local EXT.
- [x] Run post-integration authority and harness verification.

## Prohibited

- Do not add W07 to the ledger.
- Do not modify product code.
- Do not push, deploy, migrate, or touch listener 3050.
