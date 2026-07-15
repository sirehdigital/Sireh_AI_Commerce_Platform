import type { SAIEAgentType } from "./saie-agent.types.js";

export type SAIEWorkflowStatus = "draft" | "available";

export interface SAIEWorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly agentType: SAIEAgentType;
  readonly dependsOn: readonly string[];
}

export interface SAIEWorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: SAIEWorkflowStatus;
  readonly steps: readonly SAIEWorkflowStep[];
}

export interface SAIEWorkflowPlan {
  readonly workflowId: string;
  readonly status: "defined-only";
  readonly steps: readonly SAIEWorkflowStep[];
}
