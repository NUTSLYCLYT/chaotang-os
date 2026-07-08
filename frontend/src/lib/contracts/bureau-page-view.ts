import type {
  DepartmentCommandTone,
  DepartmentPageCanonicalCode,
  DepartmentRailSection,
  DepartmentRailTone,
} from '@/lib/contracts/department-page-view';
import type { EdictView } from '@/features/shangshufang/edict-content';

export type BureauDepartmentCode = DepartmentPageCanonicalCode;

export type BureauDataMode = 'live' | 'partial' | 'fallback' | 'skeleton';

export type BureauActionIntent =
  | 'approve'
  | 'block'
  | 'request_evidence'
  | 'handoff'
  | 'recheck'
  | 'archive';

export interface BureauIdentity {
  department: BureauDepartmentCode;
  bureau: string;
  name: string;
  alias?: string[];
  role: string;
  scope: string;
  accent: string;
  accentSoft: string;
  background?: string;
  seal: EdictView['seal'];
}

export interface BureauHeader {
  title: string;
  subtitle: string;
  userQuestion: string;
  verdict: string;
  verdictTone: DepartmentRailTone;
  blockedValue: string;
}

export interface BureauAction {
  id: string;
  label: string;
  intent: BureauActionIntent;
  tone?: DepartmentCommandTone;
  target?: {
    department?: BureauDepartmentCode;
    bureau?: string;
    ownerId?: string;
  };
  evidenceRequired?: string[];
  disabledReason?: string;
}

export interface BureauDataIntegrity {
  mode: BureauDataMode;
  sourceLabel: string;
  missing: Array<{
    field: string;
    label: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  disclaimers: string[];
}

export interface BureauPageView {
  viewId: string;
  generatedAt: string;
  bureau: BureauIdentity;
  header: BureauHeader;
  dataMode: BureauDataMode;
  leftRail: DepartmentRailSection[];
  mainEdict: EdictView;
  rightRail: DepartmentRailSection[];
  actions: BureauAction[];
  integrity: BureauDataIntegrity;
}
