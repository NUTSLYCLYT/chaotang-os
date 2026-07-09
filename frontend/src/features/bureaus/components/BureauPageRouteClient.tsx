'use client';

import { BureauPageViewError, BureauPageViewLoading, BureauPageViewShell } from '@/features/bureaus/components/BureauPageViewShell';
import { useBureauPageView } from '@/features/bureaus/hooks/useBureauPageView';
import { XingbuContractWorkbench } from '@/features/xingbu/components/xingbu-contract-workbench';

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
    </>
  );
}
