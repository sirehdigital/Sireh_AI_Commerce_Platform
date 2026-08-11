import type {
  AnalysedPerformanceMetric,
  PerformanceComparisonBasis,
  PerformanceComparisonResult,
  PerformanceEvidenceObservation,
  PerformanceMetricName,
  SuziDianaHandoff,
  SuziPerformanceAnalysisInput,
  SuziPerformanceContribution,
} from "../domain/suzi-performance-analysis.model.js";
import {
  SUZI_PERFORMANCE_VERSION,
  SuziPerformanceError,
} from "../domain/suzi-performance-analysis.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import type { MarketingArtifactReference } from "../domain/marketing-team.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

const PRODUCTION_REQUEST = /pause|resume|change budget|change targeting|replace creative|publish|schedule|credential|execute/iu;
const DERIVATIONS: Readonly<Record<string, { numerator: PerformanceMetricName; denominator: PerformanceMetricName; multiplier: number }>> = {
  CTR: { numerator: "CLICKS", denominator: "IMPRESSIONS", multiplier: 100 },
  CPC: { numerator: "SPEND", denominator: "CLICKS", multiplier: 1 },
  CPM: { numerator: "SPEND", denominator: "IMPRESSIONS", multiplier: 1000 },
  CPA: { numerator: "SPEND", denominator: "CONVERSIONS", multiplier: 1 },
  ROAS: { numerator: "REVENUE", denominator: "SPEND", multiplier: 1 },
  FREQUENCY: { numerator: "IMPRESSIONS", denominator: "REACH", multiplier: 1 },
};

