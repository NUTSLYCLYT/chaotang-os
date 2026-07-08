'use client';

import { DepartmentPageViewError, DepartmentPageViewLoading, DepartmentPageViewShell } from '@/features/departments/components/DepartmentPageViewShell';
import { useDepartmentPageView } from '@/features/departments/hooks/useDepartmentPageView';
import type { DepartmentPageCode } from '@/lib/contracts/department-page-view';

export function DepartmentPageRouteClient({
  code,
  focusTaskId,
  newBudget = false,
}: {
  code: DepartmentPageCode | string;
  focusTaskId?: string;
  newBudget?: boolean;
}) {
  const { data, error, isLoading } = useDepartmentPageView(code);

  if (isLoading || !data) {
    if (error) {
      return <DepartmentPageViewError code={code} message={error instanceof Error ? error.message : 'unknown'} />;
    }
    return <DepartmentPageViewLoading code={code} />;
  }

  return <DepartmentPageViewShell view={data} focusTaskId={focusTaskId} newBudget={newBudget} />;
}
