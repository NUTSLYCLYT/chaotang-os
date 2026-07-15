#!/usr/bin/env bash
# Stop hook: 每轮结束前跑一次 harness 检查,防止结构性改动悄悄破坏 harness
# 却没人发现(参见 docs/failures/2026-07-14-harness-false-green.md)。
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node scripts/check_harness.mjs
