# EXT Asset Classification and Capture Ledger

## Capture Rules

- Snapshot: `2026-07-25T05:34:43Z`
- Local accepted EXT: `c0a2c7ec2ac38ba522db3f9945bec722bd47c886`
- Local accepted EXT tree: `b0cc93c7471fdfb70b6de22cbbb232ef5ae39ec9`
- Remote EXT: `8feae838f09ad5202b21332d4280b989ab776bd7`
- Production state: `NOT_DEPLOYED`
- Main dirty tree full tracked binary diff SHA-256:
  `3c1ebf0e082e8e7d611026e2e46006da75b3e8820451fc6a2ea18447e3426e24`

For tracked group digests, paths are supplied to `git diff --binary HEAD --`
in the order shown below. For committed candidates, the range digest is
`git diff --binary <merge-base> <source-head> | sha256sum`. Untracked file
hashes are direct `sha256sum` results.

## KEEP

### K1: Main Runtime and Release Identity

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os` |
| Source branch | `docs/r0-trusted-kernel-amendment-20260720` |
| HEAD | `c6f2d64252acf578478405637dba9ac44be161ae` |
| Tree | `49de978e42b4862d842c81803a2af0c6197c5163` |
| Source status | Main tree: 101 tracked changes, 135 untracked files |
| Group tracked binary diff SHA-256 | `15ca0f7ccd93ba900af838fdf7301f95bbf7db9723482665ae84ac104a3e5c19` |
| Disposition | KEEP, extract by hunk only |
| Owner | Window 4 Release Identity |
| Target Packet | `EXT-I2` |

Tracked path manifest:

```text
frontend/.harness/wiki/release-operations.md
frontend/AGENTS.md
frontend/README.md
frontend/deploy/README.md
frontend/deploy/env.example
frontend/deploy/services/courtos-web.service.template
frontend/package.json
frontend/scripts/chaotang-live-business-gates.mjs
frontend/scripts/chaotang-release-gates.mjs
frontend/scripts/daily-metrics.mjs
frontend/scripts/final-release-harness-route.nodetest.ts
frontend/scripts/final-release-harness.mjs
frontend/scripts/health-monitor.mjs
frontend/scripts/lib/immutable-build-manager.mjs
frontend/scripts/prod-doctor.mjs
frontend/scripts/prod-release-gate.mjs
frontend/scripts/prod-runtime-identity.mjs
frontend/scripts/release-screenshot-qa.mjs
frontend/scripts/runtime-env-source-contract.nodetest.mjs
frontend/scripts/safe-prod-lifecycle.nodetest.ts
frontend/scripts/safe-prod-stop.mjs
frontend/scripts/safe-prod-wrappers.nodetest.mjs
frontend/scripts/system-restore.nodetest.mjs
frontend/scripts/system-restore.sh
scripts/canonical-deploy-paths.nodetest.mjs
scripts/lib/release-evidence-ledger.mjs
```

Retained untracked files:

```text
614a7f220c3dd3383347289d24b527ebe8bb0ca8e43e42dd2ba12027be532893  frontend/scripts/canonical-http-probe.mjs
e14b0ccd9dcaa9019afa5ce21c03ddab9b366dd1fe827e63ef88c3c8d8caf784  frontend/scripts/canonical-http-probe.nodetest.mjs
90084308c09559e57f08b3c6071cb040770a10a28e7e2b4626c4efc7666a19ad  frontend/scripts/chaotang-live-business-gates.nodetest.mjs
21f63d6d84da852d53aa0cbdb6c61f5ddf9ef526d1c12eaf233b1c5cafe79eae  frontend/scripts/child-process-registry.nodetest.mjs
ccf829fdc7fe094584da4e3407c73340885dbe7bb5726c2089abc1e32c71a644  frontend/scripts/daily-metrics-health.nodetest.mjs
7b5457d44c0fa3a75aceb71cd518ae434003690efda5730205d2c30cd4600ff3  frontend/scripts/deploy-contract.nodetest.mjs
2f300d8235c227901c5bc00d90c26e38438b5970ea309655a9d9cdbe79754b9d  frontend/scripts/health-monitor.nodetest.mjs
6ce19763e6e8b1f1a2db45661b7153c34fe374eabccef19c25724a3f46366076  frontend/scripts/immutable-release-identity.nodetest.mjs
eca90dd3bfe82034a7b8c5d92ac1408ac364da7fcf7307dbcf46475b48c5e7eb  frontend/scripts/lib/canonical-http-probe.mjs
fba86c6ccf1f2658401a062b8b4fe783bc0c52fde9998d9b1a6148b74c15359c  frontend/scripts/lib/frontend-runtime-health.mjs
61647de4b490ecaa1a5cfd40cac7bbdac7d3a2db9a24222b09bd40d20a4ba52a  frontend/scripts/lib/immutable-release-identity.mjs
57086fec65dcb6144697308bc18f948110078998724db6890b1b5ffc81e419be  frontend/scripts/lib/load-env-files.mjs
395856ef86ff7ab79301eed5a35d7064962bd063a0f170f43eb7cbeca7b039a7  frontend/scripts/lib/managed-child-registry.mjs
faf55054488408f8c808515c2b6b85b995bc587e4c05034b994252c4e766f782  frontend/scripts/lib/production-backend-target.mjs
24987ec4af02ba46d55b286c432d412307965713c6f85427ad8825a2a32f43d7  frontend/scripts/lib/production-frontend-target.mjs
2a43de9c40d488b35d7622b860dea8aad13e99f918e413246e642bf6763979a5  frontend/scripts/lib/release-code-identity.mjs
224cad9644f9787eec705f63716831c36cc85f284d4be026413d243e3c548331  frontend/scripts/lib/release-report-outcome.mjs
e770da3f6cf8cdcaf708263ced93d7451170b7e218bca25f8b394d41dce0e928  frontend/scripts/lib/release-screenshot-policy.mjs
ab250f26fe539aee506f434445cff10c3ab6d853d3f76b408e9817cdff5a8208  frontend/scripts/lib/service-health.mjs
71d16e3c0f687df5be8ac8a29f89ee0eec89bfe1ca40d950c78784c1d4d972a8  frontend/scripts/monitor-entry-wiring.nodetest.mjs
061d182aae5e389ab8b613ee6a560b5172ea67a5356060cff1a771c810ec662c  frontend/scripts/prod-release-gate-lifecycle.nodetest.mjs
28eaa1ebae5b8812c678d92d99db9e0f3916494e7fa5a4fbc7a1927268587dad  frontend/scripts/production-backend-target.nodetest.mjs
879d12bb55ab3a76b1b3063e59eaef1dd95f841ef7b93b764a872ceda7382944  frontend/scripts/production-frontend-target.nodetest.mjs
350d2c88940be0d2097a7a3b129ce2d176773832732da2fc3126a7e0b81b75f9  frontend/scripts/release-code-identity.nodetest.mjs
0998c1f897eeb31a3a83abc308f87459d4cd18f7118a5e2f37d14378817f31ba  frontend/scripts/release-gate-cleanup.nodetest.mjs
ca9114f7b3c2f2918a7543aaa07b5b560356e072a1513f86c97279901ba27c57  frontend/scripts/release-gate-wiring.nodetest.mjs
a34a43da3ff3dd8dbfd1c6a0fa0eaf0bd56bcc3f55c40fc85f87c6d5a8714a8b  frontend/scripts/release-report-outcome.nodetest.mjs
b616686d8919d47e562c7a43fddf6a30273eb7bb1eda52ba9b933b5a3458f54c  frontend/scripts/release-screenshot-policy.nodetest.mjs
9eaa6a27484dcf8ca827c82be48729ecabdc48d7d392686795032bd06701da04  frontend/scripts/run-nodetest-profile.nodetest.mjs
dc65060a32d8afbc7dd8daa8af46b2cd78aa6fd403b05f027879e0410727b2d7  scripts/lib/release-source-identity.mjs
```

Provenance records are also retained byte-for-byte:

```text
ea4a279bbf6574f0f374863110cb33ffcbbcdddcc2ee535fe7680a0a83db1485  .harness/changes/fix-immutable-release-identity-20260723/ci_result/ci_summary.md
5c4fec6358e62086ea7a075ca408c62c69bc3360ae109f120fb709459415b4b7  .harness/changes/fix-immutable-release-identity-20260723/request_analysis/spec.md
d2deb1efec6a8c852839cbd86ffdf3a5e40713f4e23ca4ff104e46913463795e  .harness/changes/fix-immutable-release-identity-20260723/request_analysis/tasks.md
5c65de2ede52bd7a067e0baa4f6e2420788cb100204df26429be14ca3cc247d3  .harness/changes/fix-immutable-release-identity-20260723/summary.md
e14e104f5f6d42354dcff4b66023ed7fa90b81f26a43828bfbccac2fbc09ffd0  frontend/.harness/changes/fix-immutable-release-identity-20260723/ci_result/ci_summary.md
e2a045fa8d54140eaf07120d3b2b0e986206678204f77a22cd993c2621de47c4  frontend/.harness/changes/fix-immutable-release-identity-20260723/coding/coding_report_v1.md
017a23bdf16b7ce76840f03a68639c0d5239b19f8233b418190cc5b87d06388a  frontend/.harness/changes/fix-immutable-release-identity-20260723/coding/review/code_review_v1.md
b87af30208980e8ced00fc13e7fe024f480f98242e23bc3a4be00886d079f9c5  frontend/.harness/changes/fix-immutable-release-identity-20260723/deployment/preview_report.md
e2016c6ae8d47868f2d3afaf08de2da357324fdaae5da34bf442fec4217fa842  frontend/.harness/changes/fix-immutable-release-identity-20260723/e2e_test/e2e_plan.md
9dafb07617ae896abdb2ea92eaf1ab48ffef64c21e6a7ec7be9cdf48bdc3f5a6  frontend/.harness/changes/fix-immutable-release-identity-20260723/e2e_test/e2e_summary.md
d48380448a289161f108211b21eabcce9e541b0ff4ac2fbf9a8d07aec5071c7e  frontend/.harness/changes/fix-immutable-release-identity-20260723/request_analysis/review/spec_review_v1.md
8154ec89ca9783a8dc37d2a7a3ff3f4f061d01f5d7fb17b0f8affc876525c43b  frontend/.harness/changes/fix-immutable-release-identity-20260723/request_analysis/spec.md
e105d4d76a93246f92a395fde44049e757c8988a1aca721dafbdd8d143c3dc06  frontend/.harness/changes/fix-immutable-release-identity-20260723/request_analysis/tasks.md
ceab6ef61f58f9a85e74a18c01e10b3ceb1525c660c1b06ddd93cca273c8e475  frontend/.harness/changes/fix-immutable-release-identity-20260723/summary.md
2972fa831180b467d6009726bba1fbe9da3170ead389b59301e00d78a8a10eab  frontend/.harness/changes/fix-immutable-release-identity-20260723/unit_test/review/test_review_v1.md
675287851fea2f5cab8ff873dd1583f336e7ee2a1b62135c9668ab48282acecc  frontend/.harness/changes/fix-immutable-release-identity-20260723/unit_test/test_plan.md
```

Receiving conditions: rebase the design onto current `prod-doctor.mjs`;
prove source, build, database, and listener identity; add a hard fail-closed
production doctor gate; run lifecycle and identity tests. Deployment, database
migration, and listener `3050` takeover remain out of scope.

### K2: Main UI Runtime Incident

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os` |
| HEAD / tree | `c6f2d64252acf578478405637dba9ac44be161ae` / `49de978e42b4862d842c81803a2af0c6197c5163` |
| Group dirty status | 12 tracked modified files; 9 retained untracked files |
| Retained untracked state | PRESENT, 9 files, each hashed below |
| Group tracked binary diff SHA-256 | `cfd3924329b8382e86642dbb076f4e435cf3b770c1a5965d1797b9784fd2311a` |
| Disposition | KEEP, split transport/auth/runtime evidence by hunk |
| Owner | Window 5 Product Closure |
| Target Packet | `EXT-I1` |

