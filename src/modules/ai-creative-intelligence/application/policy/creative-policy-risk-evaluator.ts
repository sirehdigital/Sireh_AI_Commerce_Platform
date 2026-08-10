import {
  type PolicyRiskAssessment,
  type PolicyRiskCategory,
  type PolicyRiskFinding,
  type PolicyRiskSeverity,
} from "../../domain/models/creative-policy-risk.model.js";
import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";

interface RiskRule {
  readonly category: PolicyRiskCategory;
  readonly severity: PolicyRiskSeverity;
  readonly code: string;
  readonly message: string;
  readonly pattern: RegExp;
}

const RISK_RULES: readonly RiskRule[] = [
  {
    category: "UNSUPPORTED_CLAIM",
    severity: "HIGH",
    code: "UNSUPPORTED_CLAIM_PROVEN",
    message: "Creative uses evidence-style claim language that should be substantiated before use.",
    pattern: /\b(?:proven to|scientifically proven|100% effective|works for everyone|instant results|permanent results)\b/iu,
  },
  {
    category: "MEDICAL_OR_CLINICAL_CLAIM",
    severity: "CRITICAL",
    code: "MEDICAL_OR_CLINICAL_CLAIM_DETECTED",
    message: "Creative uses medical or clinical claim language that requires human review.",
    pattern: /\b(?:clinically proven|doctor recommended|treats?|cures?|prevents? disease|diagnoses?|medical grade|clinical efficacy)\b/iu,
  },
  {
    category: "GUARANTEED_OUTCOME",
    severity: "HIGH",
    code: "GUARANTEED_OUTCOME_PROMISE",
    message: "Creative promises a guaranteed outcome.",
    pattern: /\b(?:guaranteed results|guaranteed sales|guaranteed income|guaranteed transformation|guaranteed performance|guaranteed health)\b/iu,
  },
  {
    category: "FABRICATED_SOCIAL_PROOF",
    severity: "HIGH",
    code: "FABRICATED_SOCIAL_PROOF_RISK",
    message: "Creative uses unsupported social proof or authority framing.",
    pattern: /\b(?:five-star reviews?|thousands of happy customers|millions trust|everyone is buying|as seen on|celebrity approved)\b/iu,
  },
  {
    category: "BODY_SHAMING",
    severity: "CRITICAL",
    code: "BODY_SHAMING_LANGUAGE",
    message: "Creative uses appearance-shaming language.",
    pattern: /\b(?:ugly|flabby|disgusting|hide your|fix your body|embarrassing skin)\b/iu,
  },
  {
    category: "INSECURITY_EXPLOITATION",
    severity: "HIGH",
    code: "INSECURITY_EXPLOITATION_LANGUAGE",
    message: "Creative pressures users through insecurity framing.",
    pattern: /\b(?:stop being ashamed|nobody will want you|you look old|look younger or lose|are you tired of being unattractive)\b/iu,
  },
  {
    category: "SENSITIVE_ATTRIBUTE_INFERENCE",
    severity: "HIGH",
    code: "SENSITIVE_ATTRIBUTE_INFERENCE_TEXT",
    message: "Creative explicitly infers or targets a sensitive personal attribute.",
    pattern: /\b(?:because you are pregnant|as a disabled person|for your depression|because of your religion|your ethnicity|your sexual orientation)\b/iu,
  },
  {
    category: "DECEPTIVE_URGENCY",
    severity: "MEDIUM",
    code: "DECEPTIVE_URGENCY_PRESSURE",
    message: "Creative uses manipulative urgency language.",
    pattern: /\b(?:act now or lose everything|last chance forever|you will regret missing this|everyone is buying this)\b/iu,
  },
];

const SEVERITY_RANK: Readonly<Record<PolicyRiskSeverity, number>> = Object.freeze({
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
});

export class CreativePolicyRiskEvaluator {
  public evaluate(record: CreativeIntelligenceRecord): PolicyRiskAssessment {
    const text = this.collectText(record);
    const findings = RISK_RULES.flatMap((rule) => this.findMatches(rule, text));
    const overallRisk = this.deriveOverallRisk(findings);

    return {
      overallRisk,
      requiresHumanReview: overallRisk === "HIGH" || overallRisk === "CRITICAL",
      findings,
    };
  }

  private collectText(record: CreativeIntelligenceRecord): string {
    return [
      field("hook", record.brief.hook),
      field("headline", record.brief.headline),
      field("primaryText", record.brief.primaryText),
      field("description", record.brief.description),
      field("callToAction", record.brief.callToAction),
      field("visualConcept", record.brief.visualConcept),
      field("brandName", record.brandName),
      field("brandTone", record.brandTone),
    ]
      .filter((value) => value.length > 0)
      .join(" ");
  }

  private findMatches(rule: RiskRule, text: string): readonly PolicyRiskFinding[] {
    const match = rule.pattern.exec(text);
    if (match === null) {
      return [];
    }

    return [
      {
        category: rule.category,
        severity: rule.severity,
        code: rule.code,
        message: rule.message,
        evidence: trimEvidence(match[0]),
      },
    ];
  }

  private deriveOverallRisk(findings: readonly PolicyRiskFinding[]): PolicyRiskSeverity {
    if (findings.length === 0) {
      return "LOW";
    }

    return findings.reduce<PolicyRiskSeverity>(
      (highest, finding) => (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highest] ? finding.severity : highest),
      "LOW",
    );
  }
}

function field(name: string, value: string | undefined): string {
  return value === undefined ? "" : `${name}: ${value}`;
}

function trimEvidence(value: string): string {
  return value.trim().slice(0, 120);
}