export class SuziPerformanceAnalysisService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const suzi = registry.get("SUZI");
    if (suzi.role !== "MARKETING_PERFORMANCE_ANALYST" || suzi.systemLayer !== "CODEX_SACP_SAIE" || suzi.productionExecutionAllowed !== false)
      throw new SuziPerformanceError("SUZI_IDENTITY_INVALID", "SUZI governance identity is invalid.");
  }
  public analyse(input: SuziPerformanceAnalysisInput): SuziPerformanceContribution {
    required(input.teamRunId, "teamRunId"); required(input.correlationId, "correlationId");
    if (input.assignment.assignedPersona !== "SUZI") throw new SuziPerformanceError("SUZI_ASSIGNMENT_INVALID", "SUZI requires a SUZI assignment.");
    if (input.assignment.dependencies.length > 0) throw new SuziPerformanceError("SUZI_DEPENDENCY_INVALID", "SUZI has no predecessor in PERFORMANCE_REVIEW.");
    validatePeriod(input.analysisPeriod.startAt, input.analysisPeriod.endAt);
    input.observations.forEach(validateObservation);
    const observedMetrics = input.observations.flatMap((observation) => observation.metrics.map((metric) => ({
      ...metric, observationId: observation.observationId, channel: observation.channel,
      ...(observation.currency === undefined ? {} : { currency: observation.currency }),
      evidenceReferences: metric.evidenceReferences.map((item) => ({ ...item })),
      origin: "OBSERVED_SUPPLIED" as const, inputsUsed: [] as readonly PerformanceMetricName[],
    })));
    const derivedMetrics = input.observations.flatMap((observation) => derive(observation));
    const allMetrics = [...observedMetrics, ...derivedMetrics];
    const comparisons = input.comparisonBases.map((basis) => compare(basis, input.observations, allMetrics));
    const missingData = observedMetrics.filter((metric) => metric.dataState === "NOT_AVAILABLE" || metric.value === undefined).map((metric) => `${metric.observationId}:${metric.name}: DATA_NOT_AVAILABLE`);
    const dataQualityIssues: string[] = [];
    if (input.observations.length === 0) dataQualityIssues.push("No performance observations were supplied.");
    if (input.trackingContext.length === 0) dataQualityIssues.push("Tracking context is missing.");
    if (input.measurementContext.length === 0) dataQualityIssues.push("Measurement context is missing.");
    if (input.observations.some((item) => item.freshness === "STALE" || item.freshness === "UNKNOWN")) dataQualityIssues.push("Evidence is stale or has unknown freshness.");
    if (input.observations.some((item) => item.provenance.trim().length === 0)) dataQualityIssues.push("Evidence provenance is missing.");
    const currencies = new Set(input.observations.map((item) => item.currency).filter((item): item is string => item !== undefined));
    if (currencies.size > 1) dataQualityIssues.push("Multiple currencies are present and are not aggregated.");
    const escalationReasons = [...dataQualityIssues];
    if (input.constraints.some((item) => PRODUCTION_REQUEST.test(item))) escalationReasons.push("Execution, account mutation, credential, or production authority requires Founder governance.");
    const founderDecisionsRequired = escalationReasons.filter((item) => /Founder|currency|tracking|measurement/iu.test(item));
    const trendInterpretations = comparisons.map((item) => item.interpretation);
    return {
      contributionId: `${input.teamRunId}:contribution:suzi`, persona: "SUZI", role: "MARKETING_PERFORMANCE_ANALYST",
      teamRunId: input.teamRunId, correlationId: input.correlationId, analysisPeriod: { ...input.analysisPeriod },
      performanceSummary: `${input.observations.length} governed observation(s); ${observedMetrics.length} supplied metric(s); ${derivedMetrics.length} derived metric(s).`,
      evidenceCoverage: { observationCount: input.observations.length, supportedMetricCount: observedMetrics.filter((item) => item.value !== undefined && item.dataState !== "NOT_AVAILABLE").length, unavailableMetricCount: missingData.length },
      observedMetrics, derivedMetrics, comparisons, trendInterpretations,
      channelObservations: input.observations.map((item) => `${item.channel}: ${item.metrics.filter((metric) => metric.value !== undefined).length} supplied metric(s).`),
      campaignObservations: input.observations.filter((item) => item.campaignReference !== undefined).map((item) => `${item.observationId} is linked to campaign evidence.`),
      efficiencyObservations: describe(allMetrics, ["CPM", "CPC", "CPA", "ROAS"]),
      conversionRevenueObservations: describe(allMetrics, ["CONVERSIONS", "REVENUE", "CONVERSION_RATE"]),
      measurementHealthObservations: dataQualityIssues.length === 0 ? ["Supplied measurement context is complete for descriptive analysis."] : [...dataQualityIssues],
      anomalies: comparisons.filter((item) => item.trend === "IMPROVED" || item.trend === "DECLINED").map((item) => `${item.metric}: observed ${item.trend.toLowerCase()} relative to supplied ${item.basis.toLowerCase()}; cause is not established.`),
      dataQualityIssues, missingData,
      assumptions: observedMetrics.filter((item) => item.dataState === "ASSUMED").map((item) => `${item.observationId}:${item.name} is supplied as assumed.`),
      risks: [...dataQualityIssues, ...missingData],
      limitations: ["No live data was fetched.", "No causal or statistical-significance claim is made.", "Metrics are not judged without a governed comparison basis."],
      alternativeExplanations: ["Observed changes may reflect tracking, period, audience, creative, offer, or platform factors; further evidence is required."],
      recommendedInvestigations: dataQualityIssues.map((item) => `Investigate: ${item}`),
      conditionalOptimizationRecommendations: ["DIANA may consider optimization only after evidence, measurement compatibility, and Founder governance are confirmed."],
      founderDecisionsRequired, escalationReasons,
      reviewState: input.observations.length === 0 ? "BLOCKED" : escalationReasons.length > 0 || missingData.length > 0 ? "REVIEW_REQUIRED" : "READY",
      attributionVersion: SUZI_PERFORMANCE_VERSION, executionAllowed: false,
    };
  }
  public prepareDianaHandoff(value: SuziPerformanceContribution): SuziDianaHandoff {
    return { handoffId: `${value.teamRunId}:handoff:suzi-diana`, teamRunId: value.teamRunId, correlationId: value.correlationId,
      analysisPeriod: { ...value.analysisPeriod }, suziContribution: structuredClone(value), evidenceReferences: dedupe([...value.observedMetrics, ...value.derivedMetrics].flatMap((item) => item.evidenceReferences)),
      observedMetrics: structuredClone(value.observedMetrics), derivedMetrics: structuredClone(value.derivedMetrics), comparisonBasis: structuredClone(value.comparisons), trends: [...value.trendInterpretations], missingData: [...value.missingData], assumptions: [...value.assumptions], risks: [...value.risks], measurementLimitations: [...value.limitations], founderDecisionsRequired: [...value.founderDecisionsRequired], reviewState: value.reviewState, fromPersona: "SUZI", toPersona: "DIANA", executionAllowed: false };
  }
  public toSpecialistContribution(value: SuziPerformanceContribution): SpecialistContribution {
    return { contributionId: value.contributionId, persona: "SUZI", summary: value.performanceSummary, recommendation: value.conditionalOptimizationRecommendations.join(" "), assumptions: [...value.assumptions], risks: [...value.risks], confidence: value.reviewState === "READY" ? "HIGH" : value.reviewState === "BLOCKED" ? "LOW" : "MEDIUM", evidence: dedupe([...value.observedMetrics, ...value.derivedMetrics].flatMap((item) => item.evidenceReferences)), dependencies: [], reviewState: value.reviewState === "READY" ? "PASSED" : value.reviewState === "BLOCKED" ? "BLOCKED" : "PENDING" };
  }
  public execute(): never { throw new SuziPerformanceError("PRODUCTION_EXECUTION_PROHIBITED", "SUZI cannot publish, mutate, execute production actions, access credentials, or approve for Founder."); }
}