Tracked path manifest:

```text
backend/tests/test_chaotang_closed_loop.py
backend/tests/test_shangshufang_loop_api.py
backend/tests/test_shiguan_unified_read.py
backend/web/routers/chaotang.py
backend/web/routers/shangshufang.py
backend/web/routers/throne.py
frontend/next.config.ts
frontend/src/app/login/page.tsx
frontend/src/components/AuthGate.tsx
frontend/src/lib/api/client.ts
frontend/src/lib/auth.ts
frontend/src/middleware.ts
```

Retained untracked files:

```text
53f2d100cef55e821189792ab2634e49a6c7b9533cddabaaf4913310ad334059  frontend/e2e/shangshufang-real-backend-contract.nodetest.ts
cc42680880bafd12d45562ab67dea30786cd06b98afff2746b6273f1b8e4dc93  frontend/e2e/shangshufang-real-backend.spec.ts
cd99d0d5f83758b5a8f12fc3243f8a2eb4b1e747b0202ab81ad1923710fe2b70  frontend/e2e/shangshufang-runtime-entry.spec.ts
022c6430f4bd4a6a4aabdb8bd7bf12d26f38b27c8d4e773324bb9bfe07ac0005  frontend/next-route-alias.nodetest.ts
1cddb09577d7529b56013cc02e79fbd17792220bef6e7bf66e5f720f3e8de493  frontend/scripts/canonical-browser-runner.nodetest.mjs
a0ddee807a075c6749bba35359155ff9071bff49b5fa40925f70b88f887e946d  frontend/scripts/run-canonical-browser-integration.mjs
a0a94f674f8f0c8da3d98c8d638e923b95ef1c9c701ea03abf9b250e26e4e534  frontend/src/lib/api/client-reports.nodetest.ts
51be320faf118101efc0f4833cbf3baf462d745adc83028b066dfd1700b05a31  frontend/src/lib/protected-api-transport.nodetest.ts
9c7c5bb516d7ea58821ccc57849f77f9664e2638f0868388eccd60232893868c  frontend/src/middleware.nodetest.ts
```

