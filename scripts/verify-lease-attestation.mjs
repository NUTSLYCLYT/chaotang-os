#!/usr/bin/env node
import { verifyLeaseAttestation } from './lib/lease-attestation.mjs';
const args=Object.fromEntries(process.argv.slice(2).flatMap((v,i,a)=>v.startsWith('--')?[[v.slice(2),a[i+1]]]:[]));try{console.log(JSON.stringify(verifyLeaseAttestation({commit:args.commit??'HEAD'}),null,2));}catch(error){console.error(`ATTESTATION STOP: ${error.message}`);process.exitCode=1;}
