import { AppError } from "../../shared/errors/app-error.js";
import type {
  AIExecutionPolicyId,
  AIExecutionTarget,
} from "../types/ai-execution-policy.types.js";

export class InvalidAIExecutionPolicyError extends AppError {
  public constructor(message: string, policyId?: AIExecutionPolicyId) {
    super({
      message,
      statusCode: 400,
      code: "AI_EXECUTION_POLICY_INVALID",
      ...(policyId === undefined ? {} : { details: { policyId } }),
    });

    this.name = "InvalidAIExecutionPolicyError";
  }
}

export class DuplicateAIExecutionTargetError extends AppError {
  public readonly providerId: string;
  public readonly model: string;

  public constructor(target: AIExecutionTarget, policyId: AIExecutionPolicyId) {
    super({
      message: `AI execution target "${target.providerId}/${target.model}" is duplicated.`,
      statusCode: 400,
      code: "AI_EXECUTION_TARGET_DUPLICATE",
      details: {
        policyId,
        providerId: target.providerId,
        model: target.model,
      },
    });

    this.name = "DuplicateAIExecutionTargetError";
    this.providerId = target.providerId;
    this.model = target.model;
  }
}

export class InvalidAIExecutionContextError extends AppError {
  public constructor(message: string) {
    super({
      message,
      statusCode: 400,
      code: "AI_EXECUTION_CONTEXT_INVALID",
    });

    this.name = "InvalidAIExecutionContextError";
  }
}
