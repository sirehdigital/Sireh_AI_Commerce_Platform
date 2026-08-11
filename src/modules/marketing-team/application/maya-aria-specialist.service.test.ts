import { describe, expect, it } from "vitest";

import {
  CampaignStrategyPipelineService,
  type CreateCampaignStrategyRequest,
} from "../../ai-campaign-strategy/index.js";
import { MarketingAgent } from "../../saie/agents/marketing/index.js";
import {
  AriaCampaignStrategyService,
  MayaMarketIntelligenceService,
  MarketingTeamAgentRegistry,
  MissHermesDirectorService,
  type AriaCampaignStrategyInput,
  type FounderMarketingObjectiveIntake,
  type MarketEvidenceItem,
  type MayaMarketIntelligenceInput,
  type SpecialistAssignment,
} from "../index.js";

const NOW = "2026-08-11T06:00:00.000Z";
const source = { artifactId: "product-100", artifactType: "PRODUCT", version: "1" } as const;
const founderObjective = (
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"] = ["CAMPAIGN_PLAN"],
): FounderMarketingObjectiveIntake => ({
  objectiveId: "objective-100",
  objective: "Prepare launch strategy.",
  sourceReference: source,
  targetMarkets: ["MY"],
  channels: ["INSTAGRAM"],
  budgetConstraints: [],
  campaignConstraints: [],
  requestedOutputs: outputs,
  timingContext: "This week",
  riskRequirements: [],
  reviewRequirements: ["MISS_HERMES"],
  receivedAt: NOW,
  receivedBy: "MISS_HERMES",
});
const assignments = (
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"] = ["CAMPAIGN_PLAN"],
) => {
  const director = new MissHermesDirectorService();
  return director.createDelegationPlan("run-100", "correlation-100", founderObjective(outputs))
    .assignments;
};
const assigned = (
  persona: SpecialistAssignment["assignedPersona"],
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"] = ["CAMPAIGN_PLAN"],
): SpecialistAssignment => {
  const value = assignments(outputs).find((item) => item.assignedPersona === persona);
  if (value === undefined) throw new Error(`Missing ${persona} assignment fixture.`);
  return value;
};
const evidence = (overrides: Partial<MarketEvidenceItem> = {}): MarketEvidenceItem => ({
  artifactId: "evidence-100",
  artifactType: "MARKET_EVIDENCE",
  version: "1",
  claimKey: "demand-my",
  statement: "Observed qualified demand in MY.",
  value: "positive",
  kind: "OBSERVED_FACT",
  provenance: "PRIMARY",
  observedAt: "2026-08-10T06:00:00.000Z",
  dimensions: ["MARKET", "DEMAND"],
  ...overrides,
});
const evidenceWithoutObservedAt = (): MarketEvidenceItem => ({
  artifactId: "evidence-unknown-freshness",
  artifactType: "MARKET_EVIDENCE",
  version: "1",
  claimKey: "demand-unknown-freshness",
  statement: "Evidence is available without an observation timestamp.",
  value: "available",
  kind: "OBSERVED_FACT",
  provenance: "PRIMARY",
  dimensions: ["MARKET"],
});
const mayaInput = (
  overrides: Partial<MayaMarketIntelligenceInput> = {},
): MayaMarketIntelligenceInput => ({
  teamRunId: "run-100",
  correlationId: "correlation-100",
  assignment: assigned("MAYA"),
  objectiveReference: {
    artifactId: "objective-100",
    artifactType: "FOUNDER_OBJECTIVE",
    version: "1",
  },
  productReference: source,
  targetMarkets: ["MY"],
  intendedChannels: ["INSTAGRAM"],
  evidence: [
    evidence(),
    evidence({
      artifactId: "evidence-101",
      claimKey: "audience-my",
      statement: "Audience seeks practical value.",
      value: "practical",
      dimensions: ["AUDIENCE"],
    }),
  ],
  requestedDimensions: ["MARKET", "AUDIENCE"],
  freshnessThresholdDays: 7,
  constraints: [],
  evaluatedAt: NOW,
  ...overrides,
});
const campaignRequest: CreateCampaignStrategyRequest = {
  product: {
    productId: "product-100",
    productName: "Glow Wand",
    category: "Beauty",
    description: "Compact beauty tool.",
    keyBenefits: ["Fast styling"],
    differentiators: ["Portable"],
    knownRisks: ["Usage guidance"],
    targetPrice: 49,
    currency: "MYR",
    markets: ["MY"],
  },
  objective: "PRODUCT_LAUNCH",
  audience: {
    id: "audience-100",
    name: "Beauty shoppers",
    targetMarkets: ["MY"],
    interests: ["Beauty"],
    painPoints: ["Slow routine"],
    desiredOutcomes: ["Style quickly"],
    objections: ["Trust"],
    buyingTriggers: ["Launch offer"],
    awarenessLevel: "SOLUTION_AWARE",
  },
  offer: { type: "STANDARD", headline: "Launch", terms: ["Founder approval required"] },
  createdAt: NOW,
};
const pipeline = () =>
  new CampaignStrategyPipelineService().runPipeline(campaignRequest, {
    totalBudget: 500,
    currency: "MYR",
  });
