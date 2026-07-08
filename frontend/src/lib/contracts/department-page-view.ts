import type { EdictView } from '@/features/shangshufang/edict-content';

export type DepartmentPageCode = 'finance' | 'gongbu' | 'works' | 'personnel' | 'market' | 'ops' | 'legal';

export type DepartmentPageCanonicalCode = 'finance' | 'gongbu' | 'personnel' | 'market' | 'ops' | 'legal';

export type DepartmentPageStatusTone = 'idle' | 'processing' | 'risk' | 'pending_review' | 'done';

export type DepartmentRailTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

export type DepartmentRailKind =
  | 'metric_strip'
  | 'decision_list'
  | 'evidence_list'
  | 'risk_list'
  | 'blocked_value'
  | 'handoff_list'
  | 'timeline'
  | 'empty'
  | 'text';

export type DepartmentCommandTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

export interface DepartmentIdentity {
  code: DepartmentPageCanonicalCode;
  requestCode?: DepartmentPageCode;
  name: string;
  title: string;
  titleEn: string;
  accent: string;
  accentSoft: string;
  background?: string;
  seal: EdictView['seal'];
}

export interface DepartmentHeader {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryQuestion: string;
  status: {
    label: string;
    tone: DepartmentPageStatusTone;
  };
}

export interface DepartmentRailItem {
  id: string;
  label: string;
  value?: string;
  body?: string;
  details?: Array<{
    label: string;
    value: string;
  }>;
  tone?: DepartmentRailTone;
  meta?: string;
  actionId?: string;
  href?: string;
}

export interface DepartmentRailSection {
  id: string;
  title: string;
  subtitle?: string;
  kind: DepartmentRailKind;
  items: DepartmentRailItem[];
}

export interface DepartmentCommand {
  id: string;
  label: string;
  tone?: DepartmentCommandTone;
  href?: string;
  targetDepartment?: DepartmentPageCanonicalCode;
  disabledReason?: string;
}

export interface DepartmentEmptyState {
  title: string;
  body: string;
  actionLabel?: string;
}

export interface DepartmentDataIntegrity {
  mode: 'live' | 'partial' | 'fallback';
  sourceLabel: string;
  missing: Array<{
    field: string;
    label: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  disclaimers: string[];
}

export interface DepartmentPageView {
  viewId: string;
  generatedAt: string;
  department: DepartmentIdentity;
  header: DepartmentHeader;
  leftRail: DepartmentRailSection[];
  mainEdict: EdictView;
  rightRail: DepartmentRailSection[];
  commandBar: DepartmentCommand[];
  emptyState?: DepartmentEmptyState;
  integrity: DepartmentDataIntegrity;
}
