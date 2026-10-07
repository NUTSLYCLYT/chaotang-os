import { requireUser } from "../../../../lib/requireUser";
import { CourtShell } from "../../../../components/chaotang/CourtShell";
import { BingbuDashboard } from "../../../../features/bingbu/BingbuDashboard";

export default async function BingbuWarRoomPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("/bingbu" as Parameters<typeof requireUser>[0]);
  const { id } = await params;
  return <CourtShell currentLabel="销售会审包" currentPath="/bingbu"><BingbuDashboard view="war-room" opportunityId={id} /></CourtShell>;
}