const ariaInput = (
  overrides: Partial<AriaCampaignStrategyInput> = {},
): AriaCampaignStrategyInput => ({
  teamRunId: "run-100",
  correlationId: "correlation-100",
  assignment: assigned("ARIA", ["CONTENT"]),
  founderObjective: founderObjective(["CONTENT"]),
  sourceReferences: [source],
  campaignConstraints: [],
  marketConstraints: [],
  channelConstraints: [],
  campaignStrategy: pipeline(),
  ...overrides,
});

describe("MAYA market intelligence", () => {
  it("uses the sealed MAYA identity and authority", () =>
    expect(new MarketingTeamAgentRegistry().get("MAYA")).toMatchObject({
      personaName: "MAYA",
      role: "MARKET_INTELLIGENCE",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    }));
  it("validates structured market-intelligence input", () =>
    expect(() =>
      new MayaMarketIntelligenceService().analyse(mayaInput({ targetMarkets: [] })),
    ).toThrowError("Target markets and requested dimensions are required."));
  it("preserves evidence provenance", () =>
    expect(new MayaMarketIntelligenceService().analyse(mayaInput()).evidence[0]?.provenance).toBe(
      "PRIMARY",
    ));
  it("classifies current evidence freshness", () =>
    expect(new MayaMarketIntelligenceService().analyse(mayaInput()).evidenceQuality.freshness).toBe(
      "CURRENT",
    ));
  it("classifies aging evidence freshness deterministically", () =>
    expect(
      new MayaMarketIntelligenceService().analyse(
        mayaInput({
          evidence: [
            evidence({ observedAt: "2026-08-01T06:00:00.000Z" }),
            evidence({
              artifactId: "evidence-aging-audience",
              claimKey: "audience-aging",
              dimensions: ["AUDIENCE"],
              observedAt: "2026-08-01T06:00:00.000Z",
            }),
          ],
        }),
      ).evidenceQuality.freshness,
    ).toBe("AGING"));
  it("classifies stale evidence freshness deterministically", () =>
    expect(
      new MayaMarketIntelligenceService().analyse(
        mayaInput({
          evidence: [
            evidence({ observedAt: "2026-07-01T06:00:00.000Z" }),
            evidence({
              artifactId: "evidence-stale-audience",
              claimKey: "audience-stale",
              dimensions: ["AUDIENCE"],
              observedAt: "2026-07-01T06:00:00.000Z",
            }),
          ],
        }),
      ).evidenceQuality.freshness,
    ).toBe("STALE"));
  it("classifies unknown evidence freshness deterministically", () =>
    expect(
      new MayaMarketIntelligenceService().analyse(
        mayaInput({ evidence: [evidenceWithoutObservedAt()] }),
      ).evidenceQuality.freshness,
    ).toBe("UNKNOWN"));
  it("accepts evidence observed exactly at evaluatedAt as current", () =>
    expect(
      new MayaMarketIntelligenceService().analyse(
        mayaInput({
          requestedDimensions: ["MARKET"],
          evidence: [evidence({ observedAt: NOW })],
        }),
      ).evidenceQuality.freshness,
    ).toBe("CURRENT"));
  it("evaluates evidence before evaluatedAt normally", () =>
    expect(
      new MayaMarketIntelligenceService().analyse(
        mayaInput({
          requestedDimensions: ["MARKET"],
          evidence: [evidence({ observedAt: "2026-08-01T06:00:00.000Z" })],
        }),
      ).evidenceQuality.freshness,
    ).toBe("AGING"));
  it("rejects evidence observed after evaluatedAt", () =>
    expect(() =>
      new MayaMarketIntelligenceService().analyse(
        mayaInput({ evidence: [evidence({ observedAt: "2026-08-12T06:00:00.000Z" })] }),
      ),
    ).toThrowError("Evidence observedAt must not be later than evaluatedAt."));
  it("classifies complete evidence as HIGH", () =>
    expect(new MayaMarketIntelligenceService().analyse(mayaInput()).evidenceQuality.level).toBe(
      "HIGH",
    ));
  it("represents missing evidence as INSUFFICIENT without recommendations", () => {
    const result = new MayaMarketIntelligenceService().analyse(mayaInput({ evidence: [] }));
    expect(result).toMatchObject({
      confidence: "INSUFFICIENT",
      reviewState: "BLOCKED",
      recommendations: [],
    });
  });
  it("detects materially conflicting evidence", () => {
    const result = new MayaMarketIntelligenceService().analyse(
      mayaInput({
        requestedDimensions: ["MARKET"],
        evidence: [evidence(), evidence({ artifactId: "evidence-conflict", value: "negative" })],
      }),
    );
    expect(result.evidenceQuality.consistent).toBe(false);
    expect(result.escalationReasons).toContain("Evidence sources materially conflict.");
  });
  it("separates facts, signals, assumptions, and inferences", () => {
    const items = [
      evidence(),
      evidence({
        artifactId: "signal",
        claimKey: "signal",
        kind: "CALCULATED_SIGNAL",
        statement: "Calculated demand index is positive.",
      }),
      evidence({
        artifactId: "assumption",
        claimKey: "assumption",
        kind: "ASSUMPTION",
        statement: "Assume stable pricing.",
      }),
      evidence({
        artifactId: "inference",
        claimKey: "inference",
        kind: "INFERENCE",
        statement: "Demand may support a test.",
      }),
    ];
    const result = new MayaMarketIntelligenceService().analyse(
      mayaInput({ requestedDimensions: ["MARKET"], evidence: items }),
    );
    expect(result.observedFacts).toEqual(["Observed qualified demand in MY."]);
    expect(result.calculatedSignals).toEqual(["Calculated demand index is positive."]);
    expect(result.assumptions).toEqual(["Assume stable pricing."]);
    expect(result.inferences).toEqual(["Demand may support a test."]);
  });
  it("escalates low-confidence evidence", () => {
    const result = new MayaMarketIntelligenceService().analyse(
      mayaInput({
        evidence: [evidence({ provenance: "UNKNOWN", observedAt: "2026-01-01T00:00:00.000Z" })],
      }),
    );
    expect(["LOW", "INSUFFICIENT"]).toContain(result.confidence);
    expect(result.escalationReasons.length).toBeGreaterThan(0);
  });
  it("cannot execute production actions", () =>
    expect(() => new MayaMarketIntelligenceService().execute()).toThrowError(
      "MAYA cannot execute production actions or approve for Founder.",
    ));
});