Provenance records are also retained byte-for-byte:

```text
3448fdf7c64d630d5ed1bfcf5c091a3cd653a481ed6222e05663b948e59247d7  .harness/changes/fix-ui-runtime-incident-20260722/ci_result/ci_summary.md
1b49d98730f38142cd27b1d9b426e984d0a0581beeb0c917553c7a4160c48c7d  .harness/changes/fix-ui-runtime-incident-20260722/request_analysis/spec.md
8bd13bc380e3e1221ca509a703ad4866ce310838c3759450706f3985dc28e4d2  .harness/changes/fix-ui-runtime-incident-20260722/request_analysis/tasks.md
6d7922d19552bae037eb78ea15832da032878f99e0722ad670db5621eae8f17f  .harness/changes/fix-ui-runtime-incident-20260722/summary.md
0ff68d20c73cfb200b88564f8b04a1ead371f3513bd62a4d079b05a1967f4889  frontend/.harness/changes/fix-ui-runtime-incident-20260722/ci_result/ci_summary.md
d6f5674d179b4e7d896e0a32556360904a1dd733ba11b85712fb2c5de048ffac  frontend/.harness/changes/fix-ui-runtime-incident-20260722/coding/coding_report_v1.md
44d8f498f15e3c2f79f50c2ca68f2f9ef8251868c04749c3073f354aa541fa1c  frontend/.harness/changes/fix-ui-runtime-incident-20260722/coding/review/code_review_v1.md
3f9596434be8cede201a3ce685adf5f59c13a1798c9e5f2815de3b2e2aa565a8  frontend/.harness/changes/fix-ui-runtime-incident-20260722/deployment/preview_report.md
11e8982d1415c493a1532d2546a0aa90e991119318a888a484466b28fb388d9d  frontend/.harness/changes/fix-ui-runtime-incident-20260722/e2e_test/e2e_plan.md
9b49b8ebf1fc191bcf6c2a1675542532b2ca72fccc558e6f7fdfc69cba542281  frontend/.harness/changes/fix-ui-runtime-incident-20260722/e2e_test/e2e_summary.md
cfd9916079b306ae562b5b1a0d919c9f5021c8bead79e208a0ff498655e6d1e6  frontend/.harness/changes/fix-ui-runtime-incident-20260722/request_analysis/review/spec_review_v1.md
e04cd28636ca959685f6313269af07220c3f16319994db7c990e689abc939fdb  frontend/.harness/changes/fix-ui-runtime-incident-20260722/request_analysis/spec.md
3afc31414d461c216e2bf7cc2c9857e0bb43928773dac3cd00f907e3ddeb8d56  frontend/.harness/changes/fix-ui-runtime-incident-20260722/request_analysis/tasks.md
c95713753094a7dddf07a97f1a67954ff0e2c27086d3e78fe0967a310488b6f0  frontend/.harness/changes/fix-ui-runtime-incident-20260722/summary.md
6b95fd4f1452cd2247bd7595b34feb4a39303b104b0a6451bd284a3f1375d637  frontend/.harness/changes/fix-ui-runtime-incident-20260722/unit_test/review/test_review_v1.md
35bf1f0e14e46930bc18fd87cf0787cb4fd4839df0f726cba30e95e2cc3da6ae  frontend/.harness/changes/fix-ui-runtime-incident-20260722/unit_test/test_plan.md
```

