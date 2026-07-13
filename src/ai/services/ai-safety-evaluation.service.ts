import { InvalidAISafetyDecisionPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AISafetyDecisionPolicy,
  AISafetyEvaluationResult,
  AIOutputValidationResult,
  AIOutputValidationSeverity,
} from "../types/ai-output-safety.types.js";

const SEVERITY_ORDER: readonly AIOutputValidationSeverity[] = ["info", "warning", "error", "critical"];

export class AISafetyEvaluationService {
  public evaluate(
    validation: AIOutputValidationResult,
    policy: AISafetyDecisionPolicy,
  ): AISafetyEvaluationResult {
    this.validatePolicy(policy);

    const rejectSeverities = new Set(policy.rejectOnSeverities);
    const warningSeverities = new Set(policy.warnOnSeverities);
    const findings = Object.freeze(validation.findings.map((finding) => Object.freeze({ ...finding })));
    const highestSeverity = this.highestSeverity(findings.map((finding) => finding.severity));

    if (findings.some((finding) => rejectSeverities.has(finding.severity))) {
      return Object.freeze({
        decision: "reject",
        findings,
        ...(highestSeverity === undefined ? {} : { highestSeverity }),
      });
    }

    if (findings.some((finding) => warningSeverities.has(finding.severity))) {
      return Object.freeze({
        decision: "allow_with_warnings",
        findings,
        ...(highestSeverity === undefined ? {} : { highestSeverity }),
      });
    }

    return Object.freeze({
      decision: "allow",
      findings,
      ...(highestSeverity === undefined ? {} : { highestSeverity }),
    });
  }

  private validatePolicy(policy: AISafetyDecisionPolicy): void {
    const rejectSeverities = this.validateSeverityCollection(policy.rejectOnSeverities, "reject");
    const warnSeverities = this.validateSeverityCollection(policy.warnOnSeverities, "warning");

    for (const severity of rejectSeverities) {
      if (warnSeverities.has(severity)) {
        throw new InvalidAISafetyDecisionPolicyError("AI safety policy severities must not overlap.");
      }
    }
  }

  private validateSeverityCollection(
    severities: readonly AIOutputValidationSeverity[],
    label: string,
  ): ReadonlySet<AIOutputValidationSeverity> {
    const seen = new Set<AIOutputValidationSeverity>();

    for (const severity of severities) {
      if (!SEVERITY_ORDER.includes(severity)) {
        throw new InvalidAISafetyDecisionPolicyError(`AI safety ${label} severity is invalid.`);
      }

      if (seen.has(severity)) {
        throw new InvalidAISafetyDecisionPolicyError(`AI safety ${label} severities must not contain duplicates.`);
      }

      seen.add(severity);
    }

    return seen;
  }

  private highestSeverity(
    severities: readonly AIOutputValidationSeverity[],
  ): AIOutputValidationSeverity | undefined {
    let highestIndex = -1;

    for (const severity of severities) {
      highestIndex = Math.max(highestIndex, SEVERITY_ORDER.indexOf(severity));
    }

    return highestIndex === -1 ? undefined : SEVERITY_ORDER[highestIndex];
  }
}
