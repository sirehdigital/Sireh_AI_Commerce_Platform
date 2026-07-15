import type { ShopifyDraftPreparationReadRepository } from "../../workflows/shopify-draft-preparation/index.js";
import {
  SHOPIFY_PRODUCT_BY_ID_READ_QUERY,
  SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY,
} from "./shopify-product-read.query.js";
import { ShopifyProductReadMapper } from "./shopify-product-read.mapper.js";
import type {
  ShopifyProductByIdReadResponse,
  ShopifyProductsByHandleReadResponse,
  ShopifyReadGraphqlClient,
} from "./shopify-product-read.types.js";

export class ShopifyProductReadAdapter implements ShopifyDraftPreparationReadRepository {
  private readonly mapper = new ShopifyProductReadMapper();

  public constructor(private readonly client: ShopifyReadGraphqlClient) {}

  public async readProductById(shopDomain: string, productId: string) {
    void shopDomain;
    const response = await this.client.graphql<ShopifyProductByIdReadResponse>(
      SHOPIFY_PRODUCT_BY_ID_READ_QUERY,
      { id: productId },
    );

    return this.mapper.mapProductByIdResponse(response);
  }

  public async readProductsByHandle(shopDomain: string, handle: string) {
    void shopDomain;
    const response = await this.client.graphql<ShopifyProductsByHandleReadResponse>(
      SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY,
      { query: `handle:${handle}` },
    );

    return this.mapper.mapProductsByHandleResponse(response).filter((product) => product.handle === handle);
  }
}
