import { requireUser } from "../../lib/requireUser";
import { DadianOverviewClient } from "./DadianOverviewClient";

export default async function DadianPage() {
  await requireUser("/dadian");
  return <DadianOverviewClient />;
}
