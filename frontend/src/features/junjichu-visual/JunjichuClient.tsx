"use client";

import { useEffect, useState } from "react";

import { JunjichuScene } from "./JunjichuScene";
import { createJunjichuController } from "./junjichuController.ts";

export function JunjichuClient() {
  const [controller] = useState(() =>
    createJunjichuController({
      fetch: globalThis.fetch,
      redirect: (location) => window.location.assign(location),
    }),
  );
  const [state, setState] = useState(controller.state);

  useEffect(() => {
    const disconnect = controller.connect(setState);
    controller.start();
    return disconnect;
  }, [controller]);

  return (
    <JunjichuScene
      activeCases={state.activeCases}
      archivedCases={state.archivedCases}
      failedCases={state.failedCases}
      department={state.department}
      departments={state.departments}
      caseStatus={state.caseStatus}
      keyword={state.keyword}
      selectedId={state.selectedId}
      error={state.error}
      onDepartmentChange={(department) => controller.selectDepartment(department)}
      onStatusChange={(status) => controller.selectStatus(status)}
      onKeywordChange={(keyword) => controller.selectKeyword(keyword)}
      onSelect={(id) => controller.selectCase(id)}
      onRetry={() => controller.retry()}
    />
  );
}
