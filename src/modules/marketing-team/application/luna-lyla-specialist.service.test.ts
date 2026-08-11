import { describe, expect, it } from "vitest";
import {
  AiCreativeIntelligenceService,
  CreativeIntelligencePipelineService,
  InMemoryCreativeIntelligenceRepository,
  type CreateCreativeIntelligenceRequest,
} from "../../ai-creative-intelligence/index.js";
import {
  CampaignStrategyPipelineService,
  type CreateCampaignStrategyRequest,
} from "../../ai-campaign-strategy/index.js";
import { ContentAgent } from "../../saie/agents/content/index.js";
import {
  AriaCampaignStrategyService,
  LunaContentCopyService,
  LylaCreativeStrategyService,
  MarketingTeamAgentRegistry,
  MissHermesDirectorService,
  type AriaCampaignStrategyContribution,
  type FounderMarketingObjectiveIntake,
  type LunaContentCopyInput,
  type LylaCreativeStrategyInput,
  type SpecialistAssignment,
} from "../index.js";

const NOW = "2026-08-12T02:00:00.000Z";
const source = { artifactId: "product-100", artifactType: "PRODUCT", version: "1" } as const;
const objective = (
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"],
): FounderMarketingObjectiveIntake => ({
  objectiveId: "objective-100",
  objective: "Prepare launch creative.",
  sourceReference: source,
  targetMarkets: ["MY"],
  channels: ["INSTAGRAM"],
  budgetConstraints: [],
  campaignConstraints: [],
  requestedOutputs: outputs,
  timingContext: "This week",
  riskRequirements: [],
  reviewRequirements: ["MIRA"],
  receivedAt: NOW,
  receivedBy: "MISS_HERMES",
});
const assignment = (
  persona: SpecialistAssignment["assignedPersona"],
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"],
): SpecialistAssignment => {
  const item = new MissHermesDirectorService()
    .createDelegationPlan("run-100", "correlation-100", objective(outputs))
    .assignments.find((entry) => entry.assignedPersona === persona);
  if (item === undefined) throw new Error(`Missing ${persona} fixture.`);
  return item;
};
const campaignRequest: CreateCampaignStrategyRequest = {
  product: {
    productId: "product-100",
    productName: "Glow Wand",
    category: "Beauty",
    description: "Compact tool.",
    keyBenefits: ["Fast styling"],
    differentiators: ["Portable"],
    knownRisks: [],
    markets: ["MY"],
  },
  objective: "PRODUCT_LAUNCH",
  audience: {
    id: "audience-1",
    name: "Shoppers",
    targetMarkets: ["MY"],
    interests: ["Beauty"],
    painPoints: ["Time"],
    desiredOutcomes: ["Fast styling"],
    objections: ["Trust"],
    buyingTriggers: ["Launch"],
    awarenessLevel: "SOLUTION_AWARE",
  },
  offer: { type: "STANDARD", headline: "Launch", terms: [] },
  createdAt: NOW,
};
const aria = (
  outputs: FounderMarketingObjectiveIntake["requestedOutputs"] = ["CONTENT"],
): AriaCampaignStrategyContribution =>
  new AriaCampaignStrategyService().interpret({
    teamRunId: "run-100",
    correlationId: "correlation-100",
    assignment: assignment("ARIA", outputs),
    founderObjective: objective(outputs),
    sourceReferences: [source],
    campaignConstraints: [],
    marketConstraints: [],
    channelConstraints: [],
    campaignStrategy: new CampaignStrategyPipelineService().runPipeline(campaignRequest),
  });
