import assert from "node:assert/strict";
import test from "node:test";
import { getJinyiweiInvestigation } from "../../../../../lib/backendClient.ts";
import { createDetailHandler } from "./handler.ts";

test("detail BFF accepts an injected read client",async()=>{
  let seen:unknown;
  const handler=createDetailHandler(async(id,options)=>{seen={id,options};return {ok:false,kind:"not_found",error:"injected"};},()=>"opaque-session");
  assert.equal((await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})})).status,404);
  assert.deepEqual(seen,{id:"a",options:{sessionId:"opaque-session"}});
});

test("detail BFF preserves an owner-scoped backend 404 as a fixed opaque 404",async()=>{
  const handler=createDetailHandler(
    (id,options)=>getJinyiweiInvestigation(id,{
      ...options,
      baseUrl:"https://backend.invalid",
      fetchImpl:async()=>new Response(JSON.stringify({detail:"must not leak"}),{status:404}),
      scheduleTimeout:()=>"owner-404-timeout",
      cancelTimeout:(handle)=>assert.equal(handle,"owner-404-timeout"),
    }),
    ()=>"owner-b-session",
  );
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/owner-a-case"),{params:Promise.resolve({id:"owner-a-case"})});
  assert.equal(response.status,404);
  const body=await response.json();
  assert.deepEqual(body,{status:"error",reason:"not_found",message:"调查案卷不存在。"});
  assert.equal(JSON.stringify(body).includes("must not leak"),false);
});

test("detail BFF returns a stable 401 before calling the reader without a session",async()=>{
  let calls=0;
  const handler=createDetailHandler(async()=>{calls+=1;return {ok:false,kind:"not_found",error:"unused"};},()=>null);
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})});
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("detail BFF default session reader decodes the real request cookie",async()=>{
  let seen:unknown;
  const handler=createDetailHandler(async(id,options)=>{seen={id,options};return {ok:false,kind:"not_found",error:"injected"};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/case%2Done",{headers:{cookie:"courtos_session=opaque%2Dsession"}}),{params:Promise.resolve({id:"case%2Done"})});
  assert.equal(response.status,404);
  assert.deepEqual(seen,{id:"case-one",options:{sessionId:"opaque-session"}});
});

test("detail BFF default session reader rejects a request without a cookie",async()=>{
  let calls=0;
  const handler=createDetailHandler(async()=>{calls+=1;return {ok:false,kind:"not_found",error:"unused"};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})});
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("detail BFF default session reader rejects a decoded blank cookie before the reader",async()=>{
  let calls=0;
  const handler=createDetailHandler(async()=>{calls+=1;return {ok:false,kind:"not_found",error:"unused"};});
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/a",{headers:{cookie:"courtos_session=%20"}}),{params:Promise.resolve({id:"a"})});
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{status:"error",reason:"unauthenticated",message:"authentication required"});
  assert.equal(calls,0);
});

test("detail BFF rejects decoded blank, overlong, malformed and query IDs before backend",async()=>{
  let calls=0;const handler=createDetailHandler(async()=>{calls+=1;return {ok:false,kind:"not_found",error:"unused"};},()=>"opaque-session");
  for(const [id,url] of [["%20","http://local/api/jinyiwei/investigations/%20"],["x".repeat(129),"http://local/api/jinyiwei/investigations/x"],["%E0%A4%A","http://local/api/jinyiwei/investigations/x"],["ok","http://local/api/jinyiwei/investigations/ok?x=1"]]){const response=await handler(new Request(url),{params:Promise.resolve({id})});assert.equal(response.status,400);}
  assert.equal(calls,0);
});

test("detail BFF not-found message contains no backend configuration",async()=>{
  const handler=createDetailHandler(async()=>({ok:false,kind:"network",error:"http://127.0.0.1/private"}),()=>"opaque-session");
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})});
  assert.equal(response.status,503);assert.equal((await response.text()).includes("private"),false);
});
