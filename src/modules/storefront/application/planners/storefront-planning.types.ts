import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { StorefrontProfile } from "../../domain/index.js";

export interface StorefrontPlanningContext {
  readonly profile: StorefrontProfile;
  readonly products: readonly ProductDraft[];
  readonly mediaReferencesByProductId: Readonly<Record<string, readonly string[]>>;
  readonly locale: string;
  readonly markets: readonly string[];
}

export interface StorefrontPlanningReport {
  readonly validation: {
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly requiresReview: boolean;
  };
  readonly score: {
    readonly overall: number;
    readonly homepage: number;
    readonly navigation: number;
    readonly productCoverage: number;
    readonly collectionCoverage: number;
    readonly contentCompleteness: number;
    readonly brandCompleteness: number;
  };
}
