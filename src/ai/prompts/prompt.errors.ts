import { AppError } from "../../shared/errors/app-error.js";
import type { PromptTemplateId } from "../types/prompt.types.js";

export class InvalidPromptTemplateError extends AppError {
  public constructor(message: string, templateId?: PromptTemplateId) {
    super({
      message,
      statusCode: 400,
      code: "PROMPT_TEMPLATE_INVALID",
      ...(templateId === undefined ? {} : { details: { templateId } }),
    });

    this.name = "InvalidPromptTemplateError";
  }
}

export class MissingPromptVariableError extends AppError {
  public readonly variableName: string;

  public constructor(variableName: string, templateId: PromptTemplateId) {
    super({
      message: `Required prompt variable "${variableName}" is missing.`,
      statusCode: 400,
      code: "PROMPT_VARIABLE_MISSING",
      details: { variableName, templateId },
    });

    this.name = "MissingPromptVariableError";
    this.variableName = variableName;
  }
}

export class UnresolvedPromptPlaceholderError extends AppError {
  public readonly variableName: string;

  public constructor(variableName: string, templateId: PromptTemplateId) {
    super({
      message: `Prompt placeholder "${variableName}" cannot be resolved from context.`,
      statusCode: 400,
      code: "PROMPT_PLACEHOLDER_UNRESOLVED",
      details: { variableName, templateId },
    });

    this.name = "UnresolvedPromptPlaceholderError";
    this.variableName = variableName;
  }
}

export class DuplicateRequiredPromptVariableError extends AppError {
  public readonly variableName: string;

  public constructor(variableName: string, templateId: PromptTemplateId) {
    super({
      message: `Required prompt variable "${variableName}" is declared more than once.`,
      statusCode: 400,
      code: "PROMPT_REQUIRED_VARIABLE_DUPLICATE",
      details: { variableName, templateId },
    });

    this.name = "DuplicateRequiredPromptVariableError";
    this.variableName = variableName;
  }
}
