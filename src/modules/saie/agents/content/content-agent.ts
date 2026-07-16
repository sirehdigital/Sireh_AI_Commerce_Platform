import type { SAIEAgentDefinition } from "../../types/index.js";
import { CONTENT_AGENT_PORT_IDENTIFIERS } from "./content-agent.ports.js";
import type { ContentAgentAIContentPort } from "./content-agent.ports.js";
import { createContentAgentSteps } from "./content-agent.steps.js";
import type {
  ContentAgentInput,
  ContentAgentOutput,
  ContentAgentStep,
  ContentProposal,
} from "./content-agent.types.js";
import { ContentAgentInputValidationError } from "./content-agent.types.js";
import { ExistingAIContentCapabilityAdapter } from "./content-agent.adapter.js";

const CONTENT_AGENT_SAFETY_WARNINGS = [
  "Proposal only; no publishing, posting, scheduling, emailing, advertising, or external execution is supported.",
  "AI Content is used through a local adapter only.",
  "No Shopify, marketplace, social, ad, or email delivery mutation is performed.",
  "Human approval is mandatory before any future external content execution.",
] as const;

export const CONTENT_AGENT_DEFINITION: SAIEAgentDefinition = {
  type: "ContentAgent",
  name: "Content Agent",
  description:
    "Creates deterministic proposal-only content plans by adapting existing AI Content capabilities.",
  capabilities: ["content-planning"],
  implementationStatus: "planner-only",
};

export class ContentAgent {
  public readonly definition = CONTENT_AGENT_DEFINITION;

  public constructor(
    private readonly aiContent: ContentAgentAIContentPort = new ExistingAIContentCapabilityAdapter(),
  ) {}

  public planFromPayload(
    payload: Readonly<Record<string, unknown>>,
    generatedAt: Date = new Date(),
  ): ContentAgentOutput {
    return this.plan(parseContentAgentInput(payload), generatedAt);
  }

  public plan(input: ContentAgentInput, generatedAt: Date = new Date()): ContentAgentOutput {
    const validated = validateContentAgentInput(input);
    const orderedSteps = createContentAgentSteps();

    return {
      agentType: "ContentAgent",
      executionMode: "proposal-only",
      workflowId: "saie-content-agent-plan",
      orderedSteps,
      requiredPorts: collectRequiredPorts(orderedSteps),
      proposal: createContentProposal(this.aiContent.createDraft(validated)),
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      safetyWarnings: [...CONTENT_AGENT_SAFETY_WARNINGS],
      generatedAt: generatedAt.toISOString(),
    };
  }
}

export const parseContentAgentInput = (
  payload: Readonly<Record<string, unknown>>,
): ContentAgentInput => {
  const locale = optionalString(payload.locale);

  return {
    productTitle: asString(payload.productTitle, "Product title is required."),
    productCategory: asString(payload.productCategory, "Product category is required."),
    brandName: asString(payload.brandName, "Brand name is required."),
    productBenefits: asStringArray(payload.productBenefits, "Product benefits must be a readonly string array."),
    targetAudience: asString(payload.targetAudience, "Target audience is required."),
    brandVoice: asString(payload.brandVoice, "Brand voice is required."),
    campaignObjective: asString(payload.campaignObjective, "Campaign objective is required."),
    recommendedChannels: asStringArray(
      payload.recommendedChannels,
      "Recommended channels must be a readonly string array.",
    ),
    ...(locale === undefined ? {} : { locale }),
    executionMode: asExecutionMode(payload.executionMode),
  };
};

export const validateContentAgentInput = (input: ContentAgentInput): ContentAgentInput => {
  if (input.executionMode !== "proposal-only") {
    throw new ContentAgentInputValidationError("Content Agent only supports proposal-only execution mode.");
  }

  assertNonEmpty(input.productTitle, "Product title is required.");
  assertNonEmpty(input.productCategory, "Product category is required.");
  assertNonEmpty(input.brandName, "Brand name is required.");
  assertNonEmpty(input.targetAudience, "Target audience is required.");
  assertNonEmpty(input.brandVoice, "Brand voice is required.");
  assertNonEmpty(input.campaignObjective, "Campaign objective is required.");
  assertNonEmptyArray(input.productBenefits, "At least one product benefit is required.");
  assertNonEmptyArray(input.recommendedChannels, "At least one recommended channel is required.");

  return {
    productTitle: input.productTitle,
    productCategory: input.productCategory,
    brandName: input.brandName,
    productBenefits: [...input.productBenefits],
    targetAudience: input.targetAudience,
    brandVoice: input.brandVoice,
    campaignObjective: input.campaignObjective,
    recommendedChannels: [...input.recommendedChannels],
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    executionMode: input.executionMode,
  };
};

const createContentProposal = (draft: Omit<ContentProposal, "approvalRequirement">): ContentProposal => ({
  ...draft,
  approvalRequirement:
    "Human approval is required before publishing, posting, scheduling, emailing, advertising, or mutating any external system.",
});

const asString = (value: unknown, message: string): string => {
  if (typeof value !== "string") {
    throw new ContentAgentInputValidationError(message);
  }

  return value;
};

const optionalString = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ContentAgentInputValidationError("Optional string fields must be strings when supplied.");
  }

  return value;
};

const asStringArray = (value: unknown, message: string): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new ContentAgentInputValidationError(message);
  }

  const strings: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      throw new ContentAgentInputValidationError(message);
    }

    strings.push(item);
  }

  return strings;
};

const asExecutionMode = (value: unknown): ContentAgentInput["executionMode"] => {
  if (value === "proposal-only") {
    return value;
  }

  throw new ContentAgentInputValidationError("Content Agent only supports proposal-only execution mode.");
};

const assertNonEmpty = (value: string, message: string): void => {
  if (value.trim().length === 0) {
    throw new ContentAgentInputValidationError(message);
  }
};

const assertNonEmptyArray = (values: readonly string[], message: string): void => {
  if (values.length === 0 || values.some((value) => value.trim().length === 0)) {
    throw new ContentAgentInputValidationError(message);
  }
};

const collectRequiredPorts = (
  steps: readonly ContentAgentStep[],
): readonly ContentAgentOutput["requiredPorts"][number][] => {
  const ports = steps.map((step) => step.requiredPort);

  return CONTENT_AGENT_PORT_IDENTIFIERS.filter((port) => ports.includes(port));
};
