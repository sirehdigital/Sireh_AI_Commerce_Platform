import { describe, expect, it, vi, type Mock } from "vitest";
import { ShopifyProductReadAdapter } from "./shopify-product-read.adapter.js";
import {
  SHOPIFY_PRODUCT_BY_ID_READ_QUERY,
  SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY,
} from "./shopify-product-read.query.js";
import type {
  ShopifyProductByIdReadResponse,
  ShopifyProductsByHandleReadResponse,
  ShopifyReadGraphqlClient,
} from "./shopify-product-read.types.js";

describe("ShopifyProductReadAdapter", () => {
  it("reads one product by exact Shopify product ID", async () => {
    const client = createClient(createProductByIdResponse());
    const adapter = new ShopifyProductReadAdapter(client);

    const product = await adapter.readProductById(
      "mk9096-8w.myshopify.com",
      "gid://shopify/Product/8351602737199",
    );

    expect(client.graphqlMock).toHaveBeenCalledWith(SHOPIFY_PRODUCT_BY_ID_READ_QUERY, {
      id: "gid://shopify/Product/8351602737199",
    });
    expect(product?.id).toBe("gid://shopify/Product/8351602737199");
    expect(product?.variants[0]?.sku).toBe("AUTO-RED-001");
  });

  it("returns null when product ID lookup returns no product", async () => {
    const client = createClient({
      shop: { currencyCode: "MYR" },
      product: null,
    });

    await expect(
      new ShopifyProductReadAdapter(client).readProductById(
        "mk9096-8w.myshopify.com",
        "gid://shopify/Product/999",
      ),
    ).resolves.toBeNull();
  });

  it("reads products by exact handle and filters defensive non-matches", async () => {
    const matching = createProductNode();
    const nonMatching = { ...createProductNode(), id: "gid://shopify/Product/2", handle: "other-product" };
    const client = createClient<ShopifyProductsByHandleReadResponse>({
      shop: { currencyCode: "MYR" },
      products: {
        pageInfo: { hasNextPage: false },
        edges: [{ node: matching }, { node: nonMatching }],
      },
    });

    const products = await new ShopifyProductReadAdapter(client).readProductsByHandle(
      "mk9096-8w.myshopify.com",
      "lumora-revive-red-light-scalp-massager",
    );

    expect(client.graphqlMock).toHaveBeenCalledWith(SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY, {
      query: "handle:lumora-revive-red-light-scalp-massager",
    });
    expect(products).toHaveLength(1);
    expect(products[0]?.handle).toBe("lumora-revive-red-light-scalp-massager");
  });

  it("marks product and variant data as truncated from page info", async () => {
    const node = {
      ...createProductNode(),
      collections: {
        ...createProductNode().collections,
        pageInfo: { hasNextPage: true },
      },
      variants: {
        ...createProductNode().variants,
        pageInfo: { hasNextPage: true },
      },
    };
    const client = createClient<ShopifyProductByIdReadResponse>({
      shop: { currencyCode: "MYR" },
      product: node,
    });

    const product = await new ShopifyProductReadAdapter(client).readProductById(
      "mk9096-8w.myshopify.com",
      "gid://shopify/Product/8351602737199",
    );

    expect(product?.productDataTruncated).toBe(true);
    expect(product?.variantDataTruncated).toBe(true);
  });

  it("does not contain mutation operations", () => {
    const combined = `${SHOPIFY_PRODUCT_BY_ID_READ_QUERY}\n${SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY}`.toLowerCase();

    expect(combined).not.toContain("mutation");
    expect(combined).not.toContain("productupdate");
    expect(combined).not.toContain("inventoryadjust");
    expect(combined).not.toContain("publishablepublish");
  });
});

interface TestShopifyReadGraphqlClient extends ShopifyReadGraphqlClient {
  readonly graphqlMock: Mock<(query: string, variables?: Readonly<Record<string, unknown>>) => void>;
}

const createClient = <TResponse>(response: TResponse): TestShopifyReadGraphqlClient => {
  const graphqlMock: Mock<(query: string, variables?: Readonly<Record<string, unknown>>) => void> = vi.fn();

  return {
    graphql: <TData>(query: string, variables?: Readonly<Record<string, unknown>>) => {
      graphqlMock(query, variables);
      return Promise.resolve(response as unknown as TData);
    },
    graphqlMock,
  };
};

const createProductByIdResponse = (): ShopifyProductByIdReadResponse => ({
  shop: { currencyCode: "MYR" },
  product: createProductNode(),
});

const createProductNode = (): NonNullable<ShopifyProductByIdReadResponse["product"]> => ({
  id: "gid://shopify/Product/8351602737199",
  title: "Lumora Revive Red Light Scalp Massager",
  handle: "lumora-revive-red-light-scalp-massager",
  descriptionHtml: "<p>Rechargeable scalp-care device.</p>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  status: "DRAFT",
  tags: ["Lumora Beauty", "Hair Wellness"],
  templateSuffix: "velvetglow",
  onlineStoreUrl: "https://sirehshope.myshopify.com/products/lumora-revive-red-light-scalp-massager",
  seo: {
    title: "Lumora Revive | Hair Wellness",
    description: "A scalp-care device for daily routines.",
  },
  collections: {
    pageInfo: { hasNextPage: false },
    edges: [{ node: { id: "gid://shopify/Collection/1", title: "Hair Wellness" } }],
  },
  media: {
    pageInfo: { hasNextPage: false },
    edges: [
      {
        node: {
          id: "gid://shopify/MediaImage/1",
          alt: "Lumora scalp massager",
          image: { url: "https://cdn.example/lumora.jpg" },
        },
      },
    ],
  },
  options: [{ name: "Color", values: ["Red"] }],
  variants: {
    pageInfo: { hasNextPage: false },
    edges: [
      {
        node: {
          id: "gid://shopify/ProductVariant/1",
          title: "Red",
          sku: "AUTO-RED-001",
          price: "199.00",
          compareAtPrice: "299.00",
          inventoryPolicy: "DENY",
          selectedOptions: [{ name: "Color", value: "Red" }],
          inventoryItem: {
            id: "gid://shopify/InventoryItem/1",
            tracked: true,
            inventoryLevels: {
              pageInfo: { hasNextPage: false },
              edges: [
                {
                  node: {
                    location: { id: "gid://shopify/Location/1", name: "Shop" },
                    quantities: [{ name: "available", quantity: 10 }],
                  },
                },
              ],
            },
          },
        },
      },
    ],
  },
});
