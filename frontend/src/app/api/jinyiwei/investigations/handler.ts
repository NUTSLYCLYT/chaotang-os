import { type JinyiweiStatus, listJinyiweiInvestigations } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const STATUSES=new Set<JinyiweiStatus>(["RESOLVED","PARTIAL","BLOCKED","UNAVAILABLE"]);
const FRIENDLY={validation:"查询条件未通过校验。",not_found:"调查案卷不存在。",storage:"锦衣卫案卷暂时不可用，请稍后重试。",network:"无法连接朝堂后端，请稍后重试。",unknown:"锦衣卫只读服务暂时不可用，请稍后重试。"} as const;
const reply=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
function decimal(value:string,min:number,max:number):number|null { if(!/^(0|[1-9]\d*)$/.test(value))return null;const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>=min&&parsed<=max?parsed:null; }

export function createListHandler(readList:typeof listJinyiweiInvestigations=listJinyiweiInvestigations,readSession:typeof readSessionId=readSessionId){
return async function handleList(request:Request):Promise<Response>{
  const sessionId=readSession(request);
  if(!sessionId)return reply({status:"error",reason:"unauthenticated",message:"authentication required"},401);
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(k=>!["status","limit","offset"].includes(k))||["status","limit","offset"].some(k=>params.getAll(k).length>1))return reply({status:"error",reason:"validation",message:FRIENDLY.validation},400);
  const rawStatus=params.get("status"),rawLimit=params.get("limit"),rawOffset=params.get("offset");
  if(rawStatus!==null&&(!rawStatus||!STATUSES.has(rawStatus as JinyiweiStatus)))return reply({status:"error",reason:"validation",message:FRIENDLY.validation},400);
  const limit=rawLimit===null?20:decimal(rawLimit,1,100),offset=rawOffset===null?0:decimal(rawOffset,0,Number.MAX_SAFE_INTEGER);
  if(limit===null||offset===null)return reply({status:"error",reason:"validation",message:FRIENDLY.validation},400);
  const result=await readList({status:rawStatus===null?undefined:rawStatus as JinyiweiStatus,limit,offset,sessionId});
  if(result.ok)return reply({status:"ok",page:result.data},200);
  const status=result.kind==="validation"?400:result.kind==="not_found"?404:503;
  return reply({status:"error",reason:result.kind,message:FRIENDLY[result.kind]},status);
};
}
export const GET=createListHandler();
