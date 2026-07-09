'use client';

import { BureauPageViewError, BureauPageViewLoading, BureauPageViewShell } from '@/features/bureaus/components/BureauPageViewShell';
import { useBureauPageView } from '@/features/bureaus/hooks/useBureauPageView';
import { XingbuContractWorkbench } from '@/features/xingbu/components/xingbu-contract-workbench';
import { BingbuQuotationVerdictPanel } from '@/features/bingbu/components/bingbu-quotation-verdict-panel';
import { HubuFinancePreviewPanel } from '@/features/hubu/components/hubu-finance-preview-panel';

const REPORTING_PREVIEW_PLACEHOLDER = `{
  "caseId": "demo-001", "title": "示例报表", "period": "2026-06",
  "trialBalance": { /* 见 backend/src/hubu_financial_reporting.py 的 _income_statement 等函数 */ },
  "cashFlow": { /* 同上，_cash_flow_statement 输入形状 */ },
  "sources": { /* 各字段的 sourceLabel 溯源 */ }
}`;

const CASHFLOW_PREVIEW_PLACEHOLDER = `{
  "cash": 500000, "bank": 200000,
  "monthly_flows": [{ "period": "2026-06", "cash_receipts": 80000, "cash_payments": 60000 }],
  "receivables": [], "payables": [], "upcoming_inflows": [], "upcoming_outflows": []
}`;

export function BureauPageRouteClient({ department, bureau }: { department: string; bureau: string }) {
  const { data, error, isLoading } = useBureauPageView(department, bureau);

  if (error) return <BureauPageViewError department={department} bureau={bureau} message={error instanceof Error ? error.message : 'unknown'} />;
  if (isLoading || !data) return <BureauPageViewLoading department={department} bureau={bureau} />;
  return (
    <>
      <BureauPageViewShell view={data} />
      {department === 'legal' && bureau === 'contract-review' && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8">
          <XingbuContractWorkbench />
        </div>
      )}
      {department === 'ops' && bureau === 'sales' && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8">
          <BingbuQuotationVerdictPanel />
        </div>
      )}
      {department === 'finance' && bureau === 'budget' && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8">
          <HubuFinancePreviewPanel
            title="财务报表/审计异常深度预览"
            endpoint="/api/chaotang/hubu/finance/reporting/preview"
            placeholder={REPORTING_PREVIEW_PLACEHOLDER}
          />
        </div>
      )}
      {department === 'finance' && bureau === 'treasury' && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8">
          <HubuFinancePreviewPanel
            title="现金跑道户部奏报深度预览"
            endpoint="/api/chaotang/hubu/cashflow/preview"
            placeholder={CASHFLOW_PREVIEW_PLACEHOLDER}
          />
        </div>
      )}
    </>
  );
}
