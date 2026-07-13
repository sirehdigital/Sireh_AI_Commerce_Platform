import type { AIMessage, AIMessageRole } from "./ai-provider.types.js";

export type PromptTemplateId = string;

export type PromptTemplateVersion = string;

export type PromptVariableValue = string | number | boolean | null;

export type PromptVariables = Readonly<Record<string, PromptVariableValue>>;

export interface PromptContext {
  readonly variables: PromptVariables;
}

export interface PromptMessageTemplate {
  readonly role: AIMessageRole;
  readonly template: string;
}

export interface PromptTemplate {
  readonly id: PromptTemplateId;
  readonly version: PromptTemplateVersion;
  readonly messages: readonly PromptMessageTemplate[];
  readonly requiredVariables: readonly string[];
  readonly description?: string;
}

export interface RenderedPrompt {
  readonly templateId: PromptTemplateId;
  readonly templateVersion: PromptTemplateVersion;
  readonly messages: readonly AIMessage[];
  readonly usedVariables: readonly string[];
}
