import { CourtShell } from "../../components/chaotang/CourtShell";
import { MinistryOverview } from "../../features/department-demo/DepartmentDemoViews";
import { DEPARTMENT_DEMOS } from "../../features/department-demo/departmentDemoData";
import { requireUser } from "../../lib/requireUser";

export default async function LiubuPage() {
  await requireUser("/liubu");
  return <CourtShell currentLabel="六部" currentPath="/liubu"><MinistryOverview departments={DEPARTMENT_DEMOS} /></CourtShell>;
}