Receiving conditions: preserve canonical `/shangshufang` and `/shiguan`
routes, prove protected transport and auth against a real backend, and record
human browser confirmation. Acceptance proves only that the accepted workspace
is runnable. It must retain `NOT_DEPLOYED`, DB 016 uncertainty, and external
listener `3050`.

### K3: Task8 Exact Memorial Binding

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os/.worktrees/r0-task8-on-feature-20260725` |
| Source branch | `integration/r0-task8-on-feature-20260725` |
| HEAD | `0ead253f12e8520036d5dd7acdd9db6e057b068e` |
| Tree | `7ee0612f4c073b7bbda507a4f4a6fa79d65437b8` |
| Merge base with accepted EXT | `8feae838f09ad5202b21332d4280b989ab776bd7` |
| Committed range binary diff SHA-256 | `598b84e02c44d8b4549f8f1852b1b2ec0b361e72e3ccdf8cb323066879762caa` |
| Dirty status | 3 tracked files, +78/-1 |
| Dirty binary diff SHA-256 | `538866d5ee597e4054dd1561753d9672c95e6aafe7abfd79b24cb907b249cec3` |
| Untracked retained files | None |
| Disposition | KEEP, extract exact contract and readback hunks |
| Owner | Window 5 Product Closure |
| Target Packet | `EXT-P1` |

Dirty path manifest:

```text
frontend/src/features/shangshufang/types.ts
frontend/src/lib/contracts/shangshufang.ts
frontend/src/lib/jiqun-api.ts
```

The committed candidate spans the formal memorial rendering, Shiguan readback,
canonical real-backend E2E, and its existing change records. Receiving
conditions: establish a typed backend contract for `formalMemorialId`,
`contentHash`, `version`, current/ready state, and expected final memorial
content hash; prove backend lineage through browser readback. Do not merge the
source commit as a unit.

### K4: P26 Schema Authority

| Field | Value |
| --- | --- |
| Source ref | `governance/r0-w06-p26-integration-20260725` |
| Registered source path | `/tmp/chaotang-w06-postmerge-8feae838` (prunable registration; path absent) |
| HEAD | `3d0d6623dfbcc8d94e7c7284618933ff87d09c4f` |
| Tree | `0cadebe9e3c49c8c56461548c3e73a4819983143` |
| Merge base with accepted EXT | `8feae838f09ad5202b21332d4280b989ab776bd7` |
| Range binary diff SHA-256 | `64d8ae45ab20fc55488320f08355f3aefc9340b840788ff85186cb753281053f` |
| Worktree dirty status | Not applicable; source is commit/ref only |
| Disposition | KEEP as a test/evidence donor |
| Owner | Window 2 W06 Backend |
| Target Packet | `EXT-W06R` |

Receiving conditions: reproduce `backend/tests/test_schema_authority.py`
against current EXT and Alembic artifact head, validate migration ordering, and
independently review the new Packet. The four historical commits are not a
cherry-pick set.

## REBUILD

### R1: Main Human Confirmation and Reports

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os` |
| HEAD / tree | `c6f2d64252acf578478405637dba9ac44be161ae` / `49de978e42b4862d842c81803a2af0c6197c5163` |
| Group dirty status | 10 tracked modified files; 11 retained untracked files |
| Retained untracked state | PRESENT, 11 files, each hashed below |
| Group tracked binary diff SHA-256 | `d01359e258108db164e6b290873c52e48c7444488905247c00bfe503be6a0704` |
| Disposition | REBUILD against typed read model |
| Owner | Window 5 Product Closure |
| Target Packet | `EXT-P2` |

