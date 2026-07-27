"use client";

import { useEffect, useState } from "react";

import { ShiguanWorkspace } from "../../features/shiguan-visual/ShiguanWorkspace";
import { buildArchiveFilterQuery } from "./archiveStatus.ts";
import {
  parseArchivesPayload,
  parseRecallPayload,
  parseReviewPayload,
  parseStatisticsPayload,
} from "./shiguanPayload.ts";
import {
  ShiguanController,
  type ShiguanTransport,
} from "./shiguanController.ts";
import { requestShiguanJson } from "./shiguanRequest.ts";
import styles from "./shiguan.module.css";

function createTransport(): ShiguanTransport {
  return {
    listArchives: (input, signal) => {
      const query = buildArchiveFilterQuery({ ...input, limit: 100 });
      return requestShiguanJson(
        `/api/shiguan/archives?${query}`,
        { signal },
        parseArchivesPayload,
      );
    },
    getStatistics: (signal) => requestShiguanJson(
      "/api/shiguan/statistics",
      { signal },
      parseStatisticsPayload,
    ),
    recall: (input, signal) => requestShiguanJson(
      "/api/shiguan/recall",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, limit: 10 }),
        signal,
      },
      parseRecallPayload,
    ),
    review: (archiveId, input, signal) => requestShiguanJson(
      `/api/shiguan/archives/${archiveId}/review`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      },
      parseReviewPayload,
    ),
  };
}

export function ShiguanClient() {
  const [controller] = useState(() => new ShiguanController(
    createTransport(),
    {
      onUnauthorized: () => {
        window.setTimeout(
          () => window.location.assign("/login?next=%2Fshiguan"),
          0,
        );
      },
    },
  ));
  const [state, setState] = useState(controller.state);

  useEffect(() => {
    const disconnect = controller.connect(setState);
    controller.start();
    return disconnect;
  }, [controller]);

  const selectedArchive =
    state.archives.find((archive) => archive.id === state.selectedArchiveId) ?? null;

  return (
    <div className={styles.page}>
      <ShiguanWorkspace
        archives={state.archives}
        selectedArchive={selectedArchive}
        statistics={state.statistics}
        matches={state.matches}
        archiveState={state.archiveState}
        statisticsState={state.statisticsState}
        recallState={state.recallState}
        reviewState={state.reviewState}
        onSelectArchive={(id) => controller.selectArchive(id)}
        onFilter={(input) => controller.filter(input)}
        onRecall={(input) => { controller.recall(input); }}
        onReview={(archiveId, input) => { controller.reviewArchive(archiveId, input); }}
        onRetryArchives={() => controller.retryArchives()}
        onRetryStatistics={() => controller.retryStatistics()}
        onRetryRecall={() => controller.retryRecall()}
      />
    </div>
  );
}