const lunaInput = (overrides: Partial<LunaContentCopyInput> = {}): LunaContentCopyInput => ({
  teamRunId: "run-100",
  correlationId: "correlation-100",
  assignment: assignment("LUNA", ["CONTENT"]),
  founderObjective: objective(["CONTENT"]),
  ariaContribution: aria(),
  productReferences: [source],
  targetMarkets: ["MY"],
  targetChannel: "INSTAGRAM",
  contentType: "SOCIAL_POST",
  messagingDirection: "Explain fast styling without unsupported promises.",
  claims: [
    {
      claimId: "fact-1",
      text: "Compact styling tool",
      status: "APPROVED_FACT",
      evidenceReferences: [
        { artifactId: "product-fact-1", artifactType: "PRODUCT_FACT", version: "1" },
      ],
    },
    {
      claimId: "assumption-1",
      text: "Audience values portability",
      status: "ASSUMPTION",
      evidenceReferences: [],
    },
  ],
  brandConstraints: ["Helpful tone"],
  contentRequirements: [],
  reviewRequirements: ["MIRA"],
  preparedCopy: {
    hooks: ["Style faster"],
    headline: "Glow anywhere",
    bodyCopy: "A compact tool designed for practical styling routines.",
    cta: "Learn more",
  },
  ...overrides,
});
const creativeResult = async () => {
  const repository = new InMemoryCreativeIntelligenceRepository();
  const request: CreateCreativeIntelligenceRequest = {
    creativeId: "creative-100",
    productId: "product-100",
    sourceContentId: "content-100",
    assetType: "IMAGE",
    platforms: ["INSTAGRAM", "FACEBOOK"],
    targetMarkets: ["MY"],
    brief: {
      hook: "Style faster",
      headline: "Glow anywhere",
      primaryText: "Compact styling for daily routines.",
      callToAction: "Learn More",
      visualConcept: "Warm vanity scene",
    },
    brandName: "SirehLuxe",
    brandTone: "Helpful",
    registeredAt: NOW,
  };
  const record = await new AiCreativeIntelligenceService(repository).createCreativeIntelligence(
    request,
  );
  return new CreativeIntelligencePipelineService(repository).runById(record.id);
};
const lylaInput = async (
  overrides: Partial<LylaCreativeStrategyInput> = {},
): Promise<LylaCreativeStrategyInput> => {
  const lunaService = new LunaContentCopyService();
  const luna = lunaService.prepare(
    lunaInput({
      assignment: assignment("LUNA", ["CREATIVE"]),
      founderObjective: objective(["CREATIVE"]),
      ariaContribution: aria(["CREATIVE"]),
    }),
  );
  return {
    teamRunId: "run-100",
    correlationId: "correlation-100",
    assignment: assignment("LYLA", ["CREATIVE"]),
    ariaContribution: aria(["CREATIVE"]),
    lunaHandoff: lunaService.prepareLylaHandoff(
      luna,
      assignment("LYLA", ["CREATIVE"]).assignmentId,
    ),
    productReferences: [source],
    targetMarkets: ["MY"],
    targetPlatforms: ["INSTAGRAM"],
    assetReferences: [{ artifactId: "asset-1", artifactType: "IMAGE", version: "1" }],
    brandConstraints: ["Helpful"],
    creativeRequirements: [],
    reviewRequirements: ["MIRA"],
    creativeObjective: "Create a review-ready launch concept.",
    creativeAngle: "Portable confidence",
    hookDirection: "Lead with speed",
    visualConcept: "Warm vanity scene",
    formatRecommendation: "Carousel",
    structure: ["Hook", "Benefit", "CTA"],
    ctaDirection: "Learn more",
    creativeIntelligence: await creativeResult(),
    ...overrides,
  };
};

