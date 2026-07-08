import type { NextRequest } from 'next/server';

import { loadDepartmentPageViewSources } from '@/features/departments/lib/department-page-view-loader';
import type { BureauDepartmentCode } from '@/lib/contracts/bureau-page-view';

export async function loadBureauPageViewSources(req: NextRequest, department: BureauDepartmentCode) {
  return loadDepartmentPageViewSources(req, department, department);
}