describe("ARIA campaign strategy", () => {
  it("uses the sealed ARIA identity and authority", () =>
    expect(new MarketingTeamAgentRegistry().get("ARIA")).toMatchObject({
      personaName: "ARIA",
      role: "CAMPAIGN_STRATEGY",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    }));
  it("reuses the canonical CampaignStrategyPipelineResult", () => {
    const canonical = pipeline();
    expect(
      new AriaCampaignStrategyService().interpret(ariaInput({ campaignStrategy: canonical }))
        .canonicalCampaignStrategy,
    ).toEqual(canonical);
  });
  it("ingests a typed MAYA contribution handoff", () => {
    const maya = new MayaMarketIntelligenceService();
    const handoff = maya.prepareAriaHandoff(
      maya.analyse(mayaInput()),
      assigned("ARIA").assignmentId,
    );
    expect(
      new AriaCampaignStrategyService().interpret(
        ariaInput({
          assignment: assigned("ARIA"),
          founderObjective: founderObjective(),
          mayaHandoff: handoff,
        }),
      ).mayaEvidenceReferences,
    ).toHaveLength(2);
  });
  it("requires MAYA handoff when the assignment declares MAYA dependency", () => {
    expect(() =>
      new AriaCampaignStrategyService().interpret(
        ariaInput({ assignment: assigned("ARIA"), founderObjective: founderObjective() }),
      ),
    ).toThrowError("ARIA assignment requires the declared MAYA intelligence handoff.");
  });
  it("preserves MAYA evidence quality without confidence inflation", () => {
    const maya = new MayaMarketIntelligenceService();
    const handoff = maya.prepareAriaHandoff(
      maya.analyse(mayaInput({ evidence: [] })),
      assigned("ARIA").assignmentId,
    );
    expect(
      new AriaCampaignStrategyService().interpret(
        ariaInput({
          assignment: assigned("ARIA"),
          founderObjective: founderObjective(),
          mayaHandoff: handoff,
        }),
      ),
    ).toMatchObject({ confidence: "INSUFFICIENT", reviewState: "BLOCKED" });
  });
  it("preserves LOW MAYA evidence quality as LOW ARIA confidence", () => {
    const maya = new MayaMarketIntelligenceService();
    const low = maya.analyse(
      mayaInput({
        evidence: [evidence({ provenance: "UNKNOWN", observedAt: "2026-07-01T06:00:00.000Z" })],
      }),
    );
    expect(low.evidenceQuality.level).toBe("LOW");
    const handoff = maya.prepareAriaHandoff(low, assigned("ARIA").assignmentId);
    const aria = new AriaCampaignStrategyService().interpret(
      ariaInput({
        assignment: assigned("ARIA"),
        founderObjective: founderObjective(),
        mayaHandoff: handoff,
      }),
    );
    expect(aria.confidence).toBe("LOW");
  });
  it("interprets objective and funnel from the canonical result", () => {
    const result = new AriaCampaignStrategyService().interpret(ariaInput());
    expect(result.objective).toBe(result.canonicalCampaignStrategy.objective);
    expect(result.funnelInterpretation).toContain(result.canonicalCampaignStrategy.funnelStage);
  });
  it("interprets audience and market output", () => {
    const result = new AriaCampaignStrategyService().interpret(ariaInput());
    expect(result.audienceMarketInterpretation).toBe(
      result.canonicalCampaignStrategy.audienceStrategy.messagingAngle,
    );
  });
  it("interprets canonical channel and creative allocations", () => {
    const result = new AriaCampaignStrategyService().interpret(ariaInput());
    expect(result.channelInterpretation).toContain("%");
    expect(result.allocationInterpretation).toContain("%");
  });
  it("preserves canonical risk and readiness", () => {
    const canonical = pipeline();
    const result = new AriaCampaignStrategyService().interpret(
      ariaInput({ campaignStrategy: canonical }),
    );
    expect(result.risks).toEqual(canonical.strategicRisks);
    expect(result.readiness).toBe(canonical.readinessStatus);
  });
  it("escalates canonical human-review requirements", () => {
    const canonical = pipeline();
    const result = new AriaCampaignStrategyService().interpret(
      ariaInput({ campaignStrategy: { ...canonical, requiresHumanReview: true } }),
    );
    expect(result.requiresHumanReview).toBe(true);
    expect(result.escalationReasons).toContain("Canonical strategy requires human review.");
  });
  it("adds interpretation without recreating strategy metadata", () => {
    const canonical = pipeline();
    const result = new AriaCampaignStrategyService().interpret(
      ariaInput({ campaignStrategy: canonical }),
    );
    expect(result.canonicalCampaignStrategy.metadata).toEqual(canonical.metadata);
    expect(result.attributionVersion).toBe("MARKETING-TEAM-01C");
  });
  it("cannot execute production actions", () =>
    expect(() => new AriaCampaignStrategyService().execute()).toThrowError(
      "ARIA cannot execute production actions or approve for Founder.",
    ));
});

