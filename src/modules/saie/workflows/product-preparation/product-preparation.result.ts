import type {
  ProductPreparationInput,
  ProductPreparationRequirement,
  ProductPreparationSafeUpdateProposal,
} from "./product-preparation.types.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import type { ProductCopy, ShopifyProductPayload } from "../../../ai-product/types/product.types.js";
import { PRODUCT_PREPARATION_EXCLUDED_MUTATIONS } from "./product-preparation.steps.js";

export const createSafeUpdateProposal = (
  input: ProductPreparationInput,
  mapping: ShopifyProductPayload | undefined,
  copy: ProductCopy | undefined,
  pricing: ProductPricingRecommendation | undefined,
): ProductPreparationSafeUpdateProposal => ({
  targetStatus: "DRAFT",
  ...(mapping === undefined ? {} : { title: mapping.title }),
  ...(mapping === undefined ? {} : { descriptionHtml: mapping.descriptionHtml }),
  ...(mapping?.vendor === undefined ? {} : { vendor: mapping.vendor }),
  ...(mapping?.productType === undefined ? {} : { productType: mapping.productType }),
  tagsToAdd: mapping?.tags ?? [],
  approvedTags: mapping?.tags ?? [],
  tagPolicy: "merge",
  ...(copy?.seoTitle === undefined ? {} : { seoTitle: copy.seoTitle }),
  ...(copy?.seoDescription === undefined ? {} : { seoDescription: copy.seoDescription }),
  ...(pricing === undefined
    ? {}
    : {
        pricing: {
          currency: pricing.currency,
          price: pricing.recommendedSellingPrice,
          compareAtPrice: pricing.recommendedCompareAtPrice,
        },
      }),
  collectionReferences: [...input.brandContext.preferredCollections],
  templateSuffix: input.brandContext.templateSuffix,
  excludedMutations: [...PRODUCT_PREPARATION_EXCLUDED_MUTATIONS],
});

export const createPreservationRequirements = (
  input: ProductPreparationInput,
): readonly ProductPreparationRequirement[] => {
  const state = input.currentShopifyState;

  if (state === undefined) {
    return [
      {
        subject: "currentShopifyState",
        status: "required-for-future-execution",
        expectedValue: "read-only Shopify preservation snapshot must be supplied before mutation approval",
      },
    ];
  }

  return [
    { subject: "exact product ID", status: "required-for-future-execution", expectedValue: state.productId },
    { subject: "exact handle", status: "required-for-future-execution", expectedValue: state.handle },
    { subject: "variant IDs", status: "required-for-future-execution", expectedValue: [...state.variantIds] },
    ...(state.variantTitles === undefined
      ? []
      : [
          {
            subject: "variant titles",
            status: "required-for-future-execution" as const,
            expectedValue: [...state.variantTitles],
          },
        ]),
    { subject: "variant SKUs", status: "required-for-future-execution", expectedValue: [...state.variantSkus] },
    {
      subject: "inventory item IDs",
      status: "required-for-future-execution",
      expectedValue: [...state.inventoryItemIds],
    },
    {
      subject: "inventory tracking",
      status: "required-for-future-execution",
      expectedValue: state.inventoryTracked,
    },
    {
      subject: "inventory policies",
      status: "required-for-future-execution",
      expectedValue: [...state.inventoryPolicies],
    },
    {
      subject: "inventory locations and quantities",
      status: "required-for-future-execution",
      expectedValue: state.inventoryLocations.map((location) => ({
        locationId: location.locationId,
        locationName: location.locationName,
        quantities: { ...location.quantities },
      })),
    },
    {
      subject: "AutoDS-managed linkage by omission",
      status: "required-for-future-execution",
      expectedValue: "do not mutate supplier, fulfillment, SKU, inventory item, or variant identity fields",
    },
    ...(state.collectionIds === undefined
      ? []
      : [
          {
            subject: "collection IDs",
            status: "required-for-future-execution" as const,
            expectedValue: [...state.collectionIds],
          },
        ]),
    ...(state.templateSuffix === undefined
      ? []
      : [
          {
            subject: "template suffix",
            status: "required-for-future-execution" as const,
            expectedValue: state.templateSuffix,
          },
        ]),
    ...(state.storeCurrency === undefined
      ? []
      : [
          {
            subject: "store currency",
            status: "required-for-future-execution" as const,
            expectedValue: state.storeCurrency,
          },
        ]),
  ];
};
