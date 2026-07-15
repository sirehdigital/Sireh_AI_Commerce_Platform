import type {
  ShopifyDraftPreparationProductSnapshot,
  ShopifyDraftPreparationVariantSnapshot,
} from "../../workflows/shopify-draft-preparation/index.js";
import type {
  ShopifyProductByIdReadResponse,
  ShopifyProductReadConnection,
  ShopifyProductReadNode,
  ShopifyProductsByHandleReadResponse,
} from "./shopify-product-read.types.js";

export class ShopifyProductReadMapper {
  public mapProductByIdResponse(response: ShopifyProductByIdReadResponse): ShopifyDraftPreparationProductSnapshot | null {
    if (response.product === null || response.product === undefined) {
      return null;
    }

    return this.mapProduct(response.product, response.shop.currencyCode);
  }

  public mapProductsByHandleResponse(
    response: ShopifyProductsByHandleReadResponse,
  ): readonly ShopifyDraftPreparationProductSnapshot[] {
    return response.products.edges.map((edge) => this.mapProduct(edge.node, response.shop.currencyCode));
  }

  private mapProduct(
    product: ShopifyProductReadNode,
    storeCurrency: ShopifyDraftPreparationProductSnapshot["storeCurrency"],
  ): ShopifyDraftPreparationProductSnapshot {
    const variants = product.variants.edges.map((edge) => this.mapVariant(edge.node));

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      descriptionHtml: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      status: product.status,
      tags: [...product.tags],
      ...(this.hasText(product.templateSuffix) ? { templateSuffix: product.templateSuffix.trim() } : {}),
      ...(this.hasText(product.seo?.title) ? { seoTitle: product.seo.title.trim() } : {}),
      ...(this.hasText(product.seo?.description) ? { seoDescription: product.seo.description.trim() } : {}),
      collections: product.collections.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title,
      })),
      media: product.media.edges
        .map((edge) => ({
          id: edge.node.id,
          url: edge.node.image?.url ?? "",
          ...(this.hasText(edge.node.alt) ? { altText: edge.node.alt.trim() } : {}),
        }))
        .filter((media) => media.url.trim().length > 0),
      options: product.options.map((option) => ({
        name: option.name,
        values: [...option.values],
      })),
      variants,
      storeCurrency,
      ...(this.hasText(product.onlineStoreUrl) ? { onlineStoreUrl: product.onlineStoreUrl.trim() } : {}),
      productDataTruncated: this.isTruncated(product.collections) || this.isTruncated(product.media),
      variantDataTruncated:
        this.isTruncated(product.variants) ||
        variants.some((variant) => variant.inventoryQuantities.length === 0),
      inventoryDataIncomplete: variants.some((variant) => variant.inventoryItemId.trim().length === 0),
    };
  }

  private mapVariant(node: ShopifyProductReadNode["variants"]["edges"][number]["node"]): ShopifyDraftPreparationVariantSnapshot {
    const inventoryLevels = node.inventoryItem?.inventoryLevels;

    return {
      id: node.id,
      title: node.title,
      price: this.toMoney(node.price),
      ...(this.hasText(node.compareAtPrice) ? { compareAtPrice: this.toMoney(node.compareAtPrice) } : {}),
      sku: node.sku ?? "",
      inventoryItemId: node.inventoryItem?.id ?? "",
      inventoryTracked: node.inventoryItem?.tracked ?? false,
      inventoryPolicy: node.inventoryPolicy,
      inventoryQuantities:
        inventoryLevels?.edges.map((edge) => ({
          locationId: edge.node.location.id,
          locationName: edge.node.location.name,
          quantity: edge.node.quantities.find((quantity) => quantity.name === "available")?.quantity ?? 0,
        })) ?? [],
      optionValues: Object.fromEntries(node.selectedOptions.map((option) => [option.name, option.value])),
    };
  }

  private isTruncated(connection: ShopifyProductReadConnection<unknown>): boolean {
    return connection.pageInfo.hasNextPage;
  }

  private toMoney(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  }

  private hasText(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value.trim().length > 0;
  }
}