describe("MISS HERMES, MAYA, and ARIA integration", () => {
  it("routes MISS HERMES to MAYA for market research", () =>
    expect(assignments(["MARKET_RESEARCH"]).map((item) => item.assignedPersona)).toEqual(["MAYA"]));
  it("runs the typed MISS HERMES to MAYA to ARIA handoff", () => {
    const maya = new MayaMarketIntelligenceService();
    const mayaResult = maya.analyse(mayaInput());
    const handoff = maya.prepareAriaHandoff(mayaResult, assigned("ARIA").assignmentId);
    expect(
      new AriaCampaignStrategyService().interpret(
        ariaInput({
          assignment: assigned("ARIA"),
          founderObjective: founderObjective(),
          mayaHandoff: handoff,
        }),
      ),
    ).toMatchObject({ persona: "ARIA", teamRunId: "run-100" });
  });
  it("allows an ARIA content workflow without MAYA dependency", () => {
    const aria = assigned("ARIA", ["CONTENT"]);
    expect(aria.dependencies).toEqual([]);
    expect(
      new AriaCampaignStrategyService().interpret(
        ariaInput({ assignment: aria, founderObjective: founderObjective(["CONTENT"]) }),
      ),
    ).toMatchObject({ confidence: "MEDIUM" });
  });
  it("preserves team-run and correlation identity", () => {
    const result = new MayaMarketIntelligenceService().analyse(mayaInput());
    expect(result).toMatchObject({ teamRunId: "run-100", correlationId: "correlation-100" });
  });
  it("preserves specialist attribution through director-compatible adapters", () => {
    const maya = new MayaMarketIntelligenceService();
    const mayaAdapter = maya.toSpecialistContribution(maya.analyse(mayaInput()));
    const aria = new AriaCampaignStrategyService();
    const ariaAdapter = aria.toSpecialistContribution(aria.interpret(ariaInput()));
    expect([mayaAdapter.persona, ariaAdapter.persona]).toEqual(["MAYA", "ARIA"]);
  });
  it("preserves existing 01B routing", () =>
    expect(
      assignments(["CAMPAIGN_PLAN"]).map((item) => ({
        persona: item.assignedPersona,
        dependencies: item.dependencies,
      })),
    ).toEqual([
      { persona: "MAYA", dependencies: [] },
      { persona: "ARIA", dependencies: ["run-100:assignment:maya"] },
    ]));
  it("preserves existing SAIE MarketingAgent compatibility", () => {
    const legacy = new MarketingAgent().plan(
      {
        product: {
          title: "Glow Wand",
          description: "Compact tool.",
          tags: ["beauty"],
          targetMarkets: ["MY"],
        },
        brand: { name: "SirehLuxe", market: ["MY"], currency: "MYR" },
        executionMode: "proposal-only",
      },
      new Date(NOW),
    );
    expect(legacy).toMatchObject({ proposalOnly: true, executionSupported: false });
  });
});
