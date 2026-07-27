import { MinistryOverviewClient } from "../../features/ministries-visual/MinistryOverviewClient";
import { resolveMinistryRoute } from "../../features/ministries-visual/ministryRouteResolver";
import { requireUser } from "../../lib/requireUser";

export default async function LiubuPage() {
  await requireUser("/liubu");
  const view = resolveMinistryRoute();
  return <MinistryOverviewClient view={view} />;
}
