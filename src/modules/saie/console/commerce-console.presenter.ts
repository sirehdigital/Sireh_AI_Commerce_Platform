import type { ShopifyDraftPreparationResult } from "../workflows/shopify-draft-preparation/index.js";
import type { CommerceConsoleFormat } from "./commerce-console.types.js";

export const presentCommerceConsoleResult = (
  result: ShopifyDraftPreparationResult,
  format: CommerceConsoleFormat,
): string => {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const proposal = result.preparationProposal.safeUpdateProposal;
  const skipped = result.preparationProposal.skippedSteps.map((step) => `${step.id}:${step.reason}`);
  const warnings = [...result.warnings.map((warning) => warning.message), ...result.preparationProposal.warnings];

  return [
    "SAIE Commerce Console — Shopify Draft Preparation",
    "",
    `Shop: ${result.shopDomain}`,
    `Product ID: ${result.shopifyProductIdentity.productId}`,
    `Handle: ${result.shopifyProductIdentity.handle}`,
    `Current status: ${result.currentShopifyStateSummary.status}`,
    `Store currency: ${result.currentShopifyStateSummary.storeCurrency}`,
    "",
    "Proposed Future Update",
    `Target status: ${proposal?.targetStatus ?? "DRAFT"}`,
    `Title: ${proposal?.title ?? "not generated"}`,
    `Vendor: ${proposal?.vendor ?? "not generated"}`,
    `Product type: ${proposal?.productType ?? "not generated"}`,
    `Template suffix: ${proposal?.templateSuffix ?? "not generated"}`,
    `Price: ${proposal?.pricing === undefined ? "skipped" : `${proposal.pricing.currency} ${proposal.pricing.price}`}`,
    `Compare-at: ${
      proposal?.pricing === undefined ? "skipped" : `${proposal.pricing.currency} ${proposal.pricing.compareAtPrice}`
    }`,
    "",
    "Preservation Snapshot",
    `Variants: ${result.currentShopifyStateSummary.variantIds.length}`,
    `SKUs: ${result.currentShopifyStateSummary.variantSkus.join(", ") || "none"}`,
    `Inventory items: ${result.currentShopifyStateSummary.inventoryItemIds.join(", ") || "none"}`,
    `Collections: ${result.currentShopifyStateSummary.collectionIds.join(", ") || "none"}`,
    "",
    "Safety",
    `Shopify read executed: ${result.executionSafetyReport.shopifyReadExecuted}`,
    `Shopify mutation executed: ${result.executionSafetyReport.shopifyMutationExecuted}`,
    `Product publication executed: ${result.executionSafetyReport.productPublicationExecuted}`,
    `Inventory mutation executed: ${result.executionSafetyReport.inventoryMutationExecuted}`,
    `Theme mutation executed: ${result.executionSafetyReport.themeMutationExecuted}`,
    `Human approval required: ${result.executionSafetyReport.humanApprovalRequired}`,
    "",
    `Skipped steps: ${skipped.length === 0 ? "none" : skipped.join(", ")}`,
    `Warnings: ${warnings.length === 0 ? "none" : warnings.join(" | ")}`,
    "",
  ].join("\n");
};
