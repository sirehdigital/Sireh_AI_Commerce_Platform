import { describe, expect, it } from "vitest";
import { MarketingAgent } from "../../saie/agents/marketing/index.js";
import {
  MarketingTeamAgentRegistry,
  MissHermesDirectorService,
  SuziPerformanceAnalysisService,
  type FounderMarketingObjectiveIntake,
  type PerformanceEvidenceObservation,
  type SuziPerformanceAnalysisInput,
} from "../index.js";

const START = "2026-08-01T00:00:00.000Z";
const END = "2026-08-07T23:59:59.000Z";
const source = { artifactId: "report-1", artifactType: "PERFORMANCE_REPORT", version: "1" } as const;
const objective = (): FounderMarketingObjectiveIntake => ({
  objectiveId: "objective-perf", objective: "Review governed campaign performance.", sourceReference: source,
  targetMarkets: ["MY"], channels: ["META"], budgetConstraints: [], campaignConstraints: [],
  requestedOutputs: ["PERFORMANCE_REVIEW"], timingContext: "Weekly", riskRequirements: [],
  reviewRequirements: ["MISS_HERMES"], receivedAt: END, receivedBy: "MISS_HERMES",
});
const period = { startAt: START, endAt: END, attributionWindow: "7_DAY_CLICK", measurementDefinition: "LAST_TOUCH" } as const;
const observation = (overrides: Partial<PerformanceEvidenceObservation> = {}): PerformanceEvidenceObservation => ({
  observationId: "current", channel: "META", campaignReference: { artifactId: "campaign-1", artifactType: "CAMPAIGN", version: "1" },
  currency: "MYR", period, observedAt: END, freshness: "CURRENT", provenance: "FOUNDER_SUPPLIED_REPORT",
  sourceReferences: [source], metrics: [
    { name: "IMPRESSIONS", value: 10000, dataState: "SUPPORTED_BY_EVIDENCE", evidenceReferences: [source] },
    { name: "REACH", value: 8000, dataState: "SUPPORTED_BY_EVIDENCE", evidenceReferences: [source] },
    { name: "CLICKS", value: 200, dataState: "KNOWN", evidenceReferences: [source] },
    { name: "LANDING_PAGE_VIEWS", value: 160, dataState: "KNOWN", evidenceReferences: [source] },
    { name: "SPEND", value: 500, dataState: "KNOWN", evidenceReferences: [source] },
    { name: "CONVERSIONS", value: 20, dataState: "KNOWN", evidenceReferences: [source] },
    { name: "REVENUE", value: 1500, dataState: "KNOWN", evidenceReferences: [source] },
  ], ...overrides,
});
const input = (overrides: Partial<SuziPerformanceAnalysisInput> = {}): SuziPerformanceAnalysisInput => {
  const assignment = new MissHermesDirectorService().createDelegationPlan("run-perf", "corr-perf", objective()).assignments.find((item) => item.assignedPersona === "SUZI");
  if (assignment === undefined) throw new Error("Missing SUZI assignment.");
  return { teamRunId: "run-perf", correlationId: "corr-perf", assignment, founderObjective: objective(), analysisPeriod: period,
    observations: [observation()], comparisonBases: [], trackingContext: ["Pixel validated"], measurementContext: ["Last-touch attribution"], constraints: [], ...overrides };
};
const analyse = (overrides: Partial<SuziPerformanceAnalysisInput> = {}) => new SuziPerformanceAnalysisService().analyse(input(overrides));
const derived = (name: string, overrides: Partial<SuziPerformanceAnalysisInput> = {}) => analyse(overrides).derivedMetrics.find((item) => item.name === name);

