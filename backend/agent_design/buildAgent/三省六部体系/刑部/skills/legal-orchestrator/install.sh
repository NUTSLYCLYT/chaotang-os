#!/bin/bash
# Legal Swarm installer — copy 6 legal-* skills into ~/.hermes/skills/
set -e
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${HERMES_HOME:-$HOME/.hermes}/skills"
mkdir -p "$DST"
for s in legal-orchestrator legal-offense legal-defense legal-judge legal-prosecutor legal-compliance; do
  if [ -d "$SRC/$s" ]; then
    cp -r "$SRC/$s" "$DST/"
    echo "✓ installed $s"
  else
    echo "✗ missing $s in $SRC — aborting" && exit 1
  fi
done
echo ""
echo "Done. Verify with:  hermes skills list | grep legal"
