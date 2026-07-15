import type { ProductPreparationShopifyState } from "../product-preparation/index.js";
import type { ShopifyDraftPreparationProductSnapshot } from "./shopify-draft-preparation.types.js";

export class ShopifyPreservationSnapshotBuilder {
  public build(snapshot: ShopifyDraftPreparationProductSnapshot): ProductPreparationShopifyState {
    return {
      productId: snapshot.id,
      handle: snapshot.handle,
      currentStatus: snapshot.status,
      variantIds: snapshot.variants.map((variant) => variant.id),
      variantTitles: snapshot.variants.map((variant) => variant.title),
      variantSkus: snapshot.variants.map((variant) => variant.sku),
      inventoryItemIds: snapshot.variants.map((variant) => variant.inventoryItemId),
      inventoryTracked: snapshot.variants.every((variant) => variant.inventoryTracked),
      inventoryPolicies: snapshot.variants.map((variant) => variant.inventoryPolicy),
      inventoryLocations: snapshot.variants.flatMap((variant) =>
        variant.inventoryQuantities.map((quantity) => ({
          locationId: quantity.locationId,
          locationName: quantity.locationName,
          quantities: {
            [variant.inventoryItemId]: quantity.quantity,
          },
        })),
      ),
      collectionIds: snapshot.collections.map((collection) => collection.id),
      ...(snapshot.templateSuffix === undefined ? {} : { templateSuffix: snapshot.templateSuffix }),
      storeCurrency: snapshot.storeCurrency,
    };
  }
}
