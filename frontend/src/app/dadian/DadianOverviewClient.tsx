"use client";

import { useEffect, useState } from "react";
import { DadianScene } from "../../features/dadian-visual/DadianScene";
import {
  createDadianOverviewController,
  INITIAL_DADIAN_OVERVIEW_STATE,
  type DadianOverviewController,
} from "./DadianOverviewController";

export function DadianOverviewClient() {
  const [state, setState] = useState(INITIAL_DADIAN_OVERVIEW_STATE);
  const [controller] = useState<DadianOverviewController>(() =>
    createDadianOverviewController({
      fetch: (input, init) => fetch(input, init),
      navigate: (location) => window.location.assign(location),
      onStateChange: setState,
    }),
  );

  useEffect(() => {
    void controller.loadInitial();
    return () => controller.dispose();
  }, [controller]);

  return (
    <DadianScene
      overview={state.overview}
      error={state.error}
      onRetry={() => void controller.retry()}
    />
  );
}
