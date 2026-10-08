export type DispositionType = 'RESTOCK' | 'REFURBISH' | 'LIQUIDATE' | 'DISPOSE';

export const OFFICIAL_CONDITION_SCALE_LABEL = '[Official Challenge Condition Scale]';

export interface ConditionGradeDef {
  id: string;
  name: string;
  code: string;
  wearLevel: 'PRISTINE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  description: string;
}

export interface ConditionScaleConfig {
  scaleName: string;
  isOfficialScaleConfigured: boolean;
  grades: ConditionGradeDef[];
}

export type IntegrityStatus = 'LOW_CONCERN' | 'POTENTIAL_PRODUCT_SWAP' | 'MANUAL_REVIEW_REQUIRED';

export type IdentityStatus = 'MATCH' | 'POTENTIAL_MISMATCH' | 'UNVERIFIED';

export type CompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'CRITICAL_MISSING';

export type ImageCategory =
  | 'PACKAGE_EXTERIOR'
  | 'PACKAGE_INTERIOR'
  | 'MAIN_PRODUCT'
  | 'ACCESSORIES'
  | 'PRODUCT_LABEL'
  | 'SERIAL_NUMBER';

export interface InspectionImage {
  id: string;
  category: ImageCategory;
  name: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
  verified?: boolean;
}

export interface ProductDef {
  id: string;
  name: string;
  brand: string;
  category: string;
  model: string;
  sku: string;
  variant: string;
  color: string;
  imageUrl: string;
  msrp: number;
  expectedComponents: string[];
  physicalIdentifierLocation: string; // e.g., 'Inner headband slider' or 'Chassis bottom laser print'
  hardwareSignatures: string[];
}

export interface OrderRecord {
  orderId: string;
  returnId: string;
  customerName: string;
  purchaseDate: string;
  returnDate: string;
  product: ProductDef;
  serialNumber: string;
  returnReason: string;
  customerComments: string;
  preloadedImages?: InspectionImage[];
  scenarioType?: 'NORMAL' | 'BOX_SWAP' | 'MISSING_ACCESSORY' | 'PACKAGING_DAMAGE' | 'SEVERE_DAMAGE' | 'UNCLEAR_IMAGE' | 'SERIAL_MISMATCH';
}

export interface BoxVsDeviceComparison {
  expectedProduct: string;
  boxModel: string;
  deviceModel: string;
  boxSku: string;
  deviceSkuMatch: boolean;
  serialNumberConsistency: 'VERIFIED_MATCH' | 'MISMATCH_DETECTED' | 'UNREADABLE';
  hardwareFeatureConsistency: 'CONSISTENT' | 'DISCREPANCY_DETECTED';
  isProductMismatch: boolean; // Expected = Product A, Box = Product A, Returned Physical Product = Product B
  mismatchHeadline?: string; // "Potential Product Mismatch — Manual Review Required."
  evidenceNotes: string[];
}

export interface VisualEvidenceMarker {
  id: string;
  category: 'IDENTITY' | 'COMPLETENESS' | 'CONDITION' | 'INTEGRITY';
  label: string;
  box: { x: number; y: number; w: number; h: number }; // percentage coordinates
  description: string;
}

export interface AIIdentityResult {
  status: IdentityStatus;
  expectedProduct: string;
  detectedProduct: string;
  confidenceScore: number | null; // Never fabricate; null if unavailable
  evidence: string[];
  boxVsDeviceComparison: BoxVsDeviceComparison;
}

export interface AICompletenessResult {
  status: CompletenessStatus;
  expectedCount: number;
  detectedCount: number;
  missingCount: number;
  expectedComponents: string[];
  detectedComponents: string[];
  missingComponents: string[];
  evidence: string[];
}

export interface AIConditionDefect {
  type: string;
  location: string;
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY';
}

export interface AIConditionResult {
  scale: string; // "[Official Challenge Condition Scale]"
  result: string;
  wearLevel: 'PRISTINE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  defects: AIConditionDefect[];
  evidence: string[];
}

export interface AIIntegrityResult {
  status: IntegrityStatus;
  concernLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  skuMatch: boolean;
  barcodeMatch: boolean;
  serialMatch: boolean;
  visualProductMatch: boolean;
  boxDeviceConsistency: 'ALIGNED' | 'DISCREPANCY';
  flags: string[];
  recommendedAction: string;
}

export interface AIInspectionResult {
  identity: AIIdentityResult;
  completeness: AICompletenessResult;
  condition: AIConditionResult;
  integrity: AIIntegrityResult;
  visualEvidenceMarkers: VisualEvidenceMarker[];
  processingTimeMs: number;
  source: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  conditionCriteria: {
    identityMatch?: boolean;
    integrityStatus?: IntegrityStatus[];
    completenessStatus?: CompletenessStatus[];
    maxWearLevel?: 'PRISTINE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  };
  recommendedDisposition: DispositionType | 'MANUAL_REVIEW';
  priority: number;
  enabled: boolean;
}

export interface DecisionReason {
  point: string;
  type: 'PASS' | 'WARN' | 'FAIL' | 'INFO';
}

export interface DispositionRecommendation {
  disposition: DispositionType | 'MANUAL_REVIEW';
  appliedRuleId: string;
  ruleName: string;
  reasons: DecisionReason[];
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  user: string;
  result: string;
  details?: string;
}

export interface ReturnInspectionRecord {
  id: string;
  returnId: string;
  orderId: string;
  product: ProductDef;
  serialNumber: string;
  returnReason: string;
  inspectionDate: string;
  operator: string;
  images: InspectionImage[];
  aiAnalysis: AIInspectionResult;
  recommendation: DispositionRecommendation;
  finalDecision: DispositionType | 'MANUAL_REVIEW';
  overrideReason?: string;
  operatorNotes?: string;
  auditTrail: AuditEvent[];
  status: 'COMPLETED' | 'MANUAL_REVIEW' | 'HOLD';
}
