#!/usr/bin/env node
const entry=process.argv[2]??'production entry';
console.error(`STOP: legacy ${entry} is disabled. Production build/start/restart requires scripts/release-commander.mjs, a signed attestation, and release:production fencing.`);
process.exit(64);
