import { getJinyiweiSummary } from "../../../../lib/backendClient.ts";

const FRIENDLY = {
  validation: "查询条件未通过校验。", not_found: "调查案卷不存在。",
  storage: "锦衣卫案卷暂时不可用，请稍后重试。", network: "无法连接朝堂后端，请稍后重试。",
  unknown: "锦衣卫只读服务暂时不可用，请稍后重试。",
} as const;
const reply=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

export function createSummaryHandler(readSummary:typeof getJinyiweiSummary=getJinyiweiSummary){
return async function handleSummary(request:Request):Promise<Response>{
  if ([...new URL(request.url).searchParams.keys()].length>0) return reply({status:"error",reason:"validation",message:FRIENDLY.validation},400);
  const result=await readSummary();
  if(result.ok)return reply({status:"ok",summary:result.data},200);
  const status=result.kind==="validation"?400:result.kind==="not_found"?404:503;
  return reply({status:"error",reason:result.kind,message:FRIENDLY[result.kind]},status);
};
}
export const GET=createSummaryHandler();
