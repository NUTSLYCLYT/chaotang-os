"use client";

import { useEffect, useMemo, useState } from "react";

import { DepartmentScene } from "./DepartmentScene";
import {
  createMinistriesController,
  type MinistriesControllerState,
} from "./ministriesController";
import type { MinistryRouteResolution } from "./ministryRouteResolver";
import { MinistryOverviewScene } from "./MinistryOverviewScene";
import { OfficeScene } from "./OfficeScene";

type RenderableMinistryView = Exclude<MinistryRouteResolution, { kind: "not-found" }>;

export function MinistryOverviewClient({ view }: { view: RenderableMinistryView }) {
  const controller = useMemo(
    () =>
      createMinistriesController({
        fetch: (input, init) => fetch(input, init),
        redirect: () => {
          const next = window.location.pathname;
          window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        },
      }),
    [],
  );
  const [controllerState, setControllerState] =
    useState<MinistriesControllerState>(controller.state);
  useEffect(() => {
    const disconnect = controller.connect(setControllerState);
    controller.start();
    return disconnect;
  }, [controller]);

  const shared = {
    cases: controllerState.cases,
    state: controllerState.status,
    error: controllerState.error,
    retry: controller.retry,
  } as const;
  if (view.kind === "department") {
    return <DepartmentScene {...shared} department={view.department} />;
  }
  if (view.kind === "office") {
    return <OfficeScene {...shared} department={view.department} office={view.office} />;
  }
  return <MinistryOverviewScene {...shared} />;
}
