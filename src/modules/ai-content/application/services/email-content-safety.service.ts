import { UnsafeEmailContentError } from "../errors/product-content.errors.js";

interface EmailSafetyRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const EMAIL_SAFETY_RULES: readonly EmailSafetyRule[] = [
  { category: "medical_claim", pattern: /\b(cure|treats|heals|prevents disease|medical grade)\b/iu },
  { category: "guaranteed_outcome", pattern: /\b(guaranteed|guarantee results|works for everyone)\b/iu },
  { category: "fabricated_review", pattern: /\b(customer says|verified review|five-star|5-star|rated 5)\b/iu },
  { category: "fabricated_offer", pattern: /\b(\d+%\s*off|coupon|promo code|free gift)\b/iu },
  { category: "false_scarcity", pattern: /\b(last chance|only \d+ left|limited stock|countdown)\b/iu },
  { category: "fake_stock", pattern: /\b(back in stock|stock is back)\b/iu },
  { category: "delivery_promise", pattern: /\b(guaranteed delivery|free returns forever|refund guaranteed)\b/iu },
  { category: "deceptive_subject", pattern: /^(re|fwd):/iu },
  { category: "spam_punctuation", pattern: /[!?]{4,}/u },
  { category: "spam_caps", pattern: /\b[A-Z]{8,}\b/u },
  { category: "competitor_attack", pattern: /\b(crushes|destroys|kills|better than)\s+[a-z0-9-]+/iu },
  { category: "discriminatory_targeting", pattern: /\b(race|religion|disabled|pregnant women only|single mothers only)\b/iu },
];

export interface EmailSafetyFinding {
  readonly category: string;
}

export class EmailContentSafetyService {
  public inspectText(value: string): readonly EmailSafetyFinding[] {
    return EMAIL_SAFETY_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => ({ category: rule.category }));
  }

  public validateText(value: string): void {
    const findings = this.inspectText(value);
    if (findings.length > 0) {
      throw new UnsafeEmailContentError("Email content contains unsupported or unsafe claims.", { findings });
    }
  }
}
