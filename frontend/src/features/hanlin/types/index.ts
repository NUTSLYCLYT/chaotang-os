export type ContributionStatus =
  | 'draft'
  | 'submitted'
  | 'ai_reviewed'
  | 'recommended'
  | 'experimenting'
  | 'adopted'
  | 'awarded'
  | 'rejected';

export type AwardType =
  | 'zhuangyuan'
  | 'bangyan'
  | 'tanhua'
  | 'special_contribution'
  | 'application_star'
  | 'nomination';

export interface Contribution {
  id: string;
  title: string;
  type: string;
  summary: string;
  authorName: string;
  sourceUrl?: string;
  status: ContributionStatus;
  originalityClaim: 'original' | 'improved' | 'mixed';
  applicationHint: string;
  createdAt: string;
}

export interface AiReview {
  id: string;
  contributionId: string;
  originalityScore: number;
  qualityScore: number;
  valueScore: number;
  riskScore: number;
  confidenceScore: number;
  awardBandSuggestion: string;
  priceSuggestionMin: number;
  priceSuggestionMax: number;
  explanation: string;
}

export interface Recommendation {
  id: string;
  contributionId: string;
  reviewerName: string;
  action: 'recommend_experiment' | 'recommend_nomination' | 'recommend_observe' | 'reject';
  reason: string;
  targetModule: string;
  createdAt: string;
}

export interface Experiment {
  id: string;
  contributionId: string;
  scenario: string;
  status: 'pending' | 'running' | 'completed' | 'adopted' | 'stopped';
  feedbackSummary: string;
}

export interface Award {
  id: string;
  periodId: string;
  contributionId: string;
  awardType: AwardType;
  finalAmount: number;
  awardReason: string;
  approvalStatus: 'pending' | 'approved';
  paidStatus: 'queued' | 'paid';
  createdAt: string;
}

export interface RewardPeriod {
  id: string;
  name: string;
  status: 'open' | 'reviewing' | 'closed';
  revenueAmount: number;
  rewardPoolAmount: number;
  guaranteeAmount: number;
  awardedAmount: number;
  currency: 'CNY';
  startAt: string;
  endAt: string;
}

export type ScoutedProjectStatus = 'scouted' | 'evaluated' | 'trialing' | 'accepted' | 'rejected';

export interface ScoutedProject {
  id: string;
  source: 'github' | 'huggingface' | 'papers' | 'skills';
  name: string;
  url: string;
  summary: string;
  tags: string[];
  repoStars?: number;
  lastActiveAt: string;
}

export interface UpgradeCandidate {
  id: string;
  projectId: string;
  status: ScoutedProjectStatus;
  maturityScore: number;
  compatibilityScore: number;
  integrationCostScore: number;
  strategicValueScore: number;
  commercialValueScore: number;
  recommendedPriority: 'P0' | 'P1' | 'P2';
  notes: string;
}

export type ProductizedModuleStatus = 'draft' | 'standardizing' | 'packaged' | 'sellable' | 'active';

export interface ProductizedModule {
  id: string;
  name: string;
  originType: 'contribution' | 'internal' | 'external';
  originRef: string;
  status: ProductizedModuleStatus;
  docStatus: 'missing' | 'draft' | 'ready';
  apiStatus: 'n/a' | 'draft' | 'ready';
  dependencyStatus: 'unknown' | 'needs_cleanup' | 'stable';
  boundaryStatus: 'unclear' | 'reviewing' | 'clear';
  ownerName: string;
  notes: string;
}

export type ExportOfferingType = 'api' | 'plugin' | 'workflow_pack' | 'service_package';

export interface ExportOffering {
  id: string;
  productizedModuleId: string;
  offeringType: ExportOfferingType;
  displayName: string;
  summary: string;
  pricingMode: 'subscription' | 'one_time' | 'custom_quote';
  priceFloor: number;
  priceCeiling: number;
  salesStatus: 'draft' | 'internal_only' | 'sellable' | 'active';
  marketNotes: string;
}

export interface HanlinSummary {
  currentAwardCycle: string;
  submittedContributions: number;
  rankedContributions: number;
  activeCandidates: number;
  incubatingModules: number;
  exportableModules: number;
  adoptedContributions: number;
  queuedAwards: number;
  paidAwards: number;
  awardedAmount: number;
  rewardPoolRemaining: number;
  topContributionId: string | null;
  topCandidateId: string | null;
}

export interface HanlinOverview {
  summary: HanlinSummary;
  topContribution: Contribution | null;
  topCandidate:
    | (UpgradeCandidate & {
        project: ScoutedProject | null;
      })
    | null;
  topModule: ProductizedModule | null;
}
