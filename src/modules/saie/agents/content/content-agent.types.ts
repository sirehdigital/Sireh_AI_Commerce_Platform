import type { SAIEAgentType } from "../../types/index.js";
import type { ContentAgentPortIdentifier } from "./content-agent.ports.js";

export type ContentAgentExecutionMode = "proposal-only";

export interface ContentAgentInput extends Readonly<Record<string, unknown>> {
  readonly productTitle: string;
  readonly productCategory: string;
  readonly brandName: string;
  readonly productBenefits: readonly string[];
  readonly targetAudience: string;
  readonly brandVoice: string;
  readonly campaignObjective: string;
  readonly recommendedChannels: readonly string[];
  readonly locale?: string;
  readonly executionMode: ContentAgentExecutionMode;
}

export type ContentAgentStepId =
  | "ValidateContentContext"
  | "AdaptAIContentCapability"
  | "BuildContentProposal"
  | "RequireHumanApproval";

export interface ContentAgentStep {
  readonly id: ContentAgentStepId;
  readonly order: number;
  readonly name: string;
  readonly requiredPort: ContentAgentPortIdentifier;
  readonly mutatesData: false;
}

export interface ContentChannelAdaptation {
  readonly channel: string;
  readonly guidance: string;
}

export interface ContentCapabilityDraft {
  readonly primaryHeadline: string;
  readonly shortProductDescription: string;
  readonly longFormContentSummary: string;
  readonly keyBenefitBullets: readonly string[];
  readonly campaignHooks: readonly string[];
  readonly socialCaptions: readonly string[];
  readonly emailSubjectSuggestions: readonly string[];
  readonly contentThemes: readonly string[];
  readonly recommendedFormats: readonly string[];
  readonly channelAdaptations: readonly ContentChannelAdaptation[];
  readonly seoKeywords: readonly string[];
  readonly localizationNotes: readonly string[];
  readonly complianceCautions: readonly string[];
  readonly sourceCapabilities: readonly string[];
}

export interface ContentProposal extends ContentCapabilityDraft {
  readonly approvalRequirement: string;
}

export interface ContentAgentOutput extends Readonly<Record<string, unknown>> {
  readonly agentType: Extract<SAIEAgentType, "ContentAgent">;
  readonly executionMode: ContentAgentExecutionMode;
  readonly workflowId: "saie-content-agent-plan";
  readonly orderedSteps: readonly ContentAgentStep[];
  readonly requiredPorts: readonly ContentAgentPortIdentifier[];
  readonly proposal: ContentProposal;
  readonly approvalRequired: true;
  readonly executionSupported: false;
  readonly proposalOnly: true;
  readonly executableActions: readonly [];
  readonly safetyWarnings: readonly string[];
  readonly generatedAt: string;
}

export class ContentAgentInputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContentAgentInputValidationError";
  }
}
