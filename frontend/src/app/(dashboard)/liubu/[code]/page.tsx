import { notFound, redirect } from 'next/navigation';

import { DepartmentPageRouteClient } from '@/features/departments/components/DepartmentPageRouteClient';
import {
  isSixDepartmentCode,
  type SixDepartmentCode,
} from '@/features/departments/lib/six-departments-content';
import {
  getV1LiubuStaticParams,
  V1_DEPARTMENT_ALIASES,
} from '@/config/chaotang-v1-modules';

type DepartmentPageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<{ taskId?: string; newBudget?: string }>;
};

export function generateStaticParams() {
  return getV1LiubuStaticParams();
}

export default async function DepartmentSubpage({ params, searchParams }: DepartmentPageProps) {
  const { code } = await params;
  const query = await searchParams;

  if (code === 'guard') {
    redirect('/zhuanshu/jinyiwei');
  }

  if (code === 'works') {
    redirect('/liubu/gongbu');
  }

  const canonical = Object.prototype.hasOwnProperty.call(V1_DEPARTMENT_ALIASES, code)
    ? V1_DEPARTMENT_ALIASES[code]
    : isSixDepartmentCode(code) ? code : undefined;

  if (!canonical) {
    notFound();
  }

  return <DepartmentPageRouteClient code={canonical} focusTaskId={query?.taskId} newBudget={query?.newBudget === '1'} />;
}
