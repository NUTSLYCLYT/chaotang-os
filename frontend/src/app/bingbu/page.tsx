import { requireUser } from "../../lib/requireUser";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { BingbuDashboard } from "../../features/bingbu/BingbuDashboard";

export default async function BingbuPage() {
  await requireUser("/bingbu" as Parameters<typeof requireUser>[0]);
  return <CourtShell currentLabel="兵部 Revenue OS" currentPath="/bingbu"><BingbuDashboard /></CourtShell>;
}
