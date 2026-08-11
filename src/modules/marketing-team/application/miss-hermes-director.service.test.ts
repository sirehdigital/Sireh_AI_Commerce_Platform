import { describe, expect, it } from "vitest";

import {
  CampaignStrategyPipelineService,
  type CreateCampaignStrategyRequest,
} from "../../ai-campaign-strategy/index.js";
import { MarketingAgent } from "../../saie/agents/marketing/index.js";
import {
  MarketingTeamAgentRegistry,
  MarketingTeamOrchestrationService,
  MissHermesDirectorService,
  type CreateFounderMarketingObjectiveInput,
  type HermesHandoffEnvelope,
  type MissHermesDelegationPlan,
  type SpecialistContribution,
} from "../index.js";

const NOW = "2026-08-11T06:00:00.000Z";
const objectiveInput = (
  overrides: Partial<CreateFounderMarketingObjectiveInput> = {},
): CreateFounderMarketingObjectiveInput => ({
  objectiveId: "objective-001",
  objective: "Prepare a governed product launch recommendation.",
  sourceReference: { artifactId: "product-100", artifactType: "PRODUCT", version: "1" },
  targetMarkets: ["MY"],
  channels: ["INSTAGRAM"],
  budgetConstraints: ["Founder must approve spend"],
  campaignConstraints: ["No unsupported claims"],
  requestedOutputs: ["PAID_MEDIA_PLAN"],
  timingContext: "Launch review this week",
  riskRequirements: ["MIRA review"],
  reviewRequirements: ["MIRA", "FOUNDER"],
  receivedAt: NOW,
  ...overrides,
});
const contribution = (
  persona: SpecialistContribution["persona"],
  recommendation: string,
  overrides: Partial<SpecialistContribution> = {},
): SpecialistContribution => ({
  contributionId: `contribution-${persona.toLowerCase()}`,
  persona,
  summary: `${persona} summary`,
  recommendation,
  assumptions: ["Validated product context"],
  risks: [],
  confidence: "HIGH",
  evidence: [
    { artifactId: `evidence-${persona.toLowerCase()}`, artifactType: "EVIDENCE", version: "1" },
  ],
  dependencies: [],
  reviewState: persona === "MIRA" ? "PASSED" : "NOT_REQUIRED",
  ...overrides,
});
const dependencyMatrix = (
  plan: MissHermesDelegationPlan,
): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(plan.assignments.map((item) => [item.assignedPersona, item.dependencies]));

