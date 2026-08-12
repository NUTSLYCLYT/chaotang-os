import assert from "node:assert/strict";
import test from "node:test";

import { createSummaryHandler } from "./handler.ts";

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
  const handler=createSummaryHandler(async(options)=>{
    assert.deepEqual(options,{sessionId:"opaque-session"});
    return {ok:true,data:EMPTY_SUMMARY};
  },()=>"opaque-session");
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:"ok",summary:EMPTY_SUMMARY});
});

test("summary BFF returns a stable 401 before calling the reader without a session", async () => {
  let calls=0;
  const handler=createSummaryHandler(async()=>{calls+=1;return {ok:true,data:EMPTY_SUMMARY};},()=>null);
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("summary BFF default session reader decodes the real request cookie", async () => {
  let seen: unknown;
  const handler=createSummaryHandler(async(options)=>{seen=options;return {ok:true,data:EMPTY_SUMMARY};});
  const response=await handler(new Request("http://local/api/jinyiwei/summary",{headers:{cookie:"courtos_session=opaque%2Dsession"}}));
  assert.equal(response.status,200);
  assert.deepEqual(seen,{sessionId:"opaque-session"});
});

test("summary BFF default session reader rejects a request without a cookie", async () => {
  let calls=0;
  const handler=createSummaryHandler(async()=>{calls+=1;return {ok:true,data:EMPTY_SUMMARY};});
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("summary BFF default session reader rejects a decoded blank cookie before the reader", async () => {
  let calls=0;
  const handler=createSummaryHandler(async()=>{calls+=1;return {ok:true,data:EMPTY_SUMMARY};});
  const response=await handler(new Request("http://local/api/jinyiwei/summary",{headers:{cookie:"courtos_session=%20"}}));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("summary rejects query before the read client",async()=>{
  let calls=0;
  const handler=createSummaryHandler(async()=>{calls+=1;return {ok:true,data:EMPTY_SUMMARY};},()=>"opaque-session");
  assert.equal((await handler(new Request("http://local/api/jinyiwei/summary?secret=1"))).status,400);
  assert.equal(calls,0);
});

test("summary sanitizes injected backend failure",async()=>{
  const handler=createSummaryHandler(async()=>({ok:false,kind:"network",error:"http://private"}),()=>"opaque-session");
  const response=await handler(new Request("http://local/api/jinyiwei/summary"));
  assert.equal(response.status,503);
  assert.equal((await response.text()).includes("private"),false);
});
