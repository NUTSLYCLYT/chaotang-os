export type ManorDomain =
  | 'legal'
  | 'hr'
  | 'finance'
  | 'ecommerce'
  | 'ops'
  | 'compliance'
  | 'sales'
  | 'marketing'
  | 'battery_pack'
  | 'supply-chain'
  | 'investment';

export interface ManorAnalyzeRequest {
  domain: ManorDomain;
  situation: string;
}

export interface ManorRiskItem {
  level: 'high' | 'medium' | 'low';
  title: string;
  mitigation: string;
}

export interface ManorActionCard {
  title: string;
  when: string;
  light: 'green' | 'yellow' | 'red';
  why?: string;
}

export interface LegalCitation {
  id: string;
  code: string;
  title: string;
  fullText: string;
}

export interface ManorAnalyzeResult {
  task_id: string;
  domain: ManorDomain;
  summary: string;
  requires_departments: string[];
  risks: ManorRiskItem[];
  action_cards: ManorActionCard[];
  citations?: LegalCitation[];
}
