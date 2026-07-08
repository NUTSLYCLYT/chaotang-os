/**
 * 朝堂 ↔ Twenty CRM · GraphQL 适配层（骨架）· 2026-07-01
 *
 * ⚠️ 待连真实例：需 env `TWENTY_URL` + `TWENTY_API_KEY`，且字段名须对齐你 Twenty workspace 的
 * 实际 schema（自定义字段 chaotang_* 需先在 Twenty 里建）。**未连真实例前不可用，勿当已通。**
 *
 * 职责边界（铁律6/2）：Twenty 是客户系统记录（company/person/opportunity 单一真相），
 * 朝堂只读它、把裁决写回它的自定义字段；**朝堂不建平行客户表**。
 */
import { synthesizeDealVerdict, type DealInput, type DealVerdict } from '@/features/bingbu/lib/deal-verdict';

export interface TwentyOpportunity {
  id: string;
  name: string;
  companyName: string;
  amount: number | null;
  stage: string;
  /** 户部真成本（朝堂自定义字段回填，或由 BOM 关联）。 */
  cost: number | null;
  paymentTerms: string | null;
}

const cfg = () => {
  const url = process.env.TWENTY_URL;
  const key = process.env.TWENTY_API_KEY;
  if (!url || !key) throw new Error('Twenty 未配置：需 TWENTY_URL + TWENTY_API_KEY（起好 Twenty 实例后填）');
  return { url: url.replace(/\/$/, ''), key };
};

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { url, key } = cfg();
  const res = await fetch(`${url}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Twenty GraphQL ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`Twenty GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

/**
 * 读商机管道（字段名须对齐你 Twenty schema——自定义字段 cost/paymentTerms 需先建）。
 * ⚠️ 骨架查询，连真实例后按实际 schema 调字段。
 */
export async function fetchOpportunities(first = 50): Promise<TwentyOpportunity[]> {
  const data = await gql<{ opportunities: { edges: { node: Record<string, unknown> }[] } }>(
    `query($first:Int){ opportunities(first:$first){ edges{ node{
      id name amount stage
      company { name }
      chaotang_cost chaotang_payment_terms
    } } } }`,
    { first },
  );
  return data.opportunities.edges.map(({ node }) => ({
    id: String(node.id),
    name: String(node.name ?? ''),
    companyName: String((node.company as { name?: string })?.name ?? ''),
    amount: node.amount == null ? null : Number(node.amount),
    stage: String(node.stage ?? ''),
    cost: node.chaotang_cost == null ? null : Number(node.chaotang_cost),
    paymentTerms: node.chaotang_payment_terms == null ? null : String(node.chaotang_payment_terms),
  }));
}

/**
 * 把朝堂裁决幂等写回 opportunity 自定义字段（chaotang_*）。
 *
 * 安全阀(2026-07-04·审查发现)：本函数用毛利公式算出的报价数字直接写回外部生产系统 Twenty，
 * 绕开后端 jiqun 核算、也没有人工确认门(违反铁律13.2.5"对外报价须过人工确认门")。当前全仓
 * 没有任何路由调用这条链路，是休眠骨架；加这道显式开关防止将来被无意接上就直接生效。
 * 真要启用：先在铁律13.2.5 的人工确认门内调用本函数，并显式设 TWENTY_WRITEBACK_ENABLED=true。
 */
export async function writeBackVerdict(opportunityId: string, verdict: DealVerdict): Promise<void> {
  if (process.env.TWENTY_WRITEBACK_ENABLED !== 'true') {
    throw new Error(
      'writeBackVerdict 已禁用：需显式设 TWENTY_WRITEBACK_ENABLED=true 才允许对外写回真实报价（防止未经人工确认门的自动写回）',
    );
  }
  await gql(
    `mutation($id:UUID!,$data:OpportunityUpdateInput!){ updateOpportunity(id:$id,data:$data){ id } }`,
    { id: opportunityId, data: verdict.writeBack },
  );
}

/** 端到端一条：读 opportunity → 合成跨部裁决 → 写回。连真实例后即可跑。 */
export async function runDealVerdict(opp: TwentyOpportunity): Promise<DealVerdict> {
  const input: DealInput = {
    opportunityName: opp.name,
    customer: opp.companyName,
    cost: opp.cost,
    paymentTerms: opp.paymentTerms ?? undefined,
  };
  const verdict = synthesizeDealVerdict(input);
  await writeBackVerdict(opp.id, verdict);
  return verdict;
}
