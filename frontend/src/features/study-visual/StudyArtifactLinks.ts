import { Fragment, createElement, type ReactElement } from "react";

import type { ReportArtifact } from "../../lib/backendClient.ts";

export function StudyArtifactLinks(
  props: { artifacts: ReportArtifact[]; className?: string },
): ReactElement | null {
  if (props.artifacts.length === 0) return null;
  return createElement(
    Fragment,
    null,
    ...props.artifacts.map((artifact) => createElement(
      "p",
      { className: props.className, key: artifact.artifactId },
      createElement(
        "a",
        {
          "data-testid": `decree-artifact-${artifact.artifactId}`,
          href: `/api/report-artifacts/${encodeURIComponent(artifact.artifactId)}`,
        },
        `下载财务报告：${artifact.displayName}（${artifact.periodStart}–${artifact.periodEnd}）`,
      ),
    )),
  );
}