Tracked path manifest:

```text
frontend/src/app/(dashboard)/junjichu/page.tsx
frontend/src/core/courtos/harness/human-approval-gate.nodetest.ts
frontend/src/core/courtos/harness/human-approval-gate.ts
frontend/src/features/command-center/BattleStream.tsx
frontend/src/features/command-center/hooks/use-command-center-data.ts
frontend/src/features/command-center/views/CasesView.tsx
frontend/src/features/reports/components/export-dock.tsx
frontend/src/features/reports/components/report-hero.tsx
frontend/src/features/reports/lib/local-report-cache.ts
frontend/src/features/shangshufang/ShangshufangPage.tsx
```

Retained untracked files:

```text
e15f8d09e1e651788664edc77fa049c475e0cdeee63fca4d207b38ba421b752e  frontend/src/app/(dashboard)/reports/[id]/page.tsx
a3ccf5446b80ba9da3e7e1c28ae26288ab13b50c85c8dce4d3f785a69fdc8653  frontend/src/app/(dashboard)/reports/page.tsx
7bd5b33242d40a3070af3f477ccbe75155141152b04c62acea05a1905e792402  frontend/src/features/command-center/junjichu/human-confirmation-wiring.nodetest.ts
49e9769fd3731aded1d7660e9a982ec52cd06c2f514ff116e15892b4d056e57f  frontend/src/features/reports/components/export-dock.nodetest.tsx
5c273c42a7ccb43b227e41c98314fc0c819f6eb4abb3e4b71ade07a89eb003a7  frontend/src/features/reports/lib/local-report-cache.nodetest.ts
d5a2a828dd8d4cf64071787581de286e6be8948b0d8f039d995a5294c3ac821b  frontend/src/features/reports/lib/report-detail-loader.nodetest.ts
eb5ed2360d3f7edcd686489e94365c1f93a216f94c34d9b8d11afd2012a1df01  frontend/src/features/reports/lib/report-detail-loader.ts
a63e642d156647f531b36d641df42bd858abf2bea51fe23fd2842e5e4d836edc  frontend/src/features/shangshufang/shangshufang-report-builder.nodetest.ts
a0a94f674f8f0c8da3d98c8d638e923b95ef1c9c701ea03abf9b250e26e4e534  frontend/src/lib/api/client-reports.nodetest.ts
b0221ab0f2f822c6328779c365b732b0e5299f97002f7e6c89c08a3627d6e9c8  frontend/src/lib/human-confirmation.nodetest.ts
a1b585621f8847e4164b002d12b2d4d6337e6df261a0002fd3dc951e35ef6aef  frontend/src/lib/human-confirmation.ts
```

