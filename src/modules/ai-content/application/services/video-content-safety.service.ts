import { UnsafeVideoContentError } from "../errors/product-content.errors.js";

interface VideoSafetyRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const VIDEO_SAFETY_RULES: readonly VideoSafetyRule[] = [
  { category: "medical_claim", pattern: /\b(cure|treats|heals|prevents disease|medical grade)\b/iu },
  { category: "guaranteed_outcome", pattern: /\b(guaranteed|guarantee results|works for everyone)\b/iu },
  { category: "fabricated_review", pattern: /\b(customer says|verified review|five-star|5-star|rated 5)\b/iu },
  { category: "fabricated_certification", pattern: /\b(certified|award-winning|fda approved|clinically proven)\b/iu },
  { category: "fabricated_statistic", pattern: /\b\d+%\s*(better|faster|improved|results)\b/iu },
  { category: "fabricated_discount", pattern: /\b(\d+%\s*off|coupon|promo code|free gift)\b/iu },
  { category: "false_urgency", pattern: /\b(last chance|act now|only \d+ left|limited stock)\b/iu },
  { category: "unsafe_usage", pattern: /\b(use on broken skin|ignore safety|unsafe use)\b/iu },
  { category: "before_after_claim", pattern: /\b(before and after|instant transformation|overnight results)\b/iu },
  { category: "competitor_attack", pattern: /\b(crushes|destroys|kills|better than)\s+[a-z0-9-]+/iu },
  { category: "discriminatory_targeting", pattern: /\b(race|religion|disabled|pregnant women only|single mothers only)\b/iu },
  { category: "spam_punctuation", pattern: /[!?]{4,}/u },
];

export interface VideoSafetyFinding {
  readonly category: string;
}

export class VideoContentSafetyService {
  public inspectText(value: string): readonly VideoSafetyFinding[] {
    return VIDEO_SAFETY_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => ({
      category: rule.category,
    }));
  }

  public validateText(value: string): void {
    const findings = this.inspectText(value);

    if (findings.length > 0) {
      throw new UnsafeVideoContentError("Video script contains unsupported or unsafe claims.", { findings });
    }
  }
}
