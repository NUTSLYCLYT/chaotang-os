import { requireUser } from "../../../../lib/requireUser";
import { CourtShell } from "../../../../components/chaotang/CourtShell";
import { BingbuDashboard } from "../../../../features/bingbu/BingbuDashboard";

export default async function BingbuOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("/bingbu" as Parameters<typeof requireUser>[0]);
  const { id } = await params;
  return <CourtShell currentLabel="商机详情" currentPath="/bingbu"><BingbuDashboard view="detail" opportunityId={id} /></CourtShell>;
}
