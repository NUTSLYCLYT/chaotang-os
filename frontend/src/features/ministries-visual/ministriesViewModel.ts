import type { ReplyCaseView } from "../court-replies/replyFeed.ts";
import type { MinistriesControllerState } from "./ministriesController.ts";

export type MinistryReadStatus = "loading" | "error" | "empty" | "ready";

export interface MinistryReplyProjection {
  status: MinistryReadStatus;
  cases: ReplyCaseView[] | null;
  error: string | null;
  countLabel: string;
}

export interface MinistryProjectionInput {
  state: MinistriesControllerState["status"];
  cases: ReplyCaseView[] | null;
  error: string | null;
  department?: string;
}

export function projectMinistryReplies({
  state,
  cases,
  error,
  department,
}: MinistryProjectionInput): MinistryReplyProjection {
  if (state === "error") {
    return {
      status: "error",
      cases: null,
      error,
      countLabel: "读取失败",
    };
  }
  if (state === "loading" || cases === null) {
    return {
      status: "loading",
      cases: null,
      error: null,
      countLabel: "读取中",
    };
  }

  const matching = department
    ? cases.filter((item) => item.departments.includes(department))
    : [...cases];
  if (state === "empty" || matching.length === 0) {
    return {
      status: "empty",
      cases: [],
      error: null,
      countLabel: "0 条",
    };
  }
  return {
    status: "ready",
    cases: matching,
    error: null,
    countLabel: `${matching.length} 条`,
  };
}

export function projectMinistryMetrics(
  view: MinistryReplyProjection,
): readonly (readonly [string, string])[] {
  if (view.status === "loading") {
    return [
      ["办结回奏", "读取中"],
      ["回奏主体", "读取中"],
      ["最近回奏", "读取中"],
    ];
  }
  if (view.status === "error") {
    return [
      ["办结回奏", "暂不可读"],
      ["回奏主体", "暂不可读"],
      ["最近回奏", "暂不可读"],
    ];
  }

  const cases = view.cases ?? [];
  const respondents = new Set(cases.map((item) => item.respondent));
  const latest = cases
    .map((item) => Date.parse(item.repliedAt))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return [
    ["办结回奏", `${cases.length} 件`],
    ["回奏主体", `${respondents.size} 个`],
    [
      "最近回奏",
      latest
        ? new Intl.DateTimeFormat("zh-CN", {
            month: "2-digit",
            day: "2-digit",
          }).format(latest)
        : "暂无",
    ],
  ];
}
