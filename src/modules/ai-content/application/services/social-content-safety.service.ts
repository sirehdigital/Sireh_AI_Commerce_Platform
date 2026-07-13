import { UnsafeSocialContentError } from "../errors/product-content.errors.js";

interface SocialSafetyRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const SOCIAL_SAFETY_RULES: readonly SocialSafetyRule[] = [
  { category: "medical_claim", pattern: /\b(cure|treats|heals|prevents disease|medical grade)\b/iu },
  { category: "guaranteed_outcome", pattern: /\b(guaranteed|guarantee results|works for everyone)\b/iu },
  { category: "fabricated_review", pattern: /\b(customer says|verified review|five-star|5-star|rated 5)\b/iu },
  { category: "fabricated_scarcity", pattern: /\b(only \d+ left|limited stock|last chance|while supplies last)\b/iu },
  { category: "unsupported_discount", pattern: /\b(\d+%\s*off|coupon|promo code|free gift)\b/iu },
  { category: "competitor_attack", pattern: /\b(better than|destroys|crushes|kills)\s+[a-z0-9-]+/iu },
  { category: "spam_punctuation", pattern: /[!?]{4,}/u },
  { category: "discriminatory_targeting", pattern: /\b(race|religion|disabled|pregnant women only|single mothers only)\b/iu },
  { category: "fear_manipulation", pattern: /\b(you will regret|dangerous if you do not|fear of missing out)\b/iu },
];

export interface SocialSafetyFinding {
  readonly category: string;
}

export class SocialContentSafetyService {
  public inspectText(value: string): readonly SocialSafetyFinding[] {
    return SOCIAL_SAFETY_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => ({
      category: rule.category,
    }));
  }

  public validateText(value: string): void {
    const findings = this.inspectText(value);

    if (findings.length > 0) {
      throw new UnsafeSocialContentError("Social content contains unsupported or unsafe claims.", { findings });
    }
  }
}
