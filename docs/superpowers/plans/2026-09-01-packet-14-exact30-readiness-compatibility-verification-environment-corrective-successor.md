# P14 Exact30 Readiness Compatibility Verification Environment Corrective Successor Plan

## Objective

保持 exact2 字节完全不变，只修复前序 packet 未闭合的 pytest 临时目录环境合同；在最新 ext-dev 上重新签发、重新物化、重新验证并普通 fast-forward 落地。

## Frozen Boundary

- Base: `74200072908fd590617d0723d639490d79431f95 / 69138e8f047ff06e27e712e4ec1931a6d2bc95ee`。
- Rejected local child: `b8fe3e13630005db11eb638fbbda30d4417e5ea1 / 132cb2de28a34d9ba2bcc0bfcf38ec07be55a029`，`NO_PUSH / BYTE_DONOR_ONLY`。
- Candidate paths: `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- Byte identity: bundle `sha256:fd7dc8d7afdec2c99df166cd2cdcb231a0ea72b9bcc65b090845880fd7a5be2c`; full-index diff `sha256:58b17810b439e5c5f06be297024d96b7974ed6f912c8e75b4d466680186bad3e`。
- Pair: runtime `sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e` + successor `sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5`。

## Environment Contract

- 当前宿主默认 `TEMP/TMP` 指向 Windows `9p` 临时目录；不得作为 pytest capture 或临时 Git mode 语义的事实源。
- focused、backend-full、Harness Doctor tests、product-authority regression 与其他临时仓敏感验证均仅在子进程设置 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`。
- `/tmp` 必须通过 `/usr/bin/findmnt` 机械确认为 `ext4`，并能创建、写入、读取、截断、chmod 与删除临时文件；预检必须关闭 `mkstemp` 返回的文件描述符。
- backend-full 外层超时为 900000ms，避免把已观察到的慢速全量回归误判为产品失败。
- 不持久修改任何系统、用户、仓库或工具配置。

## Verification Matrix

- approval/candidate 双层直接单亲 lineage、live remote parent 与固定 SSH transport。
- exact `3A + 2M / 100644` paths，committed-tree raw/blob/bytes/bundle/full-index patch。
- old9+new10、Python/Node predicate、四 exclusions、69/65、review identity 和 successor paths。
- readiness focused、backend-full、Ruff、Harness/self-test、Doctor/tests、hook、authority regression、V2 与 diff check。
- Governance、Python 与 Security 独立只读三审；任何 P0–P2 为 NO-GO。

## Stop Conditions

Remote drift、第三路径、byte drift、环境仍指向 Windows temp、验证失败、reviewer P0–P2、需扩大产品范围或任何部署请求，立即停止本 successor。

## Forward Reissue

exact2 落地后，基于最新 ext-dev 创建新的 P14 exact30 Product Successor。旧 exact30 和本次 rejected exact2 child 均无 candidate、验证或通过继承身份；下一 exact30 必须同时修复 CDP/edge observation promise cleanup P1 并重新执行完整 Gate A/B。