describe("LUNA Content & Copy", () => {
  it("has correct identity and authority", () =>
    expect(new MarketingTeamAgentRegistry().get("LUNA")).toMatchObject({
      personaName: "LUNA",
      role: "CONTENT_COPY",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    }));
  it("validates input", () =>
    expect(() =>
      new LunaContentCopyService().prepare(lunaInput({ messagingDirection: "" })),
    ).toThrowError("messagingDirection is required."));
  it("ingests ARIA strategy", () =>
    expect(new LunaContentCopyService().prepare(lunaInput()).ariaStrategyReferences).toEqual(
      aria().sourceReferences,
    ));
  it("preserves supported claim evidence", () => {
    const result = new LunaContentCopyService().prepare(lunaInput());
    expect(result.approvedFacts[0]?.evidenceReferences).toHaveLength(1);
    expect(result.claimReferences).toHaveLength(1);
  });
  it("escalates unsupported claims", () => {
    const result = new LunaContentCopyService().prepare(
      lunaInput({
        claims: [
          {
            claimId: "claim-x",
            text: "Guaranteed result",
            status: "SUPPORTED_CLAIM",
            evidenceReferences: [],
          },
        ],
      }),
    );
    expect(result.escalationReasons).toContain("Claim claim-x lacks supporting evidence.");
  });
  it("separates facts from assumptions", () => {
    const result = new LunaContentCopyService().prepare(lunaInput());
    expect(result.approvedFacts.map((item) => item.claimId)).toEqual(["fact-1"]);
    expect(result.assumptions.map((item) => item.claimId)).toEqual(["assumption-1"]);
  });
  it("structures channel-specific contribution", () =>
    expect(new LunaContentCopyService().prepare(lunaInput())).toMatchObject({
      channel: "INSTAGRAM",
      contentType: "SOCIAL_POST",
      cta: "Learn more",
    }));
  it("requires review where declared", () =>
    expect(new LunaContentCopyService().prepare(lunaInput()).reviewState).toBe("REVIEW_REQUIRED"));
  it("cannot publish or execute", () =>
    expect(() => new LunaContentCopyService().execute()).toThrowError(
      "LUNA cannot publish, send, execute production actions, or approve for Founder.",
    ));
});

describe("LYLA Creative Strategy", () => {
  it("has correct identity and authority", () =>
    expect(new MarketingTeamAgentRegistry().get("LYLA")).toMatchObject({
      personaName: "LYLA",
      role: "CREATIVE_STRATEGY",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    }));
  it("ingests ARIA strategy", async () =>
    expect(new LylaCreativeStrategyService().interpret(await lylaInput()).ariaReference).toBe(
      aria(["CREATIVE"]).contributionId,
    ));
  it("ingests LUNA contribution", async () =>
    expect(new LylaCreativeStrategyService().interpret(await lylaInput()).lunaReference).toBe(
      "run-100:contribution:luna",
    ));
  it("supports paid-media path without LUNA", async () => {
    const withLuna = await lylaInput({
      assignment: assignment("LYLA", ["PAID_MEDIA_PLAN"]),
      ariaContribution: aria(),
    });
    const input = { ...withLuna };
    delete input.lunaHandoff;
    expect(new LylaCreativeStrategyService().interpret(input).lunaReference).toBeUndefined();
  });
  it("reuses Creative Intelligence result", async () => {
    const input = await lylaInput();
    const result = new LylaCreativeStrategyService().interpret(input);
    expect(result.creativeIntelligenceReference.creativeIntelligenceId).toBe(
      input.creativeIntelligence.creativeIntelligenceId,
    );
  });
  it("preserves platform suitability", async () => {
    const input = await lylaInput();
    expect(new LylaCreativeStrategyService().interpret(input).platformSuitability).toEqual(
      input.creativeIntelligence.platformSuitability,
    );
  });
  it("preserves policy risk", async () => {
    const input = await lylaInput();
    expect(new LylaCreativeStrategyService().interpret(input).policyRisks).toEqual(
      input.creativeIntelligence.policyRisk,
    );
  });
  it("preserves brand risks from Creative Intelligence", async () => {
    const input = await lylaInput();
    const result = new LylaCreativeStrategyService().interpret(input);
    expect(result.brandRisks).toEqual(
      input.creativeIntelligence.creativeQuality.findings
        .filter((item) => item.dimension === "BRAND_CONSISTENCY" && item.type !== "STRENGTH")
        .map((item) => item.message),
    );
  });
  it("preserves creative recommendations", async () => {
    const input = await lylaInput();
    expect(new LylaCreativeStrategyService().interpret(input).recommendations).toEqual(
      input.creativeIntelligence.recommendations,
    );
  });
  it("escalates human-review output", async () => {
    const input = await lylaInput();
    expect(new LylaCreativeStrategyService().interpret(input).reviewState).not.toBe("READY");
  });
  it("does not recreate creative scoring", async () => {
    const input = await lylaInput();
    const result = new LylaCreativeStrategyService().interpret(input);
    expect(result.creativeIntelligenceReference.pipelineVersion).toBe(
      input.creativeIntelligence.versionMetadata.pipelineVersion,
    );
  });
  it("cannot publish or execute", () =>
    expect(() => new LylaCreativeStrategyService().execute()).toThrowError(
      "LYLA cannot publish, replace production creative, execute actions, or approve for Founder.",
    ));
});

