import { describe, expect, it } from "vitest";

import {
  CampaignStrategyPipelineService,
  type CreateCampaignStrategyRequest,
} from "../../ai-campaign-strategy/index.js";
import {
  InMemoryMarketingExecutionRepository,
  MarketingExecutionService,
} from "../../marketing-execution/index.js";
import { MarketingAgent } from "../../saie/agents/marketing/index.js";
import {
  MarketingTeamAgentRegistry,
  MarketingTeamGovernanceError,
  MarketingTeamOrchestrationService,
  type CreateMarketingTeamRunInput,
  type MarketingTeamAgentDefinition,
} from "../index.js";

const CREATED_AT = "2026-08-11T04:00:00.000Z";

const campaignRequest: CreateCampaignStrategyRequest = {
  product: {
    productId: "product-100",
    productName: "Velvet Glow Wand",
    category: "Beauty Tools",
    description: "A compact beauty tool.",
    keyBenefits: ["Fast styling"],
    differentiators: ["Travel-ready"],
    knownRisks: ["Usage guidance required"],
    targetPrice: 49.99,
    currency: "USD",
    markets: ["US", "MY"],
  },
  objective: "PRODUCT_LAUNCH",
  audience: {
    id: "audience-100",
    name: "Busy shoppers",
    targetMarkets: ["US"],
    interests: ["Beauty"],
    painPoints: ["Slow routine"],
    desiredOutcomes: ["Style quickly"],
    objections: ["Unsure about use"],
    buyingTriggers: ["Launch bonus"],
    awarenessLevel: "SOLUTION_AWARE",
  },
  offer: { type: "LIMITED_TIME", headline: "Launch bonus", terms: ["Founder approval required"] },
  createdAt: CREATED_AT,
};

const strategy = () =>
  new CampaignStrategyPipelineService().runPipeline(campaignRequest, {
    totalBudget: 500,
    currency: "USD",
  });
const input = (
  overrides: Partial<CreateMarketingTeamRunInput> = {},
): CreateMarketingTeamRunInput => ({
  teamRunId: "marketing-team:run-001",
  sourceReference: { artifactId: "product-100", artifactType: "PRODUCT", version: "1" },
  campaignStrategy: strategy(),
  assignedAgent: "ARIA",
  requestedCapability: "PREPARE",
  inputArtifacts: [
    { artifactId: "strategy-100", artifactType: "CAMPAIGN_STRATEGY", version: "SACP-04.04F" },
  ],
  dependencies: ["market-evidence-100"],
  reviewRequirement: "MIRA",
  correlationId: "correlation-100",
  evidence: [{ artifactId: "market-evidence-100", artifactType: "MARKET_EVIDENCE", version: "1" }],
  createdAt: CREATED_AT,
  ...overrides,
});

