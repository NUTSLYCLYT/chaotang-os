import type {
  QintianForecast,
  QintianPendingTrigger,
  QintianSubject,
} from "./qintianContracts.ts";
import type { QintianDecisionRadarMode } from "./qintianDecisionRadar.ts";

export interface QintianContext {
  key: string;
  subject: QintianSubject;
}

interface ContextCandidate {
  id: string;
  content: string;
}

export interface QintianContextInput {
  decreeText: string;
  draft: { fingerprint: string; content: string } | null;
  currentReply: ContextCandidate | null;
  archivedReply: ContextCandidate | null;
}

function textFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createQintianContext(input: QintianContextInput): QintianContext {
  if (input.archivedReply) {
    return {
      key: `REPLY:${input.archivedReply.id}`,
      subject: {
        kind: "REPLY",
        id: input.archivedReply.id,
        title: "归档回奏",
        content: input.archivedReply.content,
      },
    };
  }
  if (input.currentReply) {
    return {
      key: `REPLY:${input.currentReply.id}`,
      subject: {
        kind: "REPLY",
        id: input.currentReply.id,
        title: "当前回奏",
        content: input.currentReply.content,
      },
    };
  }
  if (input.draft) {
    return {
      key: `DRAFT:${input.draft.fingerprint}`,
      subject: {
        kind: "DRAFT",
        id: input.draft.fingerprint,
        title: "拟旨草稿",
        content: input.draft.content,
      },
    };
  }
  const content = input.decreeText.trim();
  const id = `text-${textFingerprint(content)}`;
  return {
    key: `DECREE:${id}`,
    subject: {
      kind: "DECREE",
      id,
      title: content ? "当前旨意" : "未填写旨意",
      content: content || "尚未填写具体事项",
    },
  };
}

export type QintianFormalPhase =
  | "idle"
  | "pending"
  | "ready"
  | "error"
  | "provider_unavailable";

export interface QintianWorkspaceState {
  contextKey: string;
  subject: QintianSubject | null;
  requestId: number | null;
  formalPhase: QintianFormalPhase;
  forecast: QintianForecast | null;
  dueTriggers: QintianPendingTrigger[];
  error: string | null;
}

export const initialQintianWorkspaceState: QintianWorkspaceState = {
  contextKey: "",
  subject: null,
  requestId: null,
  formalPhase: "idle",
  forecast: null,
  dueTriggers: [],
  error: null,
};

export type QintianWorkspaceAction =
  | { type: "CONTEXT_CHANGED"; contextKey: string; subject?: QintianSubject }
  | { type: "FORECAST_STARTED"; contextKey: string; requestId: number }
  | {
      type: "FORECAST_SUCCEEDED";
      contextKey: string;
      requestId: number;
      forecast: QintianForecast;
    }
  | {
      type: "FORECAST_FAILED";
      contextKey: string;
      requestId: number;
      kind: "error" | "provider_unavailable";
      message: string;
    }
  | { type: "TRIGGERS_LOADED"; contextKey: string; triggers: QintianPendingTrigger[] }
  | { type: "TRIGGER_REVIEWED"; triggerId: string };

export function qintianWorkspaceReducer(
  state: QintianWorkspaceState,
  action: QintianWorkspaceAction,
): QintianWorkspaceState {
  if (action.type === "CONTEXT_CHANGED") {
    if (action.contextKey === state.contextKey && action.subject === state.subject) return state;
    return {
      ...initialQintianWorkspaceState,
      contextKey: action.contextKey,
      subject: action.subject ?? null,
    };
  }
  if ("contextKey" in action && action.contextKey !== state.contextKey) return state;
  if ("requestId" in action && action.type !== "FORECAST_STARTED" && action.requestId !== state.requestId) {
    return state;
  }
  switch (action.type) {
    case "FORECAST_STARTED":
      return {
        ...state,
        requestId: action.requestId,
        formalPhase: "pending",
        forecast: null,
        error: null,
      };
    case "FORECAST_SUCCEEDED":
      return {
        ...state,
        formalPhase: "ready",
        forecast: action.forecast,
        error: null,
      };
    case "FORECAST_FAILED":
      return {
        ...state,
        formalPhase: action.kind,
        forecast: null,
        error: action.message,
      };
    case "TRIGGERS_LOADED":
      return {
        ...state,
        dueTriggers: state.subject === null
          ? []
          : action.triggers.filter((trigger) =>
              trigger.isDue &&
              trigger.subject.kind === state.subject?.kind &&
              trigger.subject.id === state.subject.id &&
              trigger.subject.title === state.subject.title &&
              trigger.subject.content === state.subject.content &&
              trigger.contextRef.kind === state.subject.kind &&
              trigger.contextRef.id === state.subject.id),
      };
    case "TRIGGER_REVIEWED":
      return {
        ...state,
        dueTriggers: state.dueTriggers.filter((trigger) => trigger.id !== action.triggerId),
      };
    default:
      return state;
  }
}

export type QintianWorkspaceMode =
  | "TRIGGER_DUE"
  | "FORMAL_PENDING"
  | "FORMAL_READY"
  | "FORMAL_ERROR"
  | "FORMAL_UNAVAILABLE"
  | QintianDecisionRadarMode;

export function projectQintianWorkspaceMode(input: {
  pageMode: QintianDecisionRadarMode;
  formalPhase: QintianFormalPhase;
  dueTriggers: QintianPendingTrigger[];
}): QintianWorkspaceMode {
  if (input.dueTriggers.some((trigger) => trigger.isDue)) return "TRIGGER_DUE";
  if (input.formalPhase === "pending") return "FORMAL_PENDING";
  if (input.formalPhase === "ready") return "FORMAL_READY";
  if (input.formalPhase === "provider_unavailable") return "FORMAL_UNAVAILABLE";
  if (input.formalPhase === "error") return "FORMAL_ERROR";
  return input.pageMode;
}