Receiving conditions: no new Agent and no new product route; use only
`/shangshufang` and `/shiguan`; bind confirmation and report download/reopen
to the ContractReviewPack read model. `ShangshufangPage.tsx` is a protected
hunk-level integration file.

### R2: Browser Route Repair

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os/.worktrees/r0-a-playwright-routes-20260725` |
| Source branch | `fix/r0-a-playwright-routes-20260725` |
| HEAD | `7216dbc29a4a4ae52374423029d056abb1af2958` |
| Tree | `a9bb9596e756052a80a0de83e231e3efb5e698ee` |
| Dirty status | 2 tracked files, +66/-66 |
| Dirty binary diff SHA-256 | `b798903819825c6de28af60eef0d6cdc6149304ae86ee1ab70b16bbb4e928195` |
| Untracked retained files | None |
| Disposition | REBUILD selectors and routes on accepted UI |
| Owner | Window 5 Product Closure |
| Target Packet | `EXT-P2` |
| Independent QA gate | Window 6 read-only verification under later `EXT-Q1` |

Dirty paths:

```text
frontend/e2e/shangshufang-ux.spec.ts
frontend/e2e/shangshufang-verdict-bar.spec.ts
```

Receiving conditions: selectors must reflect the accepted canonical UI, tests
must exercise a real backend, and route changes must not create a new product
page. `EXT-Q1` is not a second implementation target; it is the subsequent
independent QA verification gate.

### R3: Anti-Hallucination Evidence Gate

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/chaotang-os/.worktrees/r0-anti-hallucination-01-20260720` |
| Source branch | `task/r0-anti-hallucination-01-20260720` |
| HEAD | `9ed6416d78d4e3c88d4ca9f292d6574af275b9e1` |
| Tree | `4a9abc226c71bd7f267737fb3e6605fdd1a8de29` |
| Merge base with accepted EXT | `f5f7fcef1f45b3b7d271fef2b13eed193ab9ef84` |
| Range binary diff SHA-256 | `f7036f7808f033dcee35dbdad2f997ba3f823015d82d93545434777cf742bff5` |
| Source status | CLEAN: tracked changes = 0; untracked files = 0 |
| Retained untracked state | NONE, 0 files |
| Dirty diff SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Disposition | REBUILD tests and contract; no source absorption |
| Owner | Window 5 Product Closure |
| Target Packet | `EXT-P1` |

Candidate idea: durable claim/evidence binding and numeric validation before
formalization. Receiving conditions: define EvidencePacket and RiskItem
invariants first, write failing current-EXT tests, and reject unsupported
claims without importing historical persistence or swarm wiring wholesale.

### R4: Court Writer AST Scanner

