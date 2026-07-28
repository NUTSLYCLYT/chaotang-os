# R0-W08 Professional Reassignment Owner Evidence

Product Owner approved assigning the R0-W08/R0-W09 professional gate roles away
from the default owner before W08 activation.

```json
{
  "evidenceVersion": "r0-professional-reassignment.v1",
  "decision": "APPROVED",
  "approver": "lyt",
  "base": "39bd654b4cac8ee0fa59ddcbd7ad6a79f5ee9097",
  "scope": ["R0-W08", "R0-W09", "REAL_CUSTOMER_DATA"],
  "assignments": {
    "security": "r0-security-owner",
    "legal": "r0-legal-owner",
    "release": "r0-release-owner"
  },
  "exclusions": [
    "NO_W08_ACTIVATION",
    "NO_W09_ACTIVATION",
    "NO_PRODUCT_CODE_CHANGE",
    "NO_PUSH",
    "NO_DEPLOYMENT",
    "NO_DB_MIGRATION",
    "NO_LISTENER_3050_TAKEOVER",
    "NO_PRODUCTION_CLAIM"
  ]
}
```

This evidence does not activate W08. It only records the owner-approved
professional role assignment required before a later W08 activation candidate.
