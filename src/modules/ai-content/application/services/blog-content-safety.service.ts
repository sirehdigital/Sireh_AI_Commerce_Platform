import { UnsafeBlogContentError } from "../errors/product-content.errors.js";

interface BlogSafetyRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const BLOG_SAFETY_RULES: readonly BlogSafetyRule[] = [
  { category: "medical_claim", pattern: /\b(cure|treats|heals|prevents disease|medical grade|clinically proven)\b/iu },
  { category: "guaranteed_outcome", pattern: /\b(guaranteed results|works for everyone|instant transformation|permanent result)\b/iu },
  { category: "fabricated_statistic", pattern: /\b\d{2,3}%\s+(of|better|improvement|increase|reduction)\b/iu },
  { category: "fabricated_citation", pattern: /\b(study published|researchers found|according to experts|journal of)\b/iu },
  { category: "fabricated_review", pattern: /\b(verified review|five-star review|customers are saying|thousands love)\b/iu },
  { category: "false_urgency", pattern: /\b(last chance|act now|only today|limited stock|selling out fast)\b/iu },
  { category: "unsupported_discount", pattern: /\b\d+%\s*off|coupon code|free gift\b/iu },
  { category: "before_after", pattern: /\bbefore and after|visible results in \d+\b/iu },
  { category: "competitor_attack", pattern: /\b(crushes|destroys|kills|humiliates)\s+[a-z0-9-]+/iu },
  { category: "discriminatory_targeting", pattern: /\b(race|religion|disabled people only|pregnant women only)\b/iu },
  { category: "manipulative_fear", pattern: /\b(if you do not buy|you will regret|dangerous mistake)\b/iu },
  { category: "deceptive_clickbait", pattern: /\byou won't believe|shocking truth|secret they do not want\b/iu },
  { category: "excessive_punctuation", pattern: /[!?]{4,}/u },
];

export interface BlogSafetyFinding {
  readonly category: string;
}

export class BlogContentSafetyService {
  public inspectText(value: string): readonly BlogSafetyFinding[] {
    return BLOG_SAFETY_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => ({ category: rule.category }));
  }

  public validateText(value: string): void {
    const findings = this.inspectText(value);
    if (findings.length > 0) {
      throw new UnsafeBlogContentError("Blog content contains unsupported or unsafe editorial claims.", { findings });
    }
  }
}
