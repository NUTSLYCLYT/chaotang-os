import assert from "node:assert/strict";
import test from "node:test";

import { createSummaryHandler } from "./route.ts";

const EMPTY_SUMMARY = {
  totalInvestigations: 0,
  resolvedCount: 0,
  partialCount: 0,
  blockedCount: 0,
  unavailableCount: 0,
  distinctEvidenceCount: 0,
  pendingAdoptionCount: 0,
  confirmedAdoptionCount: 0,
};

test("summary BFF returns the injected camelCase envelope", async () => {
  const handler=createSummaryHandler(async()=>({ok:true,data:EMPTY_SUMMARY}));
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:"ok",summary:EMPTY_SUMMARY});
});

test("summary rejects query before the read client",async()=>{
  let calls=0;
  const handler=createSummaryHandler(async()=>{calls+=1;return {ok:true,data:EMPTY_SUMMARY};});
  assert.equal((await handler(new Request("http://local/api/jinyiwei/summary?secret=1"))).status,400);
  assert.equal(calls,0);
});

test("summary sanitizes injected backend failure",async()=>{
  const handler=createSummaryHandler(async()=>({ok:false,kind:"network",error:"http://private"}));
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,503);
  assert.equal((await response.text()).includes("private"),false);
});
