import type { ProductPreparationStepId } from "./product-preparation.types.js";

export const PRODUCT_PREPARATION_STEP_ORDER: readonly ProductPreparationStepId[] = [
  "ValidateInput",
  "NormalizeProduct",
  "AnalyzeProduct",
  "AssessProductRisk",
  "GenerateProductBranding",
  "GenerateProductCopy",
  "RecommendProductPricing",
  "MapProductForShopify",
  "PrepareSafeUpdateProposal",
  "RequireHumanApproval",
];

export const PRODUCT_PREPARATION_EXCLUDED_MUTATIONS = [
  "product recreation",
  "variant recreation",
  "SKU mutation",
  "inventory item mutation",
  "inventory quantity mutation",
  "location mutation",
  "fulfillment mutation",
  "supplier-link mutation",
  "publication mutation",
] as const;