| Field | Value |
| --- | --- |
| Source ref | `wip/canon-court-01a-red-20260719` |
| Source worktree | None registered; immutable commit object only |
| HEAD | `c18f9beb2d66583162bd77804f33ffff8fce0200` |
| Tree | `67d31e97792f2e6fa875371325daa5e2a35be29b` |
| Merge base with accepted EXT | `4b0deee3335f874f98bd83b5b62e67452aed064b` |
| Range binary diff SHA-256 | `d3f6c80f441a2ca490f712065059bb72ff56a489f1736ef3fd71ed99b28e6eeb` |
| Dirty status | Not applicable |
| Disposition | REBUILD scanner only |
| Implementation owner | Window 5 Product Closure |
| Target Packet | `EXT-Q1` |
| Independent reviewer | Window 6 QA Auditor, read-only |

Candidate idea: AST-based writer inventory and lineage contract checks.
Window 5 implements a new read-only scanner against current EXT. Window 6 only
reviews its output and evidence. Receiving conditions: prove no false authority
source and keep historical inventory documents out of the runtime.

## ARCHIVE

### A1: Old P6 Orphan Retirement

| Field | Value |
| --- | --- |
| Source worktree | `/home/ubuntu/Projects/.fullcourt-worktrees/p6-orphan-retirement` |
| Branch | `task/p6-orphan-retirement` |
| HEAD | `bbb100004845331b314e5196e645125f25199a5f` |
| Tree | `79043ddd439ade40f88f0ef41d68fbf66833f61e` |
| Status | 31 entries: 21 tracked changes/renames, 10 untracked files |
| Dirty binary diff SHA-256 | `c34476fc93bc1e8b5ee5eab563454e3faf41cb45b6ad03d4cb421463c7656ff5` |
| Disposition | ARCHIVE; previously absorbed/superseded |
| Target | `GOVERNANCE_ARCHIVE` |

No P6 file is retained as an implementation input. Its untracked files are
therefore not promoted into the retained-file hash manifest. Preserve the
worktree until a separate retirement review confirms replacement coverage.

### A2: Superseded W06 Histories

The following refs are archive-only. P26 is excluded from this archive group
and captured as K4.

| Ref | HEAD | Tree |
| --- | --- | --- |
| `governance/r0-w06-artifacts-20260724` | `1e444af4ad237ec524d45c7382d6d17bab82841e` | `0e8afcf2b918b9b76e1dbbbea18a5eabd24bbd69` |
| `governance/r0-w06-authority-recovery-8feae838` | `fa70efcd8413ca498ff4a62c38a09b1b84be46e2` | `71007e7ccf246125879a2fe9875fd789bf23dbe1` |
| `governance/r0-w06-codex-20260724` | `d0d2222b68230f76b8fb1c702d4d0404b44467de` | `49d6b52265d246ec2a6059c67fa7be63bbe4a5fc` |
| `governance/r0-w06-codex-65330d7f` | `200b8bb019f83f0c6457d3674dc371779295a123` | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| `governance/r0-w06-codex-8feae838` | `3573e66cd43bbfff92dcea87dee3fbd47d57c243` | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| `governance/r0-w06-gate-c-design-fa70efcd` | `88c92c048412537d333be259a764f750ed006a6c` | `a6aa62e31df6fe3f0aec97fa29157363cfa43035` |
| `governance/r0-w06-merge-20260725` | `51c960634bbde9ad88221a9e105ee94809bd00b3` | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| `governance/r0-w06-merge-8feae838` | `90c6704a1b73c26f05214a9d3f14b6df637f328a` | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |

### A3: Superseded P16-P19 Worktrees

All entries are archive-only, including dirty review worktrees. Dirty counts
are status-entry counts at snapshot time.

