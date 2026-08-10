export const POLICY_RISK_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type PolicyRiskSeverity = (typeof POLICY_RISK_SEVERITIES)[number];

export const POLICY_RISK_CATEGORIES = [
  "UNSUPPORTED_CLAIM",
  "MEDICAL_OR_CLINICAL_CLAIM",
  "GUARANTEED_OUTCOME",
  "FABRICATED_SOCIAL_PROOF",
  "BODY_SHAMING",
  "INSECURITY_EXPLOITATION",
  "SENSITIVE_ATTRIBUTE_INFERENCE",
  "DECEPTIVE_URGENCY",
  "OTHER",
] as const;

export type PolicyRiskCategory = (typeof POLICY_RISK_CATEGORIES)[number];

export interface PolicyRiskFinding {
  readonly category: PolicyRiskCategory;
  readonly severity: PolicyRiskSeverity;
  readonly code: string;
  readonly message: string;
  readonly evidence: string;
}

export interface PolicyRiskAssessment {
  readonly overallRisk: PolicyRiskSeverity;
  readonly requiresHumanReview: boolean;
  readonly findings: readonly PolicyRiskFinding[];
}
