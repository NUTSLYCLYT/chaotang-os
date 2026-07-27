import { MinistryOverviewClient } from "../../../../features/ministries-visual/MinistryOverviewClient";
import { resolveMinistryRoute } from "../../../../features/ministries-visual/ministryRouteResolver";
import { requireUser } from "../../../../lib/requireUser";
import { notFound } from "next/navigation";

export default async function LiubuOfficePage({ params }: { params: Promise<{ code: string; office: string }> }) {
  const { code, office } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}/${encodeURIComponent(office)}`;
  await requireUser(routeSegment);
  const view = resolveMinistryRoute(code, office);
  if (view.kind === "not-found") notFound();
  return <MinistryOverviewClient view={view} />;
}
