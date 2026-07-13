import {
  DuplicateRequiredPromptVariableError,
  InvalidPromptTemplateError,
  MissingPromptVariableError,
  UnresolvedPromptPlaceholderError,
} from "../prompts/prompt.errors.js";
import type { AIMessage } from "../types/ai-provider.types.js";
import type {
  PromptContext,
  PromptMessageTemplate,
  PromptTemplate,
  PromptVariableValue,
  RenderedPrompt,
} from "../types/prompt.types.js";

const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/gu;

export class PromptRendererService {
  public render(template: PromptTemplate, context: PromptContext): RenderedPrompt {
    this.validateTemplate(template);
    this.validateRequiredVariables(template, context);

    const usedVariables: string[] = [];
    const messages = template.messages.map((message) => {
      return {
        role: message.role,
        content: this.renderMessageTemplate(template, message, context, usedVariables),
      };
    });

    return {
      templateId: template.id,
      templateVersion: template.version,
      messages,
      usedVariables: Object.freeze([...usedVariables]),
    };
  }

  private validateTemplate(template: PromptTemplate): void {
    if (template.id.trim().length === 0) {
      throw new InvalidPromptTemplateError("Prompt template ID must not be empty.");
    }

    if (template.version.trim().length === 0) {
      throw new InvalidPromptTemplateError("Prompt template version must not be empty.", template.id);
    }

    if (template.messages.length === 0) {
      throw new InvalidPromptTemplateError("Prompt template must contain at least one message.", template.id);
    }

    this.validateMessages(template);
    this.validateRequiredVariableNames(template);
    this.validatePlaceholderNames(template);
  }

  private validateMessages(template: PromptTemplate): void {
    for (const message of template.messages) {
      if (message.template.trim().length === 0) {
        throw new InvalidPromptTemplateError("Prompt message template must not be empty.", template.id);
      }
    }
  }

  private validateRequiredVariableNames(template: PromptTemplate): void {
    const seen = new Set<string>();

    for (const variableName of template.requiredVariables) {
      if (!this.isValidVariableName(variableName)) {
        throw new InvalidPromptTemplateError(
          `Required prompt variable "${variableName}" is invalid.`,
          template.id,
        );
      }

      if (seen.has(variableName)) {
        throw new DuplicateRequiredPromptVariableError(variableName, template.id);
      }

      seen.add(variableName);
    }
  }

  private validatePlaceholderNames(template: PromptTemplate): void {
    for (const message of template.messages) {
      for (const placeholderName of this.extractPlaceholderNames(message.template)) {
        if (!this.isValidVariableName(placeholderName)) {
          throw new InvalidPromptTemplateError(
            `Prompt placeholder "${placeholderName}" is invalid.`,
            template.id,
          );
        }
      }
    }
  }

  private validateRequiredVariables(template: PromptTemplate, context: PromptContext): void {
    for (const variableName of template.requiredVariables) {
      if (!this.hasVariable(context, variableName)) {
        throw new MissingPromptVariableError(variableName, template.id);
      }
    }
  }

  private renderMessageTemplate(
    template: PromptTemplate,
    message: PromptMessageTemplate,
    context: PromptContext,
    usedVariables: string[],
  ): AIMessage["content"] {
    return message.template.replace(PLACEHOLDER_PATTERN, (_placeholder, rawVariableName: string) => {
      const variableName = rawVariableName.trim();

      if (!this.isValidVariableName(variableName)) {
        throw new InvalidPromptTemplateError(
          `Prompt placeholder "${variableName}" is invalid.`,
          template.id,
        );
      }

      if (!this.hasVariable(context, variableName)) {
        throw new UnresolvedPromptPlaceholderError(variableName, template.id);
      }

      if (!usedVariables.includes(variableName)) {
        usedVariables.push(variableName);
      }

      return this.toPromptString(this.resolveVariable(template, context, variableName));
    });
  }

  private resolveVariable(
    template: PromptTemplate,
    context: PromptContext,
    variableName: string,
  ): PromptVariableValue {
    if (!this.hasVariable(context, variableName)) {
      throw new UnresolvedPromptPlaceholderError(variableName, template.id);
    }

    const value = context.variables[variableName];

    if (value === undefined) {
      throw new UnresolvedPromptPlaceholderError(variableName, template.id);
    }

    return value;
  }

  private extractPlaceholderNames(value: string): readonly string[] {
    const placeholders: string[] = [];

    for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
      const rawVariableName = match[1];

      if (rawVariableName !== undefined) {
        placeholders.push(rawVariableName.trim());
      }
    }

    return placeholders;
  }

  private hasVariable(context: PromptContext, variableName: string): boolean {
    return Object.prototype.hasOwnProperty.call(context.variables, variableName);
  }

  private isValidVariableName(variableName: string): boolean {
    return VARIABLE_NAME_PATTERN.test(variableName);
  }

  private toPromptString(value: PromptVariableValue): string {
    if (value === null) {
      return "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  }
}