| Worktree suffix | HEAD | Tree | Dirty |
| --- | --- | --- | ---: |
| `p16-menxia-veto-enforcement` | `0269869bfd42d4a21e7dda32314863701b92e996` | `c8527e9c482042edfeeabbf223f3400486b2ee68` | 2 |
| `p16-menxia-veto-review` | `aba4fcf5e5372ad067bcad4c8e8311088e6b8757` | `70ce722a7db560bc9aa7750b6cdb7d8005afb511` | 1 |
| `p16-menxia-veto-review-v2` | `b576b3cbe86f68ffe9cef3909bdeab74bbeadacc` | `b3580e88cd5f066373679de1de7cb7c7d870d92f` | 1 |
| `p16-menxia-veto-v2` | `885b3ab16e5fe15be77843cef9aa16b042e42178` | `8c4631b86f2bb09fcf6ed350e1cb557091978274` | 1 |
| `p17-gongbu-battery-review` | `6c69a6b89f3ce7887c73cae1758867b73cb175f8` | `6e072103ecadd4512b4a509081948724814624bc` | 2 |
| `p17-gongbu-battery-safety` | `057ddd2051d9da97e4d5ce6ddc0454cad27df148` | `0788a3fd15304db10b4ae6c6a1afce5b6911ffe1` | 1 |
| `p18-gongbu-component-review` | `a4b558b33f7dde545e87b496c2af9ca408bfd844` | `8863be0f39035643f2b93ff731efadf324897ead` | 2 |
| `p18-gongbu-component-review-v5` | `9bbee594252f5c4a256ea352078ff090f0767077` | `918338c488134f12fdcfdef42c9cb2ea13f03d89` | 1 |
| `p18-gongbu-component-scope` | `e8dcadadbfd33301810b256d09e4cf84bc263001` | `a8d062e45b9ed9a50dc4dff91254167d75ca2076` | 4 |
| `p18-gongbu-component-scope-replay` | `19594a84b6ab85931c970fff1962e9325cb2a21b` | `3a3dd5edf7aeadb0a0c60b3da364f60d756fa210` | 2 |
| `p18-gongbu-component-scope-review-v8` | `c271255790d12b47fe1c698bcb96b1248dea42f7` | `362fe8a075f0a6b68899f63ccac4e211b629c143` | 1 |
| `p18-gongbu-component-scope-v4-latest` | `870d10a79c21b8ea9245c4df306faa98936b4fec` | `87157b19963913e2d914b55ad20523333a833488` | 2 |
| `p18-gongbu-component-scope-v4-rebased` | `9f4a8030904ef35e7d35b589351947e749dbe162` | `30544d583ec9c8ba829d8d15674159d49cfb5c14` | 1 |
| `p19-ext-nogo-cleanup` | `0e73327caceabc1241331db0ac492a2631157a45` | `e79b9638236ec22a7f6fccf878d3402f3c969e6e` | 0 |
| `p19-ext-nogo-cleanup-candidate` | `4c30ca54952119ceba904f7d7ccfcc9f8e233a1a` | `e79b9638236ec22a7f6fccf878d3402f3c969e6e` | 0 |

### A4: Temporary and Generated Evidence

| Source path | Files / bytes | Content identity | Disposition |
| --- | --- | --- | --- |
| `/home/ubuntu/Projects/chaotang-os/output/` | 14 files / 409,932 bytes | sorted file-hash manifest SHA-256 `2af27d0b3a157eff6c37d08829c813761e710c790fb438e21e36625b1b2ae0d9` | ARCHIVE |
| `/home/ubuntu/Projects/chaotang-os/shangshufang-live.png` | 7,087,142 bytes | SHA-256 `45406865faf0798202154c9e24de92ea80e55ad3c6fea38f040b7458acbd354a` | ARCHIVE |
| `/home/ubuntu/Projects/chaotang-os/backend/knowledge/docs/ima_archived/` | 11 files / 187 bytes | sorted file-hash manifest SHA-256 `e505d49c345b990ae0904a8dd18831b479ca1a10e4868c0340bdfb13aa33c295` | ARCHIVE |
| `/home/ubuntu/Projects/chaotang-os/backend/knowledge/docs/ima_uploads/` | 2 files / 164 bytes | sorted file-hash manifest SHA-256 `11173cb1ac0bad3476885d16c6c1d84787b9966e5fbe13bb5c04e50412d0a3be` | ARCHIVE |

These artifacts are not browser acceptance, deployment evidence, or product
data. They are preserved only for provenance until a retirement decision.

## Global Preservation and Integration Rule

No source listed above may be merged, cherry-picked in bulk, copied wholesale,
deleted, pruned, or advertised as integrated. The only valid flow is:

`Asset -> Packet -> isolated EXT worktree -> test -> independent QA review -> Codex acceptance -> hunk-level EXT integration`

One file has one active writer at a time. Window 0 resolves ownership conflicts
before work resumes. In particular:

- Window 5 is the sole active writer for
  `frontend/src/features/shangshufang/ShangshufangPage.tsx`.
- Window 4 is the sole active writer for `frontend/scripts/prod-doctor.mjs`.
- Both files require hunk-level integration and must never be overwritten from
  an Asset Pool worktree.
- Window 6 remains read-only and may reject evidence but may not implement a
  correction.
