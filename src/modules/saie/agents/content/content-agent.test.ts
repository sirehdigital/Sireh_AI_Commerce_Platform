import { describe, expect, it } from "vitest";
import { SAIEEngine } from "../../core/index.js";
import { SAIEAgentRegistry } from "../agent-registry.js";
import { MarketingAgent } from "../marketing/index.js";
import { ContentAgent, parseContentAgentInput } from "./content-agent.js";
import type { ContentAgentAIContentPort } from "./content-agent.ports.js";
import type { ContentAgentInput, ContentAgentStepId, ContentCapabilityDraft } from "./content-agent.types.js";

const FIXED_DATE = new Date("2026-07-16T00:00:00.000Z");

describe("ContentAgent", () => {
  it("creates a deterministic content proposal through the AI Content adapter", () => {
    const plan = new ContentAgent(new StubAIContentPort()).plan(buildContentAgentInput(), FIXED_DATE);

    expect(plan).toMatchObject({
      agentType: "ContentAgent",
      executionMode: "proposal-only",
      workflowId: "saie-content-agent-plan",
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(stepIds(plan.orderedSteps)).toEqual([
      "ValidateContentContext",
      "AdaptAIContentCapability",
      "BuildContentProposal",
      "RequireHumanApproval",
    ]);
    expect(plan.proposal).toMatchObject({
      primaryHeadline: "Sireh Beauty Velvet Glow Body Lotion",
      shortProductDescription: "A concise AI Content product description.",
      longFormContentSummary: "A longer AI Content summary for human review.",
      keyBenefitBullets: ["daily hydration", "smoother-looking skin"],
      campaignHooks: ["Make daily body care feel simple.", "Hydration customers can understand."],
      socialCaptions: ["Short caption only.", "Primary caption for review."],
      emailSubjectSuggestions: ["Meet Velvet Glow", "Daily hydration made simple"],
      contentThemes: ["brand promise", "product benefit", "audience education"],
      recommendedFormats: ["product content block", "social caption set"],
      seoKeywords: ["body lotion", "daily hydration"],
      sourceCapabilities: ["StubAIContentPort"],
      approvalRequirement:
        "Human approval is required before publishing, posting, scheduling, emailing, advertising, or mutating any external system.",
    });
  });

  it("validates required fields", () => {
    expect(() => {
      new ContentAgent(new StubAIContentPort()).plan({
        ...buildContentAgentInput(),
        productTitle: "",
      });
    }).toThrow("Product title is required.");
  });

  it("rejects executable execution modes", () => {
    expect(() => {
      parseContentAgentInput({
        ...buildContentAgentInput(),
        executionMode: "execute",
      });
    }).toThrow("Content Agent only supports proposal-only execution mode.");
  });

  it("always keeps proposal-only safety flags and produces no executable action", () => {
    const plan = new ContentAgent(new StubAIContentPort()).plan(buildContentAgentInput(), FIXED_DATE);

    expect(plan.approvalRequired).toBe(true);
    expect(plan.executionSupported).toBe(false);
    expect(plan.proposalOnly).toBe(true);
    expect(plan.executableActions).toEqual([]);
    expect(stepIds(plan.orderedSteps)).not.toContain("PublishContent" as ContentAgentStepId);
    expect(plan.safetyWarnings).toContain("AI Content is used through a local adapter only.");
  });

  it("uses the existing AI Content capability through a port", () => {
    const port = new RecordingAIContentPort();
    const input = buildContentAgentInput();
    const plan = new ContentAgent(port).plan(input, FIXED_DATE);

    expect(port.callCount).toBe(1);
    expect(port.lastInput).toEqual(input);
    expect(plan.proposal.sourceCapabilities).toEqual(["RecordingAIContentPort"]);
  });

  it("keeps channel adaptations descriptive only", () => {
    const plan = new ContentAgent(new StubAIContentPort()).plan(buildContentAgentInput(), FIXED_DATE);

    expect(plan.proposal.channelAdaptations).toEqual([
      {
        channel: "Instagram",
        guidance: "Prepare an Instagram review caption; do not post.",
      },
      {
        channel: "Email",
        guidance: "Prepare an email subject review set; do not send.",
      },
    ]);
    expect(plan.executableActions).toEqual([]);
  });

  it("registers ContentAgent as planner-only in the default SAIE registry and SAIE engine", () => {
    const registeredAgent = new SAIEAgentRegistry().get("ContentAgent");
    const response = new SAIEEngine({
      agentRegistry: new SAIEAgentRegistry(),
      workflowEngine: new (class {
        public listDefinitions(): readonly [] {
          return [];
        }
      })() as never,
      productAgent: {} as never,
      marketingAgent: {} as never,
      contentAgent: new ContentAgent(new StubAIContentPort()),
      productAdapterReadinessService: {} as never,
    }).plan({
      id: "saie-content-test-request",
      targetAgent: "ContentAgent",
      context: {
        correlationId: "saie-content-correlation",
        tenantId: "tenant-test",
        requestedBy: "human-reviewer",
        source: "admin",
        metadata: {},
      },
      intent: "prepare-content-proposal",
      payload: buildContentAgentInput(),
    });

    expect(registeredAgent).toMatchObject({
      type: "ContentAgent",
      implementationStatus: "planner-only",
      capabilities: ["content-planning"],
    });
    expect(response.status).toBe("planned");
    expect(response.result).toMatchObject({
      agentType: "ContentAgent",
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
    });
  });

  it("does not change existing Marketing Agent behavior", () => {
    const marketingPlan = new MarketingAgent().plan(
      {
        product: {
          title: "Velvet Glow Body Lotion",
          description: "A lightweight body lotion for daily hydration.",
          category: "skincare",
          tags: ["hydration"],
          targetMarkets: ["MY"],
          keyBenefits: ["daily hydration"],
          currency: "MYR",
        },
        brand: {
          name: "Sireh Beauty",
          market: ["MY"],
          currency: "MYR",
          tone: "friendly",
        },
        executionMode: "proposal-only",
      },
      FIXED_DATE,
    );

    expect(marketingPlan).toMatchObject({
      agentType: "MarketingAgent",
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
    });
  });
});

const stepIds = (steps: readonly { readonly id: ContentAgentStepId }[]): readonly ContentAgentStepId[] =>
  steps.map((step) => step.id);

const buildContentAgentInput = (): ContentAgentInput => ({
  productTitle: "Velvet Glow Body Lotion",
  productCategory: "Body Care",
  brandName: "Sireh Beauty",
  productBenefits: ["daily hydration", "smoother-looking skin"],
  targetAudience: "busy self-care shoppers in Malaysia",
  brandVoice: "friendly and practical",
  campaignObjective: "Validate demand before scaled marketing execution.",
  recommendedChannels: ["Instagram", "Email"],
  locale: "en",
  executionMode: "proposal-only",
});

class StubAIContentPort implements ContentAgentAIContentPort {
  public createDraft(): ContentCapabilityDraft {
    return buildDraft("StubAIContentPort");
  }
}

class RecordingAIContentPort implements ContentAgentAIContentPort {
  public callCount = 0;
  public lastInput: ContentAgentInput | null = null;

  public createDraft(input: ContentAgentInput): ContentCapabilityDraft {
    this.callCount += 1;
    this.lastInput = input;

    return buildDraft("RecordingAIContentPort");
  }
}

const buildDraft = (sourceCapability: string): ContentCapabilityDraft => ({
  primaryHeadline: "Sireh Beauty Velvet Glow Body Lotion",
  shortProductDescription: "A concise AI Content product description.",
  longFormContentSummary: "A longer AI Content summary for human review.",
  keyBenefitBullets: ["daily hydration", "smoother-looking skin"],
  campaignHooks: ["Make daily body care feel simple.", "Hydration customers can understand."],
  socialCaptions: ["Short caption only.", "Primary caption for review."],
  emailSubjectSuggestions: ["Meet Velvet Glow", "Daily hydration made simple"],
  contentThemes: ["brand promise", "product benefit", "audience education"],
  recommendedFormats: ["product content block", "social caption set"],
  channelAdaptations: [
    {
      channel: "Instagram",
      guidance: "Prepare an Instagram review caption; do not post.",
    },
    {
      channel: "Email",
      guidance: "Prepare an email subject review set; do not send.",
    },
  ],
  seoKeywords: ["body lotion", "daily hydration"],
  localizationNotes: ["English content proposal generated."],
  complianceCautions: ["Human approval required before use."],
  sourceCapabilities: [sourceCapability],
});
