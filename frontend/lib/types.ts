export interface Show {
  show_id: string
  artist_name: string
  city: string
  venue: string
  show_time: string      // ISO 8601 datetime string
  timezone: string
  capacity: number
  tickets_total: number
  tickets_sold: number
  currency: string
  ticket_base_url: string | null
}

export interface Cycle {
  cycle_id: string
  show_id: string
  started_at: string
  label: string | null
}

export type ReviewStatus = 'draft' | 'approved' | 'rejected'

export interface Segment {
  segment_id: string
  show_id: string
  cycle_id: string | null
  name: string
  definition_json: Record<string, unknown>
  estimated_size: number | null
  created_by: string
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Frame {
  frame_id: string
  show_id: string
  segment_id: string
  cycle_id: string | null
  hypothesis: string
  promise: string
  evidence_refs: Record<string, unknown>[]
  channel: string
  risk_notes: string | null
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Variant {
  variant_id: string
  frame_id: string
  cycle_id: string | null
  platform: string
  hook: string
  body: string
  cta: string
  constraints_passed: boolean
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Experiment {
  experiment_id: string
  show_id: string
  segment_id: string
  frame_id: string
  cycle_id: string | null
  channel: string
  objective: string
  budget_cap_cents: number
  status: ExperimentStatus
  start_time: string | null
  end_time: string | null
  baseline_snapshot: Record<string, unknown>
}

export type ExperimentStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'running'
  | 'completed'
  | 'stopped'
  | 'archived'

export interface Observation {
  observation_id: string
  experiment_id: string
  window_start: string
  window_end: string
  spend_cents: number
  impressions: number
  clicks: number
  sessions: number
  checkouts: number
  purchases: number
  revenue_cents: number
  refunds: number
  refund_cents: number
  complaints: number
  negative_comment_rate: number | null
  attribution_model: string
}

export interface Decision {
  decision_id: string
  experiment_id: string
  action: 'scale' | 'hold' | 'kill'
  confidence: number
  rationale: string
  policy_version: string
  metrics_snapshot: Record<string, unknown>
}

export interface ExperimentMetrics {
  experiment_id: string
  total_spend_cents: number
  total_impressions: number
  total_clicks: number
  total_purchases: number
  total_revenue_cents: number
  windows_count: number
  ctr: number | null
  cpc_cents: number | null
  cpa_cents: number | null
  roas: number | null
  conversion_rate: number | null
  evidence_sufficient: boolean
}

export interface ProducerMemo {
  memo_id: string
  show_id: string
  cycle_id: string | null
  cycle_start: string
  cycle_end: string
  markdown: string
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface BackgroundJob {
  job_id: string
  job_type: string
  status: JobStatus
  show_id: string
  result_json: Record<string, unknown> | null
  error_message: string | null
  attempt_count: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface DomainEvent {
  event_id: string
  at: string
  show_id: string
  cycle_id: string | null
  type: string
  actor: string
  display: { title: string; subtitle: string }
  payload: Record<string, unknown>
}

export interface ApiError {
  status: number
  detail: string
}
