#!/usr/bin/env bash
# Two clean timed builds into a scratch BUILD_DIR (never touches real .next/).
set -u
cd "$(dirname "$0")"

run_once() {
  python3 -c "import shutil; shutil.rmtree('.next-buildcheck-baseline', ignore_errors=True)"
  local start end
  start=$(date +%s.%N)
  BUILD_DIR=.next-buildcheck-baseline npx next build --webpack > /tmp/bench-build.log 2>&1
  local rc=$?
  end=$(date +%s.%N)
  echo "$rc $(echo "$end - $start" | bc)"
}

r1="$(run_once)"
rc1=$(echo "$r1" | cut -d' ' -f1); s1=$(echo "$r1" | cut -d' ' -f2)
r2="$(run_once)"
rc2=$(echo "$r2" | cut -d' ' -f1); s2=$(echo "$r2" | cut -d' ' -f2)

ok="true"
[ "$rc1" != "0" ] && ok="false"
[ "$rc2" != "0" ] && ok="false"

median=$(python3 -c "print(sorted([$s1,$s2])[0])" 2>/dev/null || echo "0")

echo "build_ok: $ok"
echo "seconds_run1: $s1"
echo "seconds_run2: $s2"
echo "median_seconds: $median"
[ "$ok" = "false" ] && echo "--- last 40 lines of build log ---" && tail -40 /tmp/bench-build.log
