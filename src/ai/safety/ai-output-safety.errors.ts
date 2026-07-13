export class InvalidAIOutputValidationPolicyError extends Error {
  public readonly policyId?: string;

  public constructor(message: string, policyId?: string) {
    super(message);
    this.name = "InvalidAIOutputValidationPolicyError";

    if (policyId !== undefined) {
      this.policyId = policyId;
    }
  }
}

export class InvalidAISafetyDecisionPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidAISafetyDecisionPolicyError";
  }
}

export class InvalidAIFallbackPolicyError extends Error {
  public readonly policyId?: string;

  public constructor(message: string, policyId?: string) {
    super(message);
    this.name = "InvalidAIFallbackPolicyError";

    if (policyId !== undefined) {
      this.policyId = policyId;
    }
  }
}
