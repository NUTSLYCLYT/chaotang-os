# W08 User Acceptance Records

Place the approved, deidentified final W08 user acceptance record JSON here
after the real sessions are complete.

Do not add synthetic, assisted, developer-authored, or partial records as final
acceptance evidence.

Closeout preflight automatically scans `records/*.json` when `--user-acceptance`
is omitted. The scan fails closed unless this directory contains exactly one
approved JSON file.

When `--closeout-preflight --user-acceptance <path>` is used, `<path>` must also
be inside this directory.

The approved JSON must include:

```json
{
  "approval": {
    "status": "APPROVED",
    "owner": "<product-acceptance-owner>",
    "approved_at": "<ISO-8601 timestamp>",
    "evidence_review_id": "<review evidence id>"
  }
}
```

Do not place fixtures, rehearsal files, screenshots, logs, or draft records in
this directory.
