export type SceneRiskGrade = "low" | "medium" | "high";
export type SceneRunStatus = "created" | "running" | "completed" | "blocked" | "failed";
export type SceneMissionStage = "todo" | "in_progress" | "awaiting_input" | "blocked" | "done";

export interface ScenePack {
  id: string;
  slug: string;
  name: string;
  shortValue: string;
  targetUser: string;
  defaultOwnerDept: string;
  sortOrder: number;
  requiredInputs: string[];
  optionalInputs: string[];
  implementationStatus: "real_v1" | "stubbed";
  entryRoute: string;
  demoAvailable: boolean;
  canExecute: boolean;
  exampleHint: string;
}

export interface SceneNextAction {
  title: string;
  ownerDept: string;
  priority: "P0" | "P1" | "P2";
  dueHint: string;
}

export interface SceneEvidenceRef {
  claim: string;
  sourceLabel: string;
  sourceType: string;
  capturedAt: string;
  reliability: "high" | "medium" | "low";
}

export interface SceneRun {
  runId: string;
  packSlug: string;
  status: SceneRunStatus;
  verdict: string;
  verdictText: string;
  confidence: number | null;
  riskGrade: SceneRiskGrade;
  opportunityGrade: SceneRiskGrade;
  missingItems: string[];
  nextActions: SceneNextAction[];
  evidenceRefs: SceneEvidenceRef[];
  summaryForUser: string;
  canProceed: boolean;
  demo: boolean;
  missionId?: string;
  boardMission?: {
    title: string;
    stage: SceneMissionStage;
    nextMilestone: string;
  };
  details: Record<string, unknown>;
  recommendedReply?: { subject: string; body: string; tone: string } | null;
  followUpPlan?: Array<Record<string, string>>;
  leadScore?: number | null;
  authenticityScore?: number | null;
}

export interface SceneMission {
  missionId: string;
  runId: string;
  packSlug: string;
  packName: string;
  title: string;
  owner: string;
  stage: SceneMissionStage;
  riskGrade: SceneRiskGrade;
  nextMilestone: string;
  dueAt: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SCENE_SLUGS = [
  "single-product-export-diagnosis",
  "b2b-inquiry-conversion",
  "proposal-quotation-tender",
  "contract-cashflow-risk",
  "enterprise-growth-diagnosis",
] as const;

export type SceneSlug = (typeof SCENE_SLUGS)[number];
