import { describe, expect, it } from "vitest";
import { InvalidAISafetyDecisionPolicyError } from "../safety/ai-output-safety.errors.js";
import type {
  AISafetyDecisionPolicy,
  AIOutputValidationFinding,
  AIOutputValidationResult,
  AIOutputValidationSeverity,
} from "../types/ai-output-safety.types.js";
import { AISafetyEvaluationService } from "./ai-safety-evaluation.service.js";

describe("AISafetyEvaluationService", () => {
  it("accepts a valid safety policy", () => {
    expect(() => evaluate([])).not.toThrow();
  });

  it("allows empty reject and warning lists", () => {
    expect(evaluate([], { rejectOnSeverities: [], warnOnSeverities: [] }).decision).toBe("allow");
  });

  it("rejects duplicate reject severity", () => {
    expect(() => evaluate([], { rejectOnSeverities: ["critical", "critical"], warnOnSeverities: [] })).toThrow(
      InvalidAISafetyDecisionPolicyError,
    );
  });

  it("rejects duplicate warning severity", () => {
    expect(() => evaluate([], { rejectOnSeverities: [], warnOnSeverities: ["warning", "warning"] })).toThrow(
      InvalidAISafetyDecisionPolicyError,
    );
  });

  it("rejects overlapping reject and warning severity", () => {
    expect(() => evaluate([], { rejectOnSeverities: ["error"], warnOnSeverities: ["error"] })).toThrow(
      InvalidAISafetyDecisionPolicyError,
    );
  });

  it("returns allow with no matching findings", () => {
    expect(evaluate([finding("info")]).decision).toBe("allow");
  });

  it("returns allow_with_warnings for configured warning severity", () => {
    expect(evaluate([finding("warning")]).decision).toBe("allow_with_warnings");
  });

  it("returns reject for configured reject severity", () => {
    expect(evaluate([finding("critical")]).decision).toBe("reject");
  });

  it("reject takes precedence over warnings", () => {
    expect(evaluate([finding("warning"), finding("critical")]).decision).toBe("reject");
  });

  it("preserves validation findings", () => {
    const findings = [finding("warning", "ONE"), finding("critical", "TWO")];

    expect(evaluate(findings).findings.map((item) => item.code)).toEqual(["ONE", "TWO"]);
  });

  it("does not mutate safety policy", () => {
    const policy = defaultPolicy();
    const snapshot = JSON.stringify(policy);

    evaluate([finding("warning")], policy);

    expect(JSON.stringify(policy)).toBe(snapshot);
  });

  it("produces serializable safety result", () => {
    const result = evaluate([finding("warning")]);

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("reports highest severity deterministically", () => {
    expect(evaluate([finding("info"), finding("error")]).highestSeverity).toBe("error");
  });

  it("returns readonly defensive findings", () => {
    expect(Object.isFrozen(evaluate([finding("warning")]).findings)).toBe(true);
  });
});

function evaluate(
  findings: readonly AIOutputValidationFinding[],
  policy: AISafetyDecisionPolicy = defaultPolicy(),
) {
  return new AISafetyEvaluationService().evaluate(validation(findings), policy);
}

function validation(findings: readonly AIOutputValidationFinding[]): AIOutputValidationResult {
  return {
    status: findings.some((item) => item.severity === "error" || item.severity === "critical")
      ? "invalid"
      : "valid",
    originalContent: "content",
    normalizedContent: "content",
    findings,
  };
}

function finding(severity: AIOutputValidationSeverity, code = `FINDING_${severity}`): AIOutputValidationFinding {
  return {
    ruleId: `rule-${severity}`,
    severity,
    code,
    message: "Finding message.",
  };
}

function defaultPolicy(): AISafetyDecisionPolicy {
  return {
    rejectOnSeverities: ["error", "critical"],
    warnOnSeverities: ["warning"],
  };
}