describe("SUZI Marketing Performance Analyst", () => {
  it("has the sealed identity", () => expect(new MarketingTeamAgentRegistry().get("SUZI")).toMatchObject({ personaName: "SUZI", role: "MARKETING_PERFORMANCE_ANALYST", systemLayer: "CODEX_SACP_SAIE" }));
  it("has no production execution authority", () => expect(new MarketingTeamAgentRegistry().get("SUZI").productionExecutionAllowed).toBe(false));
  it("returns executionAllowed false", () => expect(analyse().executionAllowed).toBe(false));
  it("enforces execute never", () => expect(() => new SuziPerformanceAnalysisService().execute()).toThrowError("SUZI cannot publish, mutate, execute production actions, access credentials, or approve for Founder."));
  it("accepts valid governed input", () => expect(analyse().reviewState).toBe("READY"));
  it("preserves supplied metrics", () => expect(analyse().observedMetrics.find((item) => item.name === "SPEND")).toMatchObject({ value: 500, origin: "OBSERVED_SUPPLIED" }));
  it("derives CTR", () => expect(derived("CTR")?.value).toBe(2));
  it("derives CPC", () => expect(derived("CPC")?.value).toBe(2.5));
  it("derives CPM", () => expect(derived("CPM")?.value).toBe(50));
  it("derives CPA", () => expect(derived("CPA")?.value).toBe(25));
  it("derives ROAS", () => expect(derived("ROAS")?.value).toBe(3));
  it("derives frequency", () => expect(derived("FREQUENCY")?.value).toBe(1.25));
  it("derives conversion rate from landing-page views", () => expect(derived("CONVERSION_RATE")).toMatchObject({ value: 12.5, inputsUsed: ["CONVERSIONS", "LANDING_PAGE_VIEWS"] }));
  it("never divides by zero", () => { const result = derived("CTR", { observations: [observation({ metrics: [{ name: "IMPRESSIONS", value: 0, dataState: "KNOWN", evidenceReferences: [source] }, { name: "CLICKS", value: 2, dataState: "KNOWN", evidenceReferences: [source] }] })] }); expect(result).toMatchObject({ dataState: "NOT_AVAILABLE" }); expect(result).not.toHaveProperty("value"); });
  it("marks missing denominators unavailable", () => expect(derived("CPC", { observations: [observation({ metrics: [{ name: "SPEND", value: 10, dataState: "KNOWN", evidenceReferences: [source] }] })] })).toMatchObject({ dataState: "NOT_AVAILABLE" }));
  it("does not manufacture revenue or conversions", () => { const result = analyse({ observations: [observation({ metrics: [{ name: "SPEND", value: 10, dataState: "KNOWN", evidenceReferences: [source] }] })] }); expect(result.observedMetrics.some((item) => item.name === "REVENUE" || item.name === "CONVERSIONS")).toBe(false); });
  it("preserves currency", () => expect(derived("CPC")?.currency).toBe("MYR"));
  it("flags incompatible currencies without aggregation", () => { const second = observation({ observationId: "prior", currency: "USD" }); expect(analyse({ observations: [observation(), second] }).dataQualityIssues).toContain("Multiple currencies are present and are not aggregated."); });
  it("preserves explicit data states", () => expect(analyse().observedMetrics.map((item) => item.dataState)).toContain("SUPPORTED_BY_EVIDENCE"));
  it("does not fabricate unavailable metric values", () => { const result = analyse({ observations: [observation({ metrics: [{ name: "ROAS", dataState: "NOT_AVAILABLE", evidenceReferences: [] }] })] }); expect(result.observedMetrics[0]).not.toHaveProperty("value"); });
  it("does not overwrite a supplied calculated metric", () => { const result = analyse({ observations: [observation({ metrics: [...observation().metrics, { name: "CTR", value: 9, dataState: "KNOWN", evidenceReferences: [source] }] })] }); expect(result.observedMetrics.find((item) => item.name === "CTR")?.value).toBe(9); expect(result.derivedMetrics.some((item) => item.name === "CTR")).toBe(false); });
  it("compares current and prior periods", () => { const prior = observation({ observationId: "prior", metrics: observation().metrics.map((item) => item.name === "CLICKS" ? { ...item, value: 100 } : item) }); const result = analyse({ observations: [observation(), prior], comparisonBases: [{ comparisonId: "cmp", metric: "CLICKS", basis: "PRIOR_PERIOD", currentObservationId: "current", referenceObservationId: "prior", favorableDirection: "HIGHER_IS_BETTER", evidenceReferences: [source] }] }); expect(result.comparisons[0]?.trend).toBe("IMPROVED"); });
  it("compares against a Founder target", () => expect(analyse({ comparisonBases: [{ comparisonId: "target", metric: "ROAS", basis: "FOUNDER_TARGET", currentObservationId: "current", referenceValue: 2, referenceCurrency: "MYR", favorableDirection: "HIGHER_IS_BETTER", evidenceReferences: [source] }] }).comparisons[0]?.trend).toBe("IMPROVED"));
  it("reports insufficient comparison data", () => expect(analyse({ comparisonBases: [{ comparisonId: "missing", metric: "CPA", basis: "CAMPAIGN_TARGET", currentObservationId: "current", evidenceReferences: [] }] }).comparisons[0]?.trend).toBe("INSUFFICIENT_DATA"));
  it("rejects fundamentally different comparison periods", () => { const prior = observation({ observationId: "prior", period: { ...period, endAt: "2026-08-03T23:59:59.000Z" } }); const result = analyse({ observations: [observation(), prior], comparisonBases: [{ comparisonId: "period", metric: "CLICKS", basis: "PRIOR_PERIOD", currentObservationId: "current", referenceObservationId: "prior", favorableDirection: "HIGHER_IS_BETTER", evidenceReferences: [source] }] }); expect(result.comparisons[0]?.trend).toBe("INSUFFICIENT_DATA"); });
  it("does not judge metrics without a basis", () => expect(analyse().efficiencyObservations.join(" ")).toContain("descriptive only"));
  it("does not claim unsupported causality", () => expect(analyse({ comparisonBases: [{ comparisonId: "target", metric: "ROAS", basis: "FOUNDER_TARGET", currentObservationId: "current", referenceValue: 4, favorableDirection: "HIGHER_IS_BETTER", evidenceReferences: [source] }] }).anomalies[0]).toContain("cause is not established"));
  it("escalates missing tracking context", () => expect(analyse({ trackingContext: [] }).escalationReasons).toContain("Tracking context is missing."));
  it("flags stale evidence", () => expect(analyse({ observations: [observation({ freshness: "STALE" })] }).dataQualityIssues).toContain("Evidence is stale or has unknown freshness."));
  it("records measurement limitations", () => expect(analyse().limitations).toContain("No live data was fetched."));
  it("escalates production authority to Founder governance", () => expect(analyse({ constraints: ["pause campaign and change budget"] }).escalationReasons).toContain("Execution, account mutation, credential, or production authority requires Founder governance."));
  it("keeps optimization recommendations conditional", () => expect(analyse().conditionalOptimizationRecommendations[0]).toContain("only after"));
  it("prepares a non-executable DIANA handoff", () => expect(new SuziPerformanceAnalysisService().prepareDianaHandoff(analyse())).toMatchObject({ fromPersona: "SUZI", toPersona: "DIANA", teamRunId: "run-perf", correlationId: "corr-perf", executionAllowed: false }));
  it("converts to SpecialistContribution", () => expect(new SuziPerformanceAnalysisService().toSpecialistContribution(analyse())).toMatchObject({ persona: "SUZI", reviewState: "PASSED" }));
  it("preserves exact PERFORMANCE_REVIEW route", () => expect(new MissHermesDirectorService().createDelegationPlan("run-perf", "corr-perf", objective()).assignments.map((item) => item.assignedPersona)).toEqual(["SUZI", "DIANA", "MISS_HERMES"]));
  it("does not force other specialists into PERFORMANCE_REVIEW", () => expect(new MissHermesDirectorService().createDelegationPlan("run-perf", "corr-perf", objective()).assignments.map((item) => item.assignedPersona)).not.toEqual(expect.arrayContaining(["MAYA", "ARIA", "LUNA", "LYLA", "MIRA"])));
  it("has no external execution surface", () => expect(Object.getOwnPropertyNames(SuziPerformanceAnalysisService.prototype)).toEqual(["constructor", "analyse", "prepareDianaHandoff", "toSpecialistContribution", "execute"]));
  it("does not impersonate Founder", () => expect(analyse()).not.toHaveProperty("approvedByFounder"));
  it("preserves SAIE MarketingAgent compatibility", () => expect(new MarketingAgent().definition).toMatchObject({ type: "MarketingAgent" }));
  it("rejects invalid currency", () => expect(() => analyse({ observations: [observation({ currency: "Ringgit" })] })).toThrowError("Currency must be a three-letter uppercase code."));
  it("rejects negative metrics", () => expect(() => analyse({ observations: [observation({ metrics: [{ name: "SPEND", value: -1, dataState: "KNOWN", evidenceReferences: [source] }] })] })).toThrowError("SPEND must be finite and non-negative."));
  it("blocks empty evidence gracefully", () => expect(analyse({ observations: [] }).reviewState).toBe("BLOCKED"));
});