describe("MISS HERMES AI Marketing Director", () => {
  it("validates and normalizes Founder objective intake", () => {
    const intake = new MissHermesDirectorService().receiveObjective(
      objectiveInput({ objective: "  Launch plan  " }),
    );
    expect(intake).toMatchObject({ objective: "Launch plan", receivedBy: "MISS_HERMES" });
  });

  it("rejects missing Founder objective inputs", () => {
    expect(() =>
      new MissHermesDirectorService().receiveObjective(objectiveInput({ targetMarkets: [] })),
    ).toThrowError("targetMarkets must not be empty.");
  });

  it("uses the sealed MISS HERMES identity and non-execution authority", () => {
    expect(new MarketingTeamAgentRegistry().get("MISS_HERMES")).toMatchObject({
      personaName: "MISS_HERMES",
      role: "AI_MARKETING_DIRECTOR",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    });
  });

  it("selects only MAYA for market research", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(
      objectiveInput({ requestedOutputs: ["MARKET_RESEARCH"] }),
    );
    expect(
      service
        .createDelegationPlan("run-1", "correlation-1", intake)
        .assignments.map((item) => item.assignedPersona),
    ).toEqual(["MAYA"]);
  });

  it("routes campaign planning through MAYA then ARIA", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(
      objectiveInput({ requestedOutputs: ["CAMPAIGN_PLAN"] }),
    );
    expect(
      service
        .createDelegationPlan("run-1", "correlation-1", intake)
        .assignments.map((item) => item.assignedPersona),
    ).toEqual(["MAYA", "ARIA"]);
  });

  it("routes content selectively through ARIA, LUNA, and MIRA", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(objectiveInput({ requestedOutputs: ["CONTENT"] }));
    expect(
      service
        .createDelegationPlan("run-1", "correlation-1", intake)
        .assignments.map((item) => item.assignedPersona),
    ).toEqual(["ARIA", "LUNA", "MIRA"]);
  });

  it("preserves deterministic dependency sequencing", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(objectiveInput({ requestedOutputs: ["CREATIVE"] }));
    const plan = service.createDelegationPlan("run-1", "correlation-1", intake);
    expect(plan.assignments.map((item) => item.assignedPersona)).toEqual([
      "ARIA",
      "LUNA",
      "LYLA",
      "MIRA",
    ]);
    expect(plan.assignments[3]?.dependencies).toEqual(["run-1:assignment:lyla"]);
  });

  it("routes paid media with exact immediate dependencies", () => {
    const service = new MissHermesDirectorService();
    const plan = service.createDelegationPlan(
      "run-paid",
      "correlation-paid",
      service.receiveObjective(objectiveInput({ requestedOutputs: ["PAID_MEDIA_PLAN"] })),
    );
    expect(plan.assignments.map((item) => item.assignedPersona)).toEqual([
      "MAYA",
      "ARIA",
      "LYLA",
      "DIANA",
      "MIRA",
    ]);
    expect(dependencyMatrix(plan)).toEqual({
      MAYA: [],
      ARIA: ["run-paid:assignment:maya"],
      LYLA: ["run-paid:assignment:aria"],
      DIANA: ["run-paid:assignment:aria", "run-paid:assignment:lyla"],
      MIRA: ["run-paid:assignment:diana"],
    });
  });

  it("routes performance review with exact immediate dependencies", () => {
    const service = new MissHermesDirectorService();
    const plan = service.createDelegationPlan(
      "run-performance",
      "correlation-performance",
      service.receiveObjective(objectiveInput({ requestedOutputs: ["PERFORMANCE_REVIEW"] })),
    );
    expect(plan.assignments.map((item) => item.assignedPersona)).toEqual([
      "SUZI",
      "DIANA",
      "MISS_HERMES",
    ]);
    expect(dependencyMatrix(plan)).toEqual({
      SUZI: [],
      DIANA: ["run-performance:assignment:suzi"],
      MISS_HERMES: ["run-performance:assignment:diana"],
    });
  });

  it("deduplicates shared personas across combined outputs", () => {
    const service = new MissHermesDirectorService();
    const plan = service.createDelegationPlan(
      "run-combined",
      "correlation-combined",
      service.receiveObjective(
        objectiveInput({ requestedOutputs: ["PAID_MEDIA_PLAN", "CREATIVE"] }),
      ),
    );
    const personas = plan.assignments.map((item) => item.assignedPersona);
    expect(personas).toEqual(["MAYA", "ARIA", "LUNA", "LYLA", "DIANA", "MIRA"]);
    expect(new Set(personas).size).toBe(personas.length);
  });

  it("does not inherit unrelated or transitive dependencies", () => {
    const service = new MissHermesDirectorService();
    const plan = service.createDelegationPlan(
      "run-precision",
      "correlation-precision",
      service.receiveObjective(
        objectiveInput({ requestedOutputs: ["MARKET_RESEARCH", "CONTENT"] }),
      ),
    );
    expect(dependencyMatrix(plan)).toEqual({
      MAYA: [],
      ARIA: [],
      LUNA: ["run-precision:assignment:aria"],
      MIRA: ["run-precision:assignment:luna"],
    });
  });

  it("returns NEEDS_INFORMATION when specialist inputs are missing", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(objectiveInput());
    expect(service.evaluateReadiness(intake, [], [])).toMatchObject({
      state: "NEEDS_INFORMATION",
      executed: false,
    });
  });

  it("preserves conflicting positions and evidence", () => {
    const conflict = new MissHermesDirectorService().resolveConflict(
      "run-1",
      "correlation-1",
      "conflict-1",
      [
        contribution("ARIA", "Use conversion objective"),
        contribution("DIANA", "Use awareness objective"),
      ],
    );
    expect(conflict.positions).toHaveLength(2);
    expect(conflict).toMatchObject({
      teamRunId: "run-1",
      correlationId: "correlation-1",
      attributedTo: "MISS_HERMES",
      reviewState: "FOUNDER_REVIEW_REQUIRED",
    });
    expect(conflict.positions[0]?.evidence).toHaveLength(1);
    expect(conflict.founderEscalationRequired).toBe(true);
  });

  it("escalates MIRA blocking risk", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(objectiveInput());
    expect(
      service.evaluateReadiness(
        intake,
        [contribution("MIRA", "Block", { reviewState: "BLOCKED", risks: ["Policy risk"] })],
        [],
      ),
    ).toMatchObject({ state: "BLOCKED", founderEscalationRequired: true });
  });

  it("uses keyword escalation only as advisory detection without changing authority", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(
      objectiveInput({
        requestedOutputs: ["MARKET_RESEARCH"],
        budgetConstraints: [],
        campaignConstraints: [
          "Production execution needs credential and platform configuration review before change targeting or scope change.",
        ],
      }),
    );
    const readiness = service.evaluateReadiness(
      intake,
      [contribution("MAYA", "Prioritize MY")],
      [],
    );
    const plan = service.createDelegationPlan("run-keyword", "correlation-keyword", intake);
    const handoffBoundary: Pick<HermesHandoffEnvelope, "externalExecutionAllowed"> = {
      externalExecutionAllowed: false,
    };
    expect(readiness.reasons).toContain(
      "Production, credential, targeting, platform, or material scope authority requires Founder escalation.",
    );
    expect(readiness.founderEscalationRequired).toBe(true);
    expect(plan.productionExecutionAllowed).toBe(false);
    expect(plan.assignments.every((item) => item.executionAllowed === false)).toBe(true);
    expect(handoffBoundary.externalExecutionAllowed).toBe(false);
    expect(new MarketingTeamAgentRegistry().get("MISS_HERMES").capabilities).toEqual([
      "ANALYSE",
      "RECOMMEND",
      "PREPARE",
      "REVIEW",
      "ESCALATE",
    ]);
  });

  it("composes a preparation-only Founder decision brief", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(
      objectiveInput({ requestedOutputs: ["CONTENT"], budgetConstraints: [] }),
    );
    const contributions = [
      contribution("ARIA", "Use conversion plan"),
      contribution("LUNA", "Use benefit-led copy"),
      contribution("MIRA", "Approve review"),
    ];
    const brief = service.composeFounderDecisionBrief(
      "run-1",
      "correlation-1",
      intake,
      contributions,
      [],
      "Launch is ready for review.",
      "Use conversion plan",
    );
    expect(brief).toMatchObject({
      approvalDecisionRecorded: false,
      approvedByMissHermes: false,
      executionAllowed: false,
      readiness: { state: "READY_FOR_FOUNDER", executed: false },
    });
  });

  it("enforces readiness transitions without an executed state", () => {
    const service = new MissHermesDirectorService();
    expect(service.transitionReadiness("NEEDS_INFORMATION", "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(() => service.transitionReadiness("READY_FOR_FOUNDER", "IN_PROGRESS")).toThrowError(
      "Cannot transition readiness from READY_FOR_FOUNDER to IN_PROGRESS.",
    );
  });

  it("cannot execute or approve on behalf of Founder", () => {
    expect(() => new MissHermesDirectorService().execute()).toThrowError(
      "MISS HERMES cannot execute production actions or approve on behalf of Founder.",
    );
  });

  it("preserves MISS HERMES and specialist attribution", () => {
    const service = new MissHermesDirectorService();
    const intake = service.receiveObjective(
      objectiveInput({ requestedOutputs: ["MARKET_RESEARCH"], budgetConstraints: [] }),
    );
    const brief = service.composeFounderDecisionBrief(
      "run-1",
      "correlation-1",
      intake,
      [contribution("MAYA", "Prioritize MY")],
      [],
      "Market evidence reviewed.",
      "Prioritize MY",
    );
    expect(brief.attribution).toMatchObject({ agent: "MISS_HERMES", teamRunId: "run-1" });
    expect(brief.specialistContributions[0]?.persona).toBe("MAYA");
  });

  it("remains compatible with 01A, the campaign pipeline, and SAIE MarketingAgent", () => {
    expect(new MarketingTeamOrchestrationService()).toBeInstanceOf(
      MarketingTeamOrchestrationService,
    );
    const request: CreateCampaignStrategyRequest = {
      product: {
        productId: "p1",
        productName: "Glow Wand",
        category: "Beauty",
        keyBenefits: ["Fast"],
        differentiators: ["Portable"],
        knownRisks: [],
        markets: ["MY"],
      },
      objective: "PRODUCT_LAUNCH",
      audience: {
        id: "a1",
        name: "Shoppers",
        targetMarkets: ["MY"],
        interests: ["Beauty"],
        painPoints: ["Time"],
        desiredOutcomes: ["Fast"],
        objections: ["Trust"],
        buyingTriggers: ["Offer"],
        awarenessLevel: "SOLUTION_AWARE",
      },
      offer: { type: "STANDARD", headline: "Launch", terms: [] },
      createdAt: NOW,
    };
    expect(new CampaignStrategyPipelineService().runPipeline(request).advisoryOnly).toBe(true);
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
