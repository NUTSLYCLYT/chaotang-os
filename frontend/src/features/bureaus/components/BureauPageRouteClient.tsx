'use client';

import { BureauPageViewError, BureauPageViewLoading, BureauPageViewShell } from '@/features/bureaus/components/BureauPageViewShell';
import { useBureauPageView } from '@/features/bureaus/hooks/useBureauPageView';

export function BureauPageRouteClient({ department, bureau }: { department: string; bureau: string }) {
  const { data, error, isLoading } = useBureauPageView(department, bureau);

  if (error) return <BureauPageViewError department={department} bureau={bureau} message={error instanceof Error ? error.message : 'unknown'} />;
  if (isLoading || !data) return <BureauPageViewLoading department={department} bureau={bureau} />;
  return <BureauPageViewShell view={data} />;
}
