import { requireUser } from "../../lib/requireUser";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { DadianOverviewClient } from "./DadianOverviewClient";

/* CourtPlaceholderPage variant="dadian" is intentionally replaced by the live overview client. */

export default async function DadianPage() {
  await requireUser("/dadian");
  return <CourtShell currentLabel="大殿" currentPath="/dadian"><DadianOverviewClient /></CourtShell>;
}
