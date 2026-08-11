import { describe, expect, it } from "vitest";
import {
  AiCreativeIntelligenceService,
  CreativeIntelligencePipelineService,
  InMemoryCreativeIntelligenceRepository,
} from "../../ai-creative-intelligence/index.js";
import {
  CampaignStrategyPipelineService,
  type CreateCampaignStrategyRequest,
} from "../../ai-campaign-strategy/index.js";
import { MarketingAgent } from "../../saie/agents/marketing/index.js";
import {
  AriaCampaignStrategyService,
  DianaPaidMediaService,
  LylaCreativeStrategyService,
  MarketingTeamAgentRegistry,
  MissHermesDirectorService,
  type DianaPaidMediaInput,
  type FounderMarketingObjectiveIntake,
  type LylaCreativeStrategyInput,
  type SpecialistAssignment,
} from "../index.js";

const NOW = "2026-08-12T04:00:00.000Z";
const source = { artifactId: "product-200", artifactType: "PRODUCT", version: "1" } as const;
const evidence = { artifactId: "market-200", artifactType: "MARKET_EVIDENCE", version: "1" } as const;
const objective = (): FounderMarketingObjectiveIntake => ({
  objectiveId: "objective-200",
  objective: "Prepare paid-media recommendations.",
  sourceReference: source,
  targetMarkets: ["MY"],
  channels: ["META", "TIKTOK"],
  budgetConstraints: ["Founder envelope MYR 1000"],
  campaignConstraints: [],
  requestedOutputs: ["PAID_MEDIA_PLAN"],
  timingContext: "Next month",
  riskRequirements: [],
  reviewRequirements: ["MIRA"],
  receivedAt: NOW,
  receivedBy: "MISS_HERMES",
});
const assignment = (persona: SpecialistAssignment["assignedPersona"]): SpecialistAssignment => {
  const found = new MissHermesDirectorService()
    .createDelegationPlan("run-200", "correlation-200", objective())
    .assignments.find((item) => item.assignedPersona === persona);
  if (found === undefined) throw new Error(`Missing ${persona} assignment.`);
  return found;
};
const campaignRequest: CreateCampaignStrategyRequest = {
  product: {
    productId: "product-200", productName: "Glow Wand", category: "Beauty",
    description: "Compact styling tool.", keyBenefits: ["Fast styling"],
    differentiators: ["Portable"], knownRisks: [], markets: ["MY"],
  },
  objective: "PRODUCT_LAUNCH",
  audience: {
    id: "audience-200", name: "Shoppers", targetMarkets: ["MY"], interests: ["Beauty"],
    painPoints: ["Time"], desiredOutcomes: ["Fast styling"], objections: ["Trust"],
    buyingTriggers: ["Launch"], awarenessLevel: "SOLUTION_AWARE",
  },
  offer: { type: "STANDARD", headline: "Launch", terms: [] },
  createdAt: NOW,
};
const buildInput = async (
  overrides: Partial<DianaPaidMediaInput> = {},
): Promise<DianaPaidMediaInput> => {
  const strategy = new CampaignStrategyPipelineService().runPipeline(campaignRequest, {
    totalBudget: 1000,
    currency: "MYR",
  });
  const aria = new AriaCampaignStrategyService().interpret({
    teamRunId: "run-200", correlationId: "correlation-200",
    assignment: { ...assignment("ARIA"), dependencies: [] },
    founderObjective: objective(), sourceReferences: [source], campaignConstraints: [],
    marketConstraints: [], channelConstraints: [], campaignStrategy: strategy,
  });
  const repository = new InMemoryCreativeIntelligenceRepository();
  const record = await new AiCreativeIntelligenceService(repository).createCreativeIntelligence({
    creativeId: "creative-200", productId: "product-200", sourceContentId: "content-200",
    assetType: "IMAGE", platforms: ["INSTAGRAM", "FACEBOOK"], targetMarkets: ["MY"],
    brief: { hook: "Style faster", headline: "Glow anywhere", primaryText: "Compact styling.", callToAction: "Learn More", visualConcept: "Vanity scene" },
    brandName: "SirehLuxe", brandTone: "Helpful", registeredAt: NOW,
  });
  const creativeIntelligence = await new CreativeIntelligencePipelineService(repository).runById(record.id);
  const lylaInput: LylaCreativeStrategyInput = {
    teamRunId: "run-200", correlationId: "correlation-200", assignment: assignment("LYLA"),
    ariaContribution: aria, productReferences: [source], targetMarkets: ["MY"],
    targetPlatforms: ["INSTAGRAM", "FACEBOOK"],
    assetReferences: [{ artifactId: "asset-200", artifactType: "IMAGE", version: "1" }],
    brandConstraints: ["Helpful"], creativeRequirements: [], reviewRequirements: ["MIRA"],
    creativeObjective: "Prepare paid creative direction.", creativeAngle: "Portable confidence",
    hookDirection: "Lead with speed", visualConcept: "Vanity scene", formatRecommendation: "Carousel",
    structure: ["Hook", "Benefit", "CTA"], ctaDirection: "Learn more", creativeIntelligence,
  };
  const lyla = new LylaCreativeStrategyService().interpret(lylaInput);
  return {
    teamRunId: "run-200", correlationId: "correlation-200", assignment: assignment("DIANA"),
    founderObjective: objective(), sourceReferences: [source], targetMarkets: ["MY"],
    targetChannels: ["META", "TIKTOK"], ariaContribution: aria, lylaContribution: lyla,
    mayaEvidenceReferences: [evidence], campaignConstraints: [],
    budgetConstraints: { founderEnvelope: 1000, currency: "MYR", approvedSpend: 1000, proposedTotal: 1000, materiallyChangesEconomics: false },
    currencyContext: "MYR", scheduleContext: "Next month",
    trackingPrerequisites: ["Validated pixel and conversion event"],
    measurementPrerequisites: ["Founder-approved KPI definitions"], evidenceReferences: [evidence],
    platformAvailability: { META: "SUPPORTED_BY_EVIDENCE", TIKTOK: "NOT_AVAILABLE", OTHER_SUPPORTED_CHANNEL: "NOT_AVAILABLE" },
    reviewRequirements: ["MIRA"], ...overrides,
  };
};