describe("Marketing Team 01A governance", () => {
  it("registers the eight immutable agent identities", () => {
    const agents = new MarketingTeamAgentRegistry().list();
    expect(agents.map((agent) => agent.id)).toEqual([
      "MISS_HERMES",
      "MAYA",
      "ARIA",
      "LUNA",
      "LYLA",
      "DIANA",
      "SUZI",
      "MIRA",
    ]);
    expect(
      agents.every(
        (agent) => agent.productionExecutionAllowed === false && agent.prohibitedActions.length > 0,
      ),
    ).toBe(true);
    expect(new MarketingTeamAgentRegistry().get("MISS_HERMES")).toMatchObject({
      personaName: "MISS_HERMES",
      role: "AI_MARKETING_DIRECTOR",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    });
  });

  it("rejects duplicate agent registration", () => {
    const aria = new MarketingTeamAgentRegistry().get("ARIA");
    expect(() => new MarketingTeamAgentRegistry([aria, aria])).toThrowError(
      "Agent ARIA is already registered.",
    );
  });

  it("enforces role authority and invalid role/action combinations", () => {
    const service = new MarketingTeamOrchestrationService();
    expect(() =>
      service.createRun(input({ assignedAgent: "MAYA", requestedCapability: "PREPARE" })),
    ).toThrowError("MAYA may not prepare.");
  });

  it("creates a validated proposal-only run with complete attribution", () => {
    const run = new MarketingTeamOrchestrationService().createRun(input());
    expect(run).toMatchObject({
      assignedAgent: "ARIA",
      proposalOnly: true,
      executionAllowed: false,
      correlationId: "correlation-100",
    });
    expect(run.attribution).toMatchObject({
      agent: "ARIA",
      source: { artifactId: "product-100" },
      version: "MARKETING-TEAM-01A",
      teamRunId: "marketing-team:run-001",
    });
    expect(run.attribution.evidence).toHaveLength(1);
    expect(run.attribution.dependencies).toHaveLength(1);
  });

  it("rejects duplicate team run requests", () => {
    const service = new MarketingTeamOrchestrationService();
    service.createRun(input());
    expect(() => service.createRun(input())).toThrowError(
      "Team run marketing-team:run-001 already exists.",
    );
  });

  it("requires review when the canonical strategy requires human review", () => {
    const pipeline = strategy();
    const service = new MarketingTeamOrchestrationService();
    expect(() =>
      service.createRun(
        input({
          campaignStrategy: { ...pipeline, requiresHumanReview: true },
          reviewRequirement: "NONE",
        }),
      ),
    ).toThrowError("Strategy requires a review path.");
  });

  it("composes a Founder packet without recording a decision or enabling execution", async () => {
    const service = new MarketingTeamOrchestrationService();
    service.createRun(input());
    const execution = await new MarketingExecutionService(
      new InMemoryMarketingExecutionRepository(),
    ).create({
      sourceReference: { sourceType: "CAMPAIGN_STRATEGY", sourceId: "strategy-100" },
      actionType: "PUBLISH_CONTENT",
      targetPlatform: "INSTAGRAM",
      targetChannel: "INSTAGRAM",
      payloadReference: { payloadId: "payload-100", summary: "Proposal" },
      requestedBy: "MISS_HERMES",
      createdAt: CREATED_AT,
    });
    const packet = service.composeFounderPacket(
      "marketing-team:run-001",
      "MISS_HERMES",
      "Founder decision requested.",
      CREATED_AT,
      execution,
    );
    expect(packet).toMatchObject({
      reviewRequirement: "FOUNDER",
      approvalDecisionRecorded: false,
      executionAllowed: false,
    });
    expect(packet.proposedExecutionRequest).toMatchObject({
      advisoryOnly: true,
      executionEnabled: false,
    });
  });

  it("keeps the Hermes handoff typed and non-executable", async () => {
    const service = new MarketingTeamOrchestrationService();
    service.createRun(input());
    const execution = await new MarketingExecutionService(
      new InMemoryMarketingExecutionRepository(),
    ).create({
      sourceReference: { sourceType: "CAMPAIGN_STRATEGY", sourceId: "strategy-100" },
      actionType: "PUBLISH_CONTENT",
      targetPlatform: "INSTAGRAM",
      targetChannel: "INSTAGRAM",
      payloadReference: { payloadId: "payload-100", summary: "Proposal" },
      requestedBy: "MISS_HERMES",
      createdAt: CREATED_AT,
    });
    const packet = service.composeFounderPacket(
      "marketing-team:run-001",
      "MISS_HERMES",
      "Review.",
      CREATED_AT,
      execution,
    );
    const handoff = service.prepareHermesHandoff(packet, execution, "MISS_HERMES", CREATED_AT);
    expect(handoff.envelope.externalExecutionAllowed).toBe(false);
    expect(handoff.receiptExpectation.producedByMarketingTeam).toBe(false);
    expect(() => service.execute()).toThrowError("Marketing Team cannot execute production actions.");
  });

  it("records append-only, ordered orchestration events", () => {
    const service = new MarketingTeamOrchestrationService();
    service.createRun(input());
    service.changeStatus("marketing-team:run-001", "IN_PROGRESS", "ARIA", CREATED_AT);
    const events = service.listAuditEvents("marketing-team:run-001");
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(events.map((event) => event.eventType)).toEqual(["RUN_CREATED", "STATUS_CHANGED"]);
  });

  it("preserves compatibility with the existing proposal-only MarketingAgent", () => {
    const output = new MarketingAgent().plan(
      {
        product: {
          title: "Glow Wand",
          description: "Compact tool.",
          tags: ["beauty"],
          targetMarkets: ["US"],
        },
        brand: { name: "SirehLuxe", market: ["US"], currency: "USD" },
        executionMode: "proposal-only",
      },
      new Date(CREATED_AT),
    );
    expect(output).toMatchObject({
      agentType: "MarketingAgent",
      proposalOnly: true,
      executionSupported: false,
      executableActions: [],
    });
  });

  it("cannot register an execution-capable agent definition", () => {
    const aria = new MarketingTeamAgentRegistry().get("ARIA");
    const unsafe = {
      ...aria,
      productionExecutionAllowed: true,
    } as unknown as MarketingTeamAgentDefinition;
    expect(unsafe.productionExecutionAllowed).not.toBe(false);
    expect(() =>
      new MarketingTeamOrchestrationService(new MarketingTeamAgentRegistry([unsafe])).createRun(
        input(),
      ),
    ).toThrow(MarketingTeamGovernanceError);
  });
});
