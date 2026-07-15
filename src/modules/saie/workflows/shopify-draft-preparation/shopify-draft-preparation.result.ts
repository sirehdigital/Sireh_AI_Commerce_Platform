import type { ShopifyDraftPreparationSafetyReport } from "./shopify-draft-preparation.types.js";

export const createShopifyDraftPreparationSafetyReport = (): ShopifyDraftPreparationSafetyReport => ({
  shopifyReadExecuted: true,
  shopifyMutationExecuted: false,
  productPublicationExecuted: false,
  inventoryMutationExecuted: false,
  themeMutationExecuted: false,
  humanApprovalRequired: true,
});
