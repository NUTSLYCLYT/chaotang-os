import { notFound, redirect } from 'next/navigation';

import { BureauPageRouteClient } from '@/features/bureaus/components/BureauPageRouteClient';
import {
  getBureauSpecBySlug,
} from '@/features/bureaus/lib/bureau-page-specs';
import {
  isSixDepartmentCode,
  type SixDepartmentCode,
} from '@/features/departments/lib/six-departments-content';
import {
  getV1OfficeCanonicalSlug,
  getV1OfficeStaticParams,
  V1_DEPARTMENT_ALIASES,
} from '@/config/chaotang-v1-modules';

type DepartmentOfficePageProps = {
  params: Promise<{ code: string; office: string }>;
};

export function generateStaticParams() {
  return getV1OfficeStaticParams();
}

export default async function DepartmentOfficeSubpage({ params }: DepartmentOfficePageProps) {
  const { code, office: officeSlug } = await params;

  const canonical = Object.prototype.hasOwnProperty.call(V1_DEPARTMENT_ALIASES, code)
    ? V1_DEPARTMENT_ALIASES[code]
    : isSixDepartmentCode(code) ? code : undefined;
  if (!canonical) {
    notFound();
  }

  const canonicalOffice = getV1OfficeCanonicalSlug(code, officeSlug);
  const bureau = getBureauSpecBySlug(canonical, canonicalOffice);
  if (!bureau) {
    notFound();
  }

  return <BureauPageRouteClient department={canonical} bureau={canonicalOffice} />;
}
