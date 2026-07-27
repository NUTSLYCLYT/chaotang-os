import { MinistryOverviewClient } from "../../../features/ministries-visual/MinistryOverviewClient";
import { resolveMinistryRoute } from "../../../features/ministries-visual/ministryRouteResolver";
import { requireUser } from "../../../lib/requireUser";
import { notFound } from "next/navigation";

export default async function LiubuDepartmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}`;
  await requireUser(routeSegment);
  const view = resolveMinistryRoute(code);
  if (view.kind === "not-found") notFound();
  return <MinistryOverviewClient view={view} />;
}
