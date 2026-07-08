import type { AgentCode } from './agent';
export interface Citation { source: string; snippet: string; score: number }
export interface RecommendedCategory {
  id: string; label: string; description: string; taskType: string;
  ministers: AgentCode[]; groups: string[]; confidence: number; citations: Citation[];
}
export interface DecreeDraft {
  draft: string; intent: string; recommendedCategories: RecommendedCategory[];
  source: 'llm' | 'rule';
}
export interface CategorySelection { taskType: string; ministers: AgentCode[]; groups: string[]; label?: string }
export interface DispatchBody {
  rawCommand: string; intent: string; selectedCategories: CategorySelection[];
  councilAll?: boolean; mode?: 'scripted' | 'hybrid' | 'live';
  budget?: { maxCalls?: number; maxCostUsd?: number; maxSubagentsPerGroup?: number };
}
export interface DispatchResult {
  taskId: string; status: string; acceptedAt: string; streamUrl: string;
  intent: string; taskType: string; ministers: AgentCode[]; groups: string[];
}
