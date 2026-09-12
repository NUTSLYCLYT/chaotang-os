import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// Execute the actual component handlers with deterministic hook state. Browser
// acceptance separately verifies DOM events and the real BFF/backend chain.
const require = createRequire(import.meta.url);
function harness() {
  const state: unknown[] = []; let cursor = 0;
  const loaded = { exports: {} as { ShiguanOutcomePanel: (p: Record<string, unknown>) => Element } };
  const source = readFileSync(new URL("./ShiguanOutcomePanel.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if(id === "react") return {useState: (initial: unknown) => {const i=cursor++; if(!(i in state)) state[i]=initial; return [state[i], (v: unknown)=>{state[i]=v;}];}};
    if(id.includes("formatBusinessTime")) return {formatBusinessTime:(v:string)=>v};
    if(id.endsWith(".css")) return {default:{}};
    return require(id);
  }, loaded, loaded.exports);
  return (props: Record<string, unknown>) => {cursor=0;return loaded.exports.ShiguanOutcomePanel(props);};
}
interface Element {type: unknown;props: {children?: unknown;disabled?: boolean;onSubmit?: (e: {preventDefault():void})=>void;onChange?: (e:{target:{value:string}})=>void;onClick?: ()=>void;[key:string]:unknown}}
interface Draft {outcome:string;occurredAt:string;idempotencyKey:string;supersedesEventId?:string}
function all(node: unknown): Element[] {if(!node || typeof node!=="object")return [];if(Array.isArray(node))return node.flatMap(all);const el=node as Element;return [el,...all(el.props?.children)];}
const event={preventDefault(){}};
function props(overrides: Record<string,unknown>={}) {return {archive:{id:"archive-1",type:"REPLY",decisionStatus:{decision:"ADOPTED"}},outcomes:[],outcomeState:{archiveId:"archive-1",status:"ready",errorKind:null,message:""},outcomeListState:{status:"ready",message:""},outcomeNextCursor:null,pendingOutcomeDraft:null,onRecord(){},onLoadMore(){},onRetryList(){},...overrides};}

test("422 rejection unlocks editing and creates a fresh submission",()=>{
 const render=harness(); const requests:Draft[]=[];const record=(_id:string,d:Draft)=>requests.push(d);
 let tree=render(props({onRecord:record}));all(tree).find(e=>e.type==='form')!.props.onSubmit!(event);
 tree=render(props({onRecord:record,outcomeState:{archiveId:'archive-1',status:'error',errorKind:'validation',message:'invalid time'}}));
 const input=all(tree).find(e=>e.type==='input')!;assert.equal(Boolean(input.props.disabled),false);
 input.props.onChange!({target:{value:'2026-09-10T10:00'}});
 tree=render(props({onRecord:record,outcomeState:{archiveId:'archive-1',status:'error',errorKind:'validation',message:'invalid time'}}));
 all(tree).find(e=>e.type==='form')!.props.onSubmit!(event);
 assert.equal(requests.length,2);assert.notEqual(requests[0].idempotencyKey,requests[1].idempotencyKey);assert.notEqual(requests[0].occurredAt,requests[1].occurredAt);
});

test("remounted panel retries the controller-held uncertain request unchanged",()=>{
 const draft={outcome:'PARTIAL',occurredAt:'2026-09-10T01:00:00Z',idempotencyKey:'same-key-001'};let sent:unknown;
 const tree=harness()(props({pendingOutcomeDraft:draft,outcomeState:{archiveId:'archive-1',status:'error',errorKind:'network',message:'unknown'},onRecord:(_id:string,d:unknown)=>{sent=d;}}));
 assert.equal(all(tree).find(e=>e.type==='input')!.props.disabled,true);
 all(tree).find(e=>e.type==='form')!.props.onSubmit!(event);assert.deepEqual(sent,draft);
});

test("correction submits the selected head and offers no action for superseded events",()=>{
 const old={eventId:'a'.repeat(32),outcome:'OBSERVING',occurredAt:'2026-09-10T01:00Z',eventKind:'RECORDED',supersedesEventId:null};
 const head={...old,eventId:'b'.repeat(32),eventKind:'CORRECTED',supersedesEventId:old.eventId};let sent:Draft | undefined;
 const render=harness();const p=props({outcomes:[head,old],onRecord:(_id:string,d:Draft)=>{sent=d;}});let tree=render(p);
 const actions=all(tree).filter(e=>e.props?.['data-correct-event']);assert.equal(actions.length,1);assert.equal(actions[0].props['data-correct-event'],head.eventId);
 actions[0].props.onClick!();tree=render(p);all(tree).find(e=>e.type==='form')!.props.onSubmit!(event);assert.equal(sent?.supersedesEventId,head.eventId);
});

test("history exposes more pages and never labels loaded length as total",()=>{
 let called=false;const tree=harness()(props({outcomeNextCursor:'next-page',onLoadMore:()=>{called=true;}}));
 all(tree).find(e=>e.props?.['data-outcome-more'])!.props.onClick!();assert.equal(called,true);
 const source=readFileSync(new URL('./ShiguanOutcomePanel.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/共 \{outcomes.length\}/);assert.match(source,/采纳/);
});

test("panel retains explicit immutable history and non-authorization wording",()=>{
 const source=readFileSync(new URL('./ShiguanOutcomePanel.tsx',import.meta.url),'utf8');
 for(const text of ['ACHIEVED','PARTIAL','NOT_ACHIEVED','OBSERVING','不可改写','不代表已人工确认','不构成对外发布或付款授权','原记录仍然保留'])assert.ok(source.includes(text));
});
