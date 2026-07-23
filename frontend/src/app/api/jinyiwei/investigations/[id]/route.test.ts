import assert from "node:assert/strict";
import test from "node:test";
import { createDetailHandler } from "./route.ts";

test("detail BFF accepts an injected read client",async()=>{
  const handler=createDetailHandler(async()=>({ok:false,kind:"not_found",error:"injected"}));
  assert.equal((await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})})).status,404);
});

test("detail BFF rejects decoded blank, overlong, malformed and query IDs before backend",async()=>{
  let calls=0;const handler=createDetailHandler(async()=>{calls+=1;return {ok:false,kind:"not_found",error:"unused"};});
  for(const [id,url] of [["%20","http://local/api/jinyiwei/investigations/%20"],["x".repeat(129),"http://local/api/jinyiwei/investigations/x"],["%E0%A4%A","http://local/api/jinyiwei/investigations/x"],["ok","http://local/api/jinyiwei/investigations/ok?x=1"]]){const response=await handler(new Request(url),{params:Promise.resolve({id})});assert.equal(response.status,400);}
  assert.equal(calls,0);
});

test("detail BFF not-found message contains no backend configuration",async()=>{
  const handler=createDetailHandler(async()=>({ok:false,kind:"network",error:"http://127.0.0.1/private"}));
  const response=await handler(new Request("http://local/api/jinyiwei/investigations/a"),{params:Promise.resolve({id:"a"})});
  assert.equal(response.status,503);assert.equal((await response.text()).includes("private"),false);
});