function derive(observation: PerformanceEvidenceObservation): readonly AnalysedPerformanceMetric[] {
  const supplied = new Map(observation.metrics.map((item) => [item.name, item]));
  const result: AnalysedPerformanceMetric[] = [];
  for (const [name, rule] of Object.entries(DERIVATIONS) as [PerformanceMetricName, (typeof DERIVATIONS)[string]][]) {
    if (supplied.has(name)) continue;
    const numerator = supplied.get(rule.numerator); const denominator = supplied.get(rule.denominator);
    const valid = numerator?.value !== undefined && denominator?.value !== undefined && denominator.value !== 0 && numerator.dataState !== "NOT_AVAILABLE" && denominator.dataState !== "NOT_AVAILABLE";
    result.push({ name, ...(valid ? { value: round(numerator.value / denominator.value * rule.multiplier) } : {}), dataState: valid ? "SUPPORTED_BY_EVIDENCE" : "NOT_AVAILABLE", observationId: observation.observationId, channel: observation.channel, ...(observation.currency === undefined ? {} : { currency: observation.currency }), evidenceReferences: valid ? dedupe([...numerator.evidenceReferences, ...denominator.evidenceReferences]) : [], origin: "DERIVED", inputsUsed: [rule.numerator, rule.denominator] });
  }
  if (!supplied.has("CONVERSION_RATE")) {
    const conversions = supplied.get("CONVERSIONS"); const denominator = supplied.get("LANDING_PAGE_VIEWS") ?? supplied.get("CLICKS");
    const valid = conversions?.value !== undefined && denominator?.value !== undefined && denominator.value !== 0 && conversions.dataState !== "NOT_AVAILABLE" && denominator.dataState !== "NOT_AVAILABLE";
    result.push({ name: "CONVERSION_RATE", ...(valid ? { value: round(conversions.value / denominator.value * 100) } : {}), dataState: valid ? "SUPPORTED_BY_EVIDENCE" : "NOT_AVAILABLE", observationId: observation.observationId, channel: observation.channel, ...(observation.currency === undefined ? {} : { currency: observation.currency }), evidenceReferences: valid ? dedupe([...conversions.evidenceReferences, ...denominator.evidenceReferences]) : [], origin: "DERIVED", inputsUsed: denominator === undefined ? [] : ["CONVERSIONS", denominator.name] });
  }
  return result;
}
function compare(basis: PerformanceComparisonBasis, observations: readonly PerformanceEvidenceObservation[], metrics: readonly AnalysedPerformanceMetric[]): PerformanceComparisonResult {
  const current = metrics.find((item) => item.observationId === basis.currentObservationId && item.name === basis.metric && item.value !== undefined);
  const referenceMetric = basis.referenceObservationId === undefined ? undefined : metrics.find((item) => item.observationId === basis.referenceObservationId && item.name === basis.metric && item.value !== undefined);
  const referenceValue = basis.referenceValue ?? referenceMetric?.value;
  const currentObservation = observations.find((item) => item.observationId === basis.currentObservationId);
  const referenceObservation = basis.referenceObservationId === undefined ? undefined : observations.find((item) => item.observationId === basis.referenceObservationId);
  const compatible = current !== undefined && referenceValue !== undefined && (basis.referenceCurrency === undefined || current.currency === undefined || basis.referenceCurrency === current.currency) && (referenceObservation === undefined || currentObservation === undefined || (referenceObservation.period.attributionWindow === currentObservation.period.attributionWindow && referenceObservation.period.measurementDefinition === currentObservation.period.measurementDefinition && referenceObservation.currency === currentObservation.currency && periodDuration(referenceObservation.period.startAt, referenceObservation.period.endAt) === periodDuration(currentObservation.period.startAt, currentObservation.period.endAt)));
  let trend: PerformanceComparisonResult["trend"] = "INSUFFICIENT_DATA";
  if (compatible && current.value === referenceValue) trend = "STABLE";
  else if (compatible && basis.favorableDirection !== undefined) trend = current.value! > referenceValue === (basis.favorableDirection === "HIGHER_IS_BETTER") ? "IMPROVED" : "DECLINED";
  const interpretation = compatible ? `${basis.metric} is ${trend === "INSUFFICIENT_DATA" ? "different" : trend.toLowerCase()} relative to the supplied ${basis.basis.toLowerCase()} basis; no cause is inferred.` : `${basis.metric} comparison has insufficient or incompatible data.`;
  return { comparisonId: basis.comparisonId, metric: basis.metric, basis: basis.basis, ...(current?.value === undefined ? {} : { actualValue: current.value }), ...(referenceValue === undefined ? {} : { referenceValue }), trend, interpretation, evidenceReferences: basis.evidenceReferences.map((item) => ({ ...item })) };
}
function validateObservation(value: PerformanceEvidenceObservation): void { required(value.observationId, "observationId"); required(value.channel, "channel"); required(value.provenance, "provenance"); validatePeriod(value.period.startAt, value.period.endAt); strictIso(value.observedAt); if (value.currency !== undefined && !/^[A-Z]{3}$/u.test(value.currency)) throw new SuziPerformanceError("CURRENCY_INVALID", "Currency must be a three-letter uppercase code."); for (const metric of value.metrics) if (metric.value !== undefined && (!Number.isFinite(metric.value) || metric.value < 0)) throw new SuziPerformanceError("METRIC_INVALID", `${metric.name} must be finite and non-negative.`); }
function validatePeriod(startAt: string, endAt: string): void { strictIso(startAt); strictIso(endAt); if (new Date(startAt) > new Date(endAt)) throw new SuziPerformanceError("PERIOD_INVALID", "Performance period start must not be after end."); }
function strictIso(value: string): void { const parsed = new Date(value); if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) throw new SuziPerformanceError("TIMESTAMP_INVALID", "Timestamp must be strict ISO UTC."); }
function required(value: string, field: string): void { if (value.trim().length === 0) throw new SuziPerformanceError("REQUIRED_FIELD_MISSING", `${field} is required.`); }
function round(value: number): number { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
function periodDuration(startAt: string, endAt: string): number { return new Date(endAt).valueOf() - new Date(startAt).valueOf(); }
function dedupe(values: readonly MarketingArtifactReference[]): readonly MarketingArtifactReference[] { return [...new Map(values.map((item) => [`${item.artifactType}:${item.artifactId}:${item.version}`, item])).values()].map((item) => ({ ...item })); }
function describe(metrics: readonly AnalysedPerformanceMetric[], names: readonly PerformanceMetricName[]): readonly string[] { return metrics.filter((item) => names.includes(item.name) && item.value !== undefined).map((item) => `${item.channel} ${item.name}: ${String(item.value)} (${item.origin.toLowerCase()}; descriptive only).`); }
