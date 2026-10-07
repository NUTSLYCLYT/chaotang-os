import { requireUser } from "../../../lib/requireUser";
import { CourtShell } from "../../../components/chaotang/CourtShell";
import { BingbuDashboard } from "../../../features/bingbu/BingbuDashboard";

export default async function BingbuImportPage() {
  await requireUser("/bingbu/import" as Parameters<typeof requireUser>[0]);
  return <CourtShell currentLabel="导入销售事实" currentPath="/bingbu"><BingbuDashboard view="import" /></CourtShell>;
}
