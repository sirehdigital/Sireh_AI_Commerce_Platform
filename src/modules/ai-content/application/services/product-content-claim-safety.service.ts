import type { Content } from "../../domain/index.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";
import { UnsafeContentClaimError } from "../errors/product-content.errors.js";

interface UnsafeClaimRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const UNSAFE_CLAIM_RULES: readonly UnsafeClaimRule[] = [
  { category: "guaranteed_results", pattern: /\b(guaranteed|100%\s*guaranteed|surefire)\b/iu },
  { category: "medical_treatment", pattern: /\b(cure|treats|heals|prevents disease|clinical proof)\b/iu },
  { category: "financial_outcome", pattern: /\b(get rich|risk-free profit|guaranteed income)\b/iu },
  { category: "fabricated_social_proof", pattern: /\b(\d+(?:,\d+)*\s*(?:reviews|customers|buyers)|rated\s*5)\b/iu },
  { category: "fabricated_certification", pattern: /\b(certified|award-winning|fda approved|clinically proven)\b/iu },
  { category: "fabricated_scarcity", pattern: /\b(limited stock|only \d+ left|while supplies last)\b/iu },
  { category: "false_urgency", pattern: /\b(act now|buy before it is gone|last chance)\b/iu },
  { category: "unsupported_superlative", pattern: /\b(best|perfect|number one|#1|world'?s leading)\b/iu },
  { category: "absolute_claim", pattern: /\b(always|never fails|works for everyone)\b/iu },
];

export interface ClaimSafetyFinding {
  readonly category: string;
  readonly contentId?: string;
}

export class ProductContentClaimSafetyService {
  public validatePackage(productContentPackage: ProductContentPackage): void {
    const findings = this.inspectPackage(productContentPackage);

    if (findings.length > 0) {
      throw new UnsafeContentClaimError("Generated product content contains unsupported claims.", {
        findings,
      });
    }
  }

  public inspectPackage(productContentPackage: ProductContentPackage): readonly ClaimSafetyFinding[] {
    return productContentPackage.contents.flatMap((content) => this.inspectContent(content));
  }

  public inspectText(value: string): readonly ClaimSafetyFinding[] {
    return UNSAFE_CLAIM_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => ({
      category: rule.category,
    }));
  }

  private inspectContent(content: Content): readonly ClaimSafetyFinding[] {
    const snapshot = content.snapshot();
    const text = [
      snapshot.headline.value,
      snapshot.body,
      ...Object.values(snapshot.structuredContent),
      snapshot.cta?.value ?? "",
    ].join(" ");

    return this.inspectText(text).map((finding) => ({
      ...finding,
      contentId: snapshot.id,
    }));
  }
}
