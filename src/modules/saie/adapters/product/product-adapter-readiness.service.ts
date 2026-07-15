import { PRODUCT_AGENT_PORT_IDENTIFIERS } from "../../agents/product/index.js";
import type { ProductAgentPortIdentifier } from "../../agents/product/index.js";
import { ExistingProductAnalysisAdapter } from "./existing-product-analysis.adapter.js";
import { ExistingProductBrandingAdapter } from "./existing-product-branding.adapter.js";
import { ExistingProductCopyAdapter } from "./existing-product-copy.adapter.js";
import { ExistingProductNormalizationAdapter } from "./existing-product-normalization.adapter.js";
import { ExistingProductPricingAdapter } from "./existing-product-pricing.adapter.js";
import { ExistingProductRiskAdapter } from "./existing-product-risk.adapter.js";
import { ExistingShopifyProductMappingAdapter } from "./existing-shopify-product-mapping.adapter.js";
import { ExistingShopifySafeUpdateAdapter } from "./existing-shopify-safe-update.adapter.js";
import type {
  ProductAdapterReadinessItem,
  ProductAdapterReadinessMode,
  ProductAdapterReadinessReport,
  ProductAdapterReadinessStatus,
  ProductReadinessAdapter,
} from "./product-adapter.types.js";
import {
  DuplicateProductAdapterPortError,
  UnsupportedProductAdapterReadinessModeError,
} from "./product-adapter.types.js";

const MISSING_PORT_STATUS: ProductAdapterReadinessStatus = "unavailable";

export class ProductAdapterReadinessService {
  private readonly adapters: readonly ProductReadinessAdapter[];

  public constructor(adapters: readonly ProductReadinessAdapter[] = createDefaultProductReadinessAdapters()) {
    this.adapters = [...adapters];
    this.assertUniquePorts(this.adapters.map((adapter) => adapter.getReadinessItem()));
  }

  public createReport(
    generatedAt: Date = new Date(),
    mode: ProductAdapterReadinessMode = "readiness-only",
  ): ProductAdapterReadinessReport {
    if (mode !== "readiness-only") {
      throw new UnsupportedProductAdapterReadinessModeError(mode);
    }

    const adapterItems = this.adapters
      .map((adapter) => adapter.getReadinessItem())
      .sort((left, right) => this.sortByDeclaredPortOrder(left.port, right.port));
    const itemsWithMissingPorts = [
      ...adapterItems,
      ...this.buildMissingPortItems(adapterItems),
    ].sort((left, right) => this.sortByDeclaredPortOrder(left.port, right.port));

    return {
      agentType: "ProductAgent",
      mode,
      adapters: itemsWithMissingPorts,
      readyPorts: this.portsByStatus(itemsWithMissingPorts, "ready"),
      partialPorts: this.portsByStatus(itemsWithMissingPorts, "partial"),
      unavailablePorts: this.portsByStatus(itemsWithMissingPorts, "unavailable"),
      blockedPorts: this.portsByStatus(itemsWithMissingPorts, "blocked"),
      safeForExecution: false,
      generatedAt: generatedAt.toISOString(),
    };
  }

  private assertUniquePorts(items: readonly ProductAdapterReadinessItem[]): void {
    const seenPorts = new Set<ProductAgentPortIdentifier>();

    for (const item of items) {
      if (seenPorts.has(item.port)) {
        throw new DuplicateProductAdapterPortError(item.port);
      }

      seenPorts.add(item.port);
    }
  }

  private buildMissingPortItems(
    adapterItems: readonly ProductAdapterReadinessItem[],
  ): readonly ProductAdapterReadinessItem[] {
    const mappedPorts = new Set(adapterItems.map((item) => item.port));

    return PRODUCT_AGENT_PORT_IDENTIFIERS.filter((port) => !mappedPorts.has(port)).map((port) => ({
      port,
      adapterName: "UnmappedProductReadinessAdapter",
      existingServiceName: "Unavailable",
      existingServiceFile: "Unavailable",
      existingInputContract: "Unavailable",
      existingOutputContract: "Unavailable",
      compatibility: "unavailable",
      externalCallRisk: "none",
      mutationRisk: "none",
      readinessStatus: MISSING_PORT_STATUS,
      canBeCreatedWithoutBusinessLogicChanges: false,
      notes: [`No safe existing SACP service mapping was declared for ${port} in SAIE-01.03.`],
    }));
  }

  private portsByStatus(
    items: readonly ProductAdapterReadinessItem[],
    status: ProductAdapterReadinessStatus,
  ): readonly ProductAgentPortIdentifier[] {
    return items
      .filter((item) => item.readinessStatus === status)
      .map((item) => item.port)
      .sort((left, right) => this.sortByDeclaredPortOrder(left, right));
  }

  private sortByDeclaredPortOrder(
    left: ProductAgentPortIdentifier,
    right: ProductAgentPortIdentifier,
  ): number {
    return PRODUCT_AGENT_PORT_IDENTIFIERS.indexOf(left) - PRODUCT_AGENT_PORT_IDENTIFIERS.indexOf(right);
  }
}

export const createDefaultProductReadinessAdapters = (): readonly ProductReadinessAdapter[] => [
  new ExistingProductNormalizationAdapter(),
  new ExistingProductAnalysisAdapter(),
  new ExistingProductRiskAdapter(),
  new ExistingProductBrandingAdapter(),
  new ExistingProductCopyAdapter(),
  new ExistingProductPricingAdapter(),
  new ExistingShopifyProductMappingAdapter(),
  new ExistingShopifySafeUpdateAdapter(),
];
