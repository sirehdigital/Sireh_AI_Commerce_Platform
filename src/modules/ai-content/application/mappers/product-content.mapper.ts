import type {
  ProductContentPackage,
  ProductContentPackageSnapshot,
} from "../dto/product-content.types.js";

export class ProductContentMapper {
  public toSnapshot(productContentPackage: ProductContentPackage): ProductContentPackageSnapshot {
    return {
      productId: productContentPackage.productId,
      channel: productContentPackage.channel,
      language: productContentPackage.language,
      tone: productContentPackage.tone,
      contents: productContentPackage.contents.map((content) => content.snapshot()),
      faq: [...productContentPackage.faq],
      shopifyReady: {
        ...productContentPackage.shopifyReady,
        benefits: [...productContentPackage.shopifyReady.benefits],
        features: [...productContentPackage.shopifyReady.features],
        highlights: [...productContentPackage.shopifyReady.highlights],
        callsToAction: [...productContentPackage.shopifyReady.callsToAction],
      },
      generatedAt: new Date(productContentPackage.generatedAt),
    };
  }
}
