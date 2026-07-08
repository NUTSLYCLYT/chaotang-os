/**
 * 朝堂 Console · feature types
 *
 * 严格对齐 docs/court-console/20-ARCHITECTURE.md §B2 Event schema v1
 */

export type PetitionStage = 'taizi' | 'zhongshu' | 'menxia' | 'shangshu' | 'liubu' | 'manor'

export type PetitionStation =
  | 'taizi'
  | 'zhongshu'
  | 'menxia'
  | 'shangshu'
  | 'gongbu'
  | 'bingbu'
  | 'xingbu'
  | 'hubu'
  | 'libu_hr'
  | 'libu_rites'
  | 'legal'
  | 'hr'
  | 'finance'
  | 'ecommerce'
  | 'ops'
  | 'compliance'

export type EventType = 'started' | 'committed' | 'aborted' | 'text_delta'

export type DecisionKind = 'approved' | 'rejected' | 'suspended' | 'forwarded'

/** 朝堂事件 v1 — 与 .openclaw XADD payload 严格对齐 */
export interface CourtEvent {
  event_id: string
  petition_id: string
  seq: number
  parent_event_id: string | null
  span_id: string
  stage: PetitionStage
  station: PetitionStation
  event_type: EventType
  status_kind: DecisionKind | null
  produced_at: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  cost_usd: number | null
  reasoning_ref: string | null
  redaction_version: string
  metadata?: Record<string, unknown>
}

/** 奏折当前状态（由事件流推导） */
export type PetitionStatus = 'submitted' | 'drafting' | 'reviewing' | 'suspended' | 'rejected' | 'executed'

export interface Petition {
  id: string
  summary: string
  submittedAt: string
  status: PetitionStatus
  currentStation: PetitionStation | null
  events: CourtEvent[]
}

export type LaunchTaskState =
  | 'draft'
  | 'submitted'
  | 'routing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type LaunchErrorClass =
  | 'input_error'
  | 'runtime_error'
  | 'capability_error'
  | 'render_error'

export interface CourtSubmission {
  request_id: string
  submitted_at: string
  scenario: 'legal_decision_flow'
  user_query: string
  context?: {
    company_name?: string
    case_type?: string
    urgency?: 'low' | 'medium' | 'high'
    attachments?: Array<{
      name: string
      type: string
      uri?: string
    }>
  }
}

export interface LegalCapabilityResponse {
  request_id: string
  task_state: Extract<LaunchTaskState, 'completed' | 'failed'>
  domain: PetitionStation | 'legal'
  summary: string
  risk_level?: 'low' | 'medium' | 'high'
  recommendations?: string[]
  attack_vectors?: string[]
  defense_vectors?: string[]
  next_actions?: string[]
  trace?: {
    manor: string
    started_at?: string
    completed_at?: string
  }
  error?: {
    class: LaunchErrorClass
    code: string
    message: string
  }
  raw_result?: Record<string, unknown>
}

export interface LaunchTaskRecord {
  requestId: string
  submittedAt: string
  updatedAt?: string
  userQuery: string
  domain: string
  taskState: LaunchTaskState
  summary?: string
  errorMessage?: string
  events: CourtEvent[]
  response?: LegalCapabilityResponse
}

export interface LaunchTaskHistoryResponse {
  records: LaunchTaskRecord[]
}

export interface LaunchHealthResponse {
  status: 'ok' | 'degraded'
  checked_at: string
  environment: 'demo' | 'internal' | 'pilot'
  store_scope?: string
  requires_confirmation: boolean
  capability_mode: 'mock' | 'real'
  services: {
    petitions_store: 'ready' | 'degraded'
    legal_agent: 'reachable' | 'mock' | 'degraded'
  }
  stats: {
    total_records: number
    completed_records: number
    failed_records: number
    failed_by_class?: Partial<Record<LaunchErrorClass, number>>
    last_recorded_at?: string
    storage_file?: string
  }
}