describe("LUNA and LYLA integration", () => {
  it("routes MISS HERMES through ARIA to LUNA", () =>
    expect(
      new MissHermesDirectorService()
        .createDelegationPlan("run-100", "correlation-100", objective(["CONTENT"]))
        .assignments.map((item) => item.assignedPersona),
    ).toEqual(["ARIA", "LUNA", "MIRA"]));
  it("runs ARIA to LUNA to LYLA", async () =>
    expect(new LylaCreativeStrategyService().interpret(await lylaInput())).toMatchObject({
      persona: "LYLA",
      lunaReference: "run-100:contribution:luna",
    }));
  it("keeps paid-media LYLA route free of LUNA", () =>
    expect(assignment("LYLA", ["PAID_MEDIA_PLAN"]).dependencies).toEqual([
      "run-100:assignment:aria",
    ]));
  it("preserves team-run and correlation", async () =>
    expect(new LylaCreativeStrategyService().interpret(await lylaInput())).toMatchObject({
      teamRunId: "run-100",
      correlationId: "correlation-100",
    }));
  it("preserves specialist attribution", async () => {
    const luna = new LunaContentCopyService();
    const lyla = new LylaCreativeStrategyService();
    expect([
      luna.toSpecialistContribution(luna.prepare(lunaInput())).persona,
      lyla.toSpecialistContribution(lyla.interpret(await lylaInput())).persona,
    ]).toEqual(["LUNA", "LYLA"]);
  });
  it("preserves LUNA claims and risks across handoff", () => {
    const luna = new LunaContentCopyService();
    const contribution = luna.prepare(
      lunaInput({
        claims: [
          {
            claimId: "warn",
            text: "Medical cure",
            status: "SUPPORTED_CLAIM",
            evidenceReferences: [],
          },
        ],
      }),
    );
    const handoff = luna.prepareLylaHandoff(
      contribution,
      assignment("LYLA", ["CREATIVE"]).assignmentId,
    );
    expect(handoff.risks).toEqual(contribution.risks);
    expect(handoff.claimReferences).toEqual(contribution.claimReferences);
  });
  it("preserves 01B routing", () =>
    expect(
      new MissHermesDirectorService()
        .createDelegationPlan("run-100", "correlation-100", objective(["CREATIVE"]))
        .assignments.map((item) => item.assignedPersona),
    ).toEqual(["ARIA", "LUNA", "LYLA", "MIRA"]));
  it("preserves MAYA and ARIA 01C compatibility", () => expect(aria().persona).toBe("ARIA"));
  it("preserves legacy SAIE ContentAgent", () => {
    expect(new ContentAgent().definition).toMatchObject({
      type: "ContentAgent",
      implementationStatus: "planner-only",
    });
  });
  it("preserves Creative Intelligence regression contract", async () =>
    expect((await creativeResult()).governance).toMatchObject({
      advisoryOnly: true,
      noPublishing: true,
    }));
});
