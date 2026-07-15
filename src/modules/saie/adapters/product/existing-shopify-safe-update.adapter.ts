import { BaseProductReadinessAdapter } from "./base-product-readiness.adapter.js";

export class ExistingShopifySafeUpdateAdapter extends BaseProductReadinessAdapter {
  public constructor(dependency?: unknown) {
    super(
      {
        port: "ShopifySafeUpdatePort",
        adapterName: "ExistingShopifySafeUpdateAdapter",
        existingServiceName: "ShopifyProductUpdateService",
        existingServiceFile: "src/integrations/shopify/shopify-product-update.service.ts",
        existingInputContract: "SafeShopifyProductUpdateCommand",
        existingOutputContract: "SafeShopifyProductUpdateAudit",
        compatibility: "partial",
        externalCallRisk: "external-call-and-mutation",
        mutationRisk: "external-call-and-mutation",
        readinessStatus: "blocked",
        canBeCreatedWithoutBusinessLogicChanges: true,
        notes: [
          "Metadata-only mapping to ShopifyProductUpdateService.update(command).",
          "Blocked in SAIE-01.03 because the existing service performs Shopify GraphQL mutations when invoked.",
          "Future execution requires exact product ID or exact handle.",
          "Future execution requires approved HTML content and verified store currency.",
          "Future execution requires preservation checks and forced DRAFT status.",
          "Future execution requires human approval and post-mutation read-back audit.",
        ],
      },
      dependency,
    );
  }
}
