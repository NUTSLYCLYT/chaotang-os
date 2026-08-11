import assert from "node:assert/strict";
import test from "node:test";

import { createListHandler } from "./route.ts";

test("list BFF rejects unknown, repeated, blank and noncanonical values before backend",async()=>{
  let calls=0;
  const handler=createListHandler(async()=>{calls+=1;return {ok:true,data:{items:[],total:0,limit:20,offset:0}};},()=>"opaque-session");
  for(const query of ["x=1","status=","status=RESOLVED&status=PARTIAL","limit=01","limit=1e2","limit=1.5","limit=-1","limit=101","offset=-1","offset=+1"]){
    const response=await handler(new Request(`http://local/api/jinyiwei/investigations?${query}`));
    assert.equal(response.status,400,query);
  }
  assert.equal(calls,0);
});

test("list BFF forwards canonical query and wraps injected page",async()=>{
  let seen:unknown;
  const handler=createListHandler(async(options)=>{
    seen=options;
    return {ok:true,data:{items:[],total:0,limit:10,offset:20}};
  },()=>"opaque-session");
  const response=await handler(new Request("http://local/api/jinyiwei/investigations?status=PARTIAL&limit=10&offset=20"));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:"ok",page:{items:[],total:0,limit:10,offset:20}});
  assert.deepEqual(seen,{status:"PARTIAL",limit:10,offset:20,sessionId:"opaque-session"});
});

test("list BFF returns a stable 401 before calling the reader without a session",async()=>{
  let calls=0;
  const handler=createListHandler(async()=>{calls+=1;return {ok:true,data:{items:[],total:0,limit:20,offset:0}};},()=>null);
  const response=await handler(new Request("http://local/api/jinyiwei/investigations"));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("list BFF default session reader decodes the real request cookie",async()=>{
  let seen:unknown;
  const handler=createListHandler(async(options)=>{seen=options;return {ok:true,data:{items:[],total:0,limit:10,offset:20}};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations?status=PARTIAL&limit=10&offset=20",{headers:{cookie:"courtos_session=opaque%2Dsession"}}));
  assert.equal(response.status,200);
  assert.deepEqual(seen,{status:"PARTIAL",limit:10,offset:20,sessionId:"opaque-session"});
});

test("list BFF default session reader rejects a request without a cookie",async()=>{
  let calls=0;
  const handler=createListHandler(async()=>{calls+=1;return {ok:true,data:{items:[],total:0,limit:20,offset:0}};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations"));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("list BFF default session reader rejects a decoded blank cookie before the reader",async()=>{
  let calls=0;
  const handler=createListHandler(async()=>{calls+=1;return {ok:true,data:{items:[],total:0,limit:20,offset:0}};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations",{headers:{cookie:"courtos_session=%20"}}));
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("list BFF maps and sanitizes injected failures",async()=>{
  const handler=createListHandler(async()=>({ok:false,kind:"storage",error:"private database path"}),()=>"opaque-session");
  const response=await handler(new Request("http://local/api/jinyiwei/investigations"));
  assert.equal(response.status,503);
  assert.equal((await response.text()).includes("private database path"),false);
});
