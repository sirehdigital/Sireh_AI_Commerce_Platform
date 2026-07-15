import type { ProductCurrency } from "../../../ai-product/types/product.types.js";

export interface ShopifyReadGraphqlClient {
  readonly graphql: <TData>(
    query: string,
    variables?: Readonly<Record<string, unknown>>,
  ) => Promise<TData>;
}

export interface ShopifyProductReadMoney {
  readonly amount: string;
  readonly currencyCode: ProductCurrency;
}

export interface ShopifyProductReadPageInfo {
  readonly hasNextPage: boolean;
}

export interface ShopifyProductReadEdge<TNode> {
  readonly node: TNode;
}

export interface ShopifyProductReadConnection<TNode> {
  readonly edges: readonly ShopifyProductReadEdge<TNode>[];
  readonly pageInfo: ShopifyProductReadPageInfo;
}

export interface ShopifyProductReadNode {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly status: string;
  readonly tags: readonly string[];
  readonly templateSuffix?: string | null;
  readonly onlineStoreUrl?: string | null;
  readonly seo?: {
    readonly title?: string | null;
    readonly description?: string | null;
  } | null;
  readonly collections: ShopifyProductReadConnection<{
    readonly id: string;
    readonly title: string;
  }>;
  readonly media: ShopifyProductReadConnection<{
    readonly id: string;
    readonly alt?: string | null;
    readonly image?: {
      readonly url: string;
    } | null;
  }>;
  readonly options: readonly {
    readonly name: string;
    readonly values: readonly string[];
  }[];
  readonly variants: ShopifyProductReadConnection<{
    readonly id: string;
    readonly title: string;
    readonly sku?: string | null;
    readonly price: string;
    readonly compareAtPrice?: string | null;
    readonly inventoryPolicy: string;
    readonly selectedOptions: readonly {
      readonly name: string;
      readonly value: string;
    }[];
    readonly inventoryItem?: {
      readonly id: string;
      readonly tracked: boolean;
      readonly inventoryLevels: ShopifyProductReadConnection<{
        readonly location: {
          readonly id: string;
          readonly name: string;
        };
        readonly quantities: readonly {
          readonly name: string;
          readonly quantity: number;
        }[];
      }>;
    } | null;
  }>;
}

export interface ShopifyProductByIdReadResponse {
  readonly shop: {
    readonly currencyCode: ProductCurrency;
  };
  readonly product?: ShopifyProductReadNode | null;
}

export interface ShopifyProductsByHandleReadResponse {
  readonly shop: {
    readonly currencyCode: ProductCurrency;
  };
  readonly products: ShopifyProductReadConnection<ShopifyProductReadNode>;
}
