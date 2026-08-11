import type { PaidMediaDataState } from "./diana-paid-media.model.js";
import type {
  FounderMarketingObjectiveIntake,
  SpecialistAssignment,
  SpecialistContribution,
} from "./miss-hermes-director.model.js";
import type { MarketingArtifactReference } from "./marketing-team.model.js";

export const SUZI_PERFORMANCE_VERSION = "MARKETING-TEAM-01F";
export const PERFORMANCE_METRICS = [
  "IMPRESSIONS", "REACH", "FREQUENCY", "CLICKS", "LANDING_PAGE_VIEWS", "SPEND",
  "CONVERSIONS", "REVENUE", "CPM", "CPC", "CTR", "CPA", "ROAS", "CONVERSION_RATE",
] as const;
export type PerformanceMetricName = (typeof PERFORMANCE_METRICS)[number];
export type PerformanceMetricOrigin = "OBSERVED_SUPPLIED" | "DERIVED";
export type PerformanceTrend = "IMPROVED" | "DECLINED" | "STABLE" | "INSUFFICIENT_DATA";
export type PerformanceFreshness = "CURRENT" | "AGING" | "STALE" | "UNKNOWN";

export interface PerformancePeriod {
  readonly startAt: string;
  readonly endAt: string;
  readonly attributionWindow: string;
  readonly measurementDefinition: string;
}
export interface SuppliedPerformanceMetric {
  readonly name: PerformanceMetricName;
  readonly value?: number;
  readonly dataState: PaidMediaDataState;
  readonly evidenceReferences: readonly MarketingArtifactReference[];
}
export interface PerformanceEvidenceObservation {
  readonly observationId: string;
  readonly channel: string;
  readonly campaignReference?: MarketingArtifactReference;
  readonly adSetReference?: MarketingArtifactReference;
  readonly adReference?: MarketingArtifactReference;
  readonly currency?: string;
  readonly period: PerformancePeriod;
  readonly observedAt: string;
  readonly freshness: PerformanceFreshness;
  readonly provenance: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly metrics: readonly SuppliedPerformanceMetric[];
}
export interface PerformanceComparisonBasis {
  readonly comparisonId: string;
  readonly metric: PerformanceMetricName;
  readonly basis: "PRIOR_PERIOD" | "FOUNDER_TARGET" | "CAMPAIGN_TARGET" | "APPROVED_PLAN" | "CHANNEL";
  readonly referenceValue?: number;
  readonly referenceCurrency?: string;
  readonly currentObservationId: string;
  readonly referenceObservationId?: string;
  readonly favorableDirection?: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  readonly evidenceReferences: readonly MarketingArtifactReference[];
}
export interface SuziPerformanceAnalysisInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly founderObjective: FounderMarketingObjectiveIntake;
  readonly analysisPeriod: PerformancePeriod;
  readonly observations: readonly PerformanceEvidenceObservation[];
  readonly comparisonBases: readonly PerformanceComparisonBasis[];
  readonly trackingContext: readonly string[];
  readonly measurementContext: readonly string[];
  readonly constraints: readonly string[];
}
export interface AnalysedPerformanceMetric extends SuppliedPerformanceMetric {
  readonly observationId: string;
  readonly channel: string;
  readonly currency?: string;
  readonly origin: PerformanceMetricOrigin;
  readonly inputsUsed: readonly PerformanceMetricName[];
}
export interface PerformanceComparisonResult {
  readonly comparisonId: string;
  readonly metric: PerformanceMetricName;
  readonly basis: PerformanceComparisonBasis["basis"];
  readonly actualValue?: number;
  readonly referenceValue?: number;
  readonly trend: PerformanceTrend;
  readonly interpretation: string;
  readonly evidenceReferences: readonly MarketingArtifactReference[];
}
export interface SuziPerformanceContribution {
  readonly contributionId: string;
  readonly persona: "SUZI";
  readonly role: "MARKETING_PERFORMANCE_ANALYST";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly analysisPeriod: PerformancePeriod;
  readonly performanceSummary: string;
  readonly evidenceCoverage: { readonly observationCount: number; readonly supportedMetricCount: number; readonly unavailableMetricCount: number };
  readonly observedMetrics: readonly AnalysedPerformanceMetric[];
  readonly derivedMetrics: readonly AnalysedPerformanceMetric[];
  readonly comparisons: readonly PerformanceComparisonResult[];
  readonly trendInterpretations: readonly string[];
  readonly channelObservations: readonly string[];
  readonly campaignObservations: readonly string[];
  readonly efficiencyObservations: readonly string[];
  readonly conversionRevenueObservations: readonly string[];
  readonly measurementHealthObservations: readonly string[];
  readonly anomalies: readonly string[];
  readonly dataQualityIssues: readonly string[];
  readonly missingData: readonly string[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly limitations: readonly string[];
  readonly alternativeExplanations: readonly string[];
  readonly recommendedInvestigations: readonly string[];
  readonly conditionalOptimizationRecommendations: readonly string[];
  readonly founderDecisionsRequired: readonly string[];
  readonly escalationReasons: readonly string[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly attributionVersion: typeof SUZI_PERFORMANCE_VERSION;
  readonly executionAllowed: false;
}
export interface SuziDianaHandoff {
  readonly handoffId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly analysisPeriod: PerformancePeriod;
  readonly suziContribution: SuziPerformanceContribution;
  readonly evidenceReferences: readonly MarketingArtifactReference[];
  readonly observedMetrics: readonly AnalysedPerformanceMetric[];
  readonly derivedMetrics: readonly AnalysedPerformanceMetric[];
  readonly comparisonBasis: readonly PerformanceComparisonResult[];
  readonly trends: readonly string[];
  readonly missingData: readonly string[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly measurementLimitations: readonly string[];
  readonly founderDecisionsRequired: readonly string[];
  readonly reviewState: SuziPerformanceContribution["reviewState"];
  readonly fromPersona: "SUZI";
  readonly toPersona: "DIANA";
  readonly executionAllowed: false;
}
export interface SuziContributionAdapter { readonly suzi: SpecialistContribution; }
export class SuziPerformanceError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SuziPerformanceError";
  }
}
