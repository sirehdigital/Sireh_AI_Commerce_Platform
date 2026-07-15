import type { ProductPreparationInput } from "./product-preparation.types.js";
import { ProductPreparationWorkflowError } from "./product-preparation.types.js";

const hasText = (value: string): boolean => value.trim().length > 0;

export const validateProductPreparationInput = (input: ProductPreparationInput): void => {
  if (input.executionMode !== "proposal-only") {
    throw new ProductPreparationWorkflowError(`Unsupported execution mode: ${String(input.executionMode)}.`);
  }

  if (!hasText(input.sourceProduct.sourceId)) {
    throw new ProductPreparationWorkflowError("Source product sourceId is required.");
  }

  if (!hasText(input.sourceProduct.title)) {
    throw new ProductPreparationWorkflowError("Source product title is required.");
  }

  if (!hasText(input.sourceProduct.sourceUrl)) {
    throw new ProductPreparationWorkflowError("Source product sourceUrl is required.");
  }

  if (!hasText(input.brandContext.sellingCurrency)) {
    throw new ProductPreparationWorkflowError("Brand context selling currency is required.");
  }

  if (!Number.isFinite(input.sourceProduct.cost.productCost) || input.sourceProduct.cost.productCost < 0) {
    throw new ProductPreparationWorkflowError("Supplier product cost must be a non-negative finite number.");
  }

  if (input.sourceProduct.variants.length === 0) {
    throw new ProductPreparationWorkflowError("At least one product variant is required.");
  }
};