describe("DIANA Paid Media", () => {
  it("has correct identity and authority", () => expect(new MarketingTeamAgentRegistry().get("DIANA")).toMatchObject({ personaName: "DIANA", role: "PAID_MEDIA", systemLayer: "CODEX_SACP_SAIE", productionExecutionAllowed: false }));
  it("validates required input", async () => {
    const input = await buildInput({ scheduleContext: "" });
    expect(() => new DianaPaidMediaService().interpret(input)).toThrowError("scheduleContext is required.");
  });
  it("ingests ARIA contribution", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).ariaContributionReference).toBe(input.ariaContribution.contributionId); });
  it("ingests LYLA contribution", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).lylaContributionReference).toBe(input.lylaContribution.contributionId); });
  it("requires direct ARIA dependency", async () => { const input = await buildInput(); await expect(Promise.resolve().then(() => new DianaPaidMediaService().interpret({ ...input, assignment: { ...input.assignment, dependencies: ["run-200:assignment:lyla"] } }))).rejects.toThrow("direct ARIA dependency"); });
  it("requires direct LYLA dependency", async () => { const input = await buildInput(); await expect(Promise.resolve().then(() => new DianaPaidMediaService().interpret({ ...input, assignment: { ...input.assignment, dependencies: ["run-200:assignment:aria"] } }))).rejects.toThrow("direct LYLA dependency"); });
  it("reuses canonical campaign allocation", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).budgetAllocationInterpretation.canonicalAllocation).toEqual(input.ariaContribution.canonicalCampaignStrategy.budgetAllocation); });
  it("does not authorize or recalculate canonical budget", async () => { const input = await buildInput(); const result = new DianaPaidMediaService().interpret(input); expect(result.budgetAllocationInterpretation).toMatchObject({ source: "EXISTING_CANONICAL_ALLOCATION", budgetChangeAuthorized: false }); expect(result.budgetAllocationInterpretation.canonicalAllocation.totalBudget).toBe(1000); });
  it("builds an abstract paid-media channel plan", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).channelPlan.map((item) => item.channel)).toEqual(["META", "TIKTOK"]));
  it("structures audience recommendations without audience metrics", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).audienceApproach.join(" ")).not.toMatch(/audience size|lookalike available/iu));
  it("structures governed placement recommendations", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).placementRecommendations.every((item) => item.includes("Founder review"))).toBe(true));
  it("preserves canonical creative-role allocations", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).creativeRoleRecommendations).toEqual(input.ariaContribution.canonicalCampaignStrategy.creativeAllocation); });
  it("provides deterministic advisory testing structures", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).testingStrategy).toHaveLength(5));
  it("makes scaling conditional without live data", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).scalingConditions).toContain("Conditional only: live performance data is unavailable."));
  it("represents missing live data explicitly", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).missingDataIndicators).toContain("TIKTOK: DATA_NOT_AVAILABLE"));
  it("does not fabricate platform metrics", async () => expect(JSON.stringify(new DianaPaidMediaService().interpret(await buildInput()))).not.toMatch(/"(?:impressions|cpm|cpc|ctr|cpa|roas|conversions|spend|reach|frequency)"\s*:/iu));
  it("escalates budget authority changes", async () => expect(new DianaPaidMediaService().interpret(await buildInput({ budgetConstraints: { founderEnvelope: 1000, approvedSpend: 1000, proposedTotal: 1200, materiallyChangesEconomics: true } })).escalationReasons).toContain("Budget recommendation changes Founder-approved spend or campaign economics."));
  it("escalates unclear tracking", async () => expect(new DianaPaidMediaService().interpret(await buildInput({ trackingPrerequisites: [] })).escalationReasons).toContain("Tracking prerequisites are unclear."));
  it("preserves LYLA policy risks", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).risks).toEqual(expect.arrayContaining([...input.lylaContribution.escalationReasons])); });
  it("preserves canonical campaign risks", async () => { const input = await buildInput(); expect(new DianaPaidMediaService().interpret(input).risks).toEqual(expect.arrayContaining(input.ariaContribution.risks.map((item) => item.reason))); });
  it("preserves upstream human review", async () => expect(new DianaPaidMediaService().interpret(await buildInput()).reviewState).toBe("REVIEW_REQUIRED"));
  it("records Founder decisions for authority changes", async () => expect(new DianaPaidMediaService().interpret(await buildInput({ campaignConstraints: ["change targeting"] })).founderDecisionsRequired.length).toBeGreaterThan(0));
  it("prepares a typed MIRA handoff", async () => expect(new DianaPaidMediaService().prepareMiraHandoff(new DianaPaidMediaService().interpret(await buildInput()))).toMatchObject({ fromPersona: "DIANA", toPersona: "MIRA", reviewRequirement: "MIRA", executionAllowed: false }));
  it("preserves teamRunId in contribution and handoff", async () => { const service = new DianaPaidMediaService(); const result = service.interpret(await buildInput()); expect([result.teamRunId, service.prepareMiraHandoff(result).teamRunId]).toEqual(["run-200", "run-200"]); });
  it("preserves correlationId in contribution and handoff", async () => { const service = new DianaPaidMediaService(); const result = service.interpret(await buildInput()); expect([result.correlationId, service.prepareMiraHandoff(result).correlationId]).toEqual(["correlation-200", "correlation-200"]); });
  it("preserves specialist attribution", async () => { const service = new DianaPaidMediaService(); expect(service.toSpecialistContribution(service.interpret(await buildInput())).persona).toBe("DIANA"); });
  it("preserves exact paid-media route", () => expect(new MissHermesDirectorService().createDelegationPlan("run-200", "correlation-200", objective()).assignments.map((item) => item.assignedPersona)).toEqual(["MAYA", "ARIA", "LYLA", "DIANA", "MIRA"]));
  it("does not force LUNA into paid-media route", () => expect(new MissHermesDirectorService().createDelegationPlan("run-200", "correlation-200", objective()).assignments.some((item) => item.assignedPersona === "LUNA")).toBe(false));
  it("preserves 01C ARIA compatibility", async () => expect((await buildInput()).ariaContribution.persona).toBe("ARIA"));
  it("preserves 01D LYLA compatibility", async () => expect((await buildInput()).lylaContribution.persona).toBe("LYLA"));
  it("is compatible with MISS HERMES consolidation", async () => { const service = new DianaPaidMediaService(); const contribution = service.toSpecialistContribution(service.interpret(await buildInput())); expect(new MissHermesDirectorService().evaluateReadiness(objective(), [contribution], [])).toMatchObject({ state: "NEEDS_REVIEW", executed: false }); });
  it("prohibits execution", () => expect(() => new DianaPaidMediaService().execute()).toThrowError("DIANA cannot create, publish, mutate, or execute paid-media actions or approve for Founder."));
  it("cannot impersonate Founder", async () => { const result = new DianaPaidMediaService().interpret(await buildInput()); expect(result).not.toHaveProperty("approvedByFounder"); expect(result.executionAllowed).toBe(false); });
  it("preserves legacy SAIE MarketingAgent", () => expect(new MarketingAgent().definition).toMatchObject({ type: "MarketingAgent" }));
  it("rejects ambiguous currency context", async () => {
    const input = await buildInput({ currencyContext: "Ringgit" });
    expect(() => new DianaPaidMediaService().interpret(input)).toThrowError("Currency must be a three-letter uppercase code.");
  });
  it("escalates production, credential, and targeting requests", async () => { const result = new DianaPaidMediaService().interpret(await buildInput({ campaignConstraints: ["create live campaign", "access credential", "change targeting"] })); expect(result.escalationReasons).toContain("Production campaign, mutation, credential, or targeting authority is requested."); expect(result.executionAllowed).toBe(false); });
});
