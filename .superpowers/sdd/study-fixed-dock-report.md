# /study fixed Dock report

Initial fixed Dock work passed: targeted StudyClient test, lint, typecheck, and diff check.

## Review minor fix

- Removed the extra `.decreeInput:focus-visible` gold outline and offset to match dev fixed `focus:outline-none`.
- Added a regression assertion; confirmed RED before the CSS removal and GREEN afterward.
- Re-ran successfully:
  - `npm test -- --test-name-pattern="Study decree composer matches the dev fixed bottom Dock visual contract"`
  - `npm run lint`

No BFF or submission behavior changed. No real decree was sent. No commit or push was performed.
