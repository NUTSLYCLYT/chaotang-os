export type BatteryChemistry = 'lfp' | 'ncm' | 'lto';
export type BatteryGrade = 'a' | 'a-' | 'b+';
export type AssuranceTier = 'verified' | 'priority' | 'escrow-plus';
export type ListingStatus = 'live' | 'reserved' | 'sold';
export type InquiryStatus = 'open' | 'quoted' | 'closed';
export type TradeOrderStatus =
  | 'awaiting_escrow'
  | 'awaiting_inspection'
  | 'ready_to_release'
  | 'in_dispute';
export type RiskSeverity = 'low' | 'medium' | 'high';

export interface SellerProfile {
  id: string;
  companyName: string;
  city: string;
  verified: boolean;
  assuranceTier: AssuranceTier;
  fulfillmentScore: number;
  monthlyCapacityKwh: number;
  complaintRate: number;
  leadTimeDays: number;
  specialties: string[];
}

export interface InspectionRecord {
  id: string;
  labName: string;
  inspectedAt: string;
  summary: string;
  capacityRetention: number;
  dcirMilliohm: number;
  sampleSize: number;
  attachments: string[];
}

export interface BatteryListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  chemistry: BatteryChemistry;
  grade: BatteryGrade;
  nominalCapacityAh: number;
  voltageV: number;
  availableQuantity: number;
  unit: 'cells' | 'modules';
  lotSize: number;
  priceCny: number;
  locationCity: string;
  sellerId: string;
  status: ListingStatus;
  tags: string[];
  cycleCount: number;
  createdAt: string;
  inspection: InspectionRecord;
}

export interface MarketOverview {
  liveListings: number;
  verifiedSellers: number;
  openInquiries: number;
  escrowCoverageRate: number;
  hotBrands: string[];
  averageLeadTimeDays: number;
}

export interface Inquiry {
  id: string;
  listingId: string;
  buyerCompany: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

export interface RiskFlag {
  id: string;
  type: string;
  severity: RiskSeverity;
  note: string;
}

export interface TradeOrder {
  id: string;
  listingId: string;
  buyerCompany: string;
  sellerId: string;
  quantity: number;
  totalAmountCny: number;
  escrowRatio: number;
  status: TradeOrderStatus;
  createdAt: string;
  riskFlags: RiskFlag[];
}

export interface BuyabilityReport {
  score: number;
  verdict: string;
  reasons: string[];
  risks: string[];
  suggestedActions: string[];
}

export interface PriceAssessment {
  referenceMin: number;
  referenceMax: number;
  currentPrice: number;
  premiumRate: number;
  comment: string;
}

export interface RecommendedTradeStructure {
  escrowRatio: number;
  paymentScheme: string;
  requiresInspection: boolean;
  splitDeliverySuggested: boolean;
}

export interface BatteryListingDetail {
  listing: BatteryListing;
  sellerProfile: SellerProfile;
  inspectionRecords: InspectionRecord[];
  buyabilityReport: BuyabilityReport;
  priceAssessment: PriceAssessment;
  riskFlags: RiskFlag[];
  recommendedTradeStructure: RecommendedTradeStructure;
  similarListings: BatteryListing[];
}

export interface TradeTimelineStep {
  key: 'created' | 'escrow' | 'inspection' | 'release';
  label: string;
  done: boolean;
  at?: string;
}

export interface TradeOrderDetail {
  id: string;
  status: TradeOrderStatus;
  listingTitle: string;
  buyerCompanyName: string;
  sellerCompanyName: string;
  quantity: number;
  unitPriceCny: number;
  totalAmountCny: number;
  escrowRatio: number;
  paymentScheme: string;
  timeline: TradeTimelineStep[];
  riskFlags: RiskFlag[];
}

export interface CreateInquiryInput {
  listingId: string;
  buyerCompany: string;
  message: string;
}

export interface CreateTradeOrderInput {
  listingId: string;
  buyerCompany: string;
  quantity: number;
}

export type OperatorActionLabel =
  | '转人工审核'
  | '联系卖家补件'
  | '标记待补资料'
  | '升级争议处理'
  | '催验货结果';

export interface CreateOperatorActionInput {
  entityType: 'listing' | 'trade_order';
  entityId: string;
  actionLabel: OperatorActionLabel;
  actorName: string;
  note?: string;
  sourceReason: string;
}

export interface OperatorActionLog {
  id: string;
  entityType: 'listing' | 'trade_order';
  entityId: string;
  actionLabel: OperatorActionLabel;
  actorName: string;
  note: string;
  sourceReason: string;
  result: string;
  createdAt: string;
}

export interface OperatorActionSummary {
  listingCount: number;
  tradeOrderCount: number;
  timeBuckets: Array<{
    date: string;
    count: number;
  }>;
  actionTimeBuckets: Array<{
    date: string;
    actionLabel: OperatorActionLabel;
    count: number;
  }>;
  sellerTimeBuckets: Array<{
    date: string;
    sellerName: string;
    count: number;
  }>;
  actionCounts: Array<{
    actionLabel: OperatorActionLabel;
    count: number;
  }>;
  actorCounts: Array<{
    actorName: string;
    count: number;
  }>;
  sellerCounts: Array<{
    sellerName: string;
    count: number;
  }>;
  sellerActionCounts: Array<{
    sellerName: string;
    actionLabel: OperatorActionLabel;
    count: number;
  }>;
}

export interface OperatorActionPage {
  items: OperatorActionLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: OperatorActionSummary;
}
