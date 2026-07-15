import { describe, expect, it } from "vitest";
import { ShopifyProductUpdateService } from "./shopify-product-update.service.js";
import type { SafeShopifyProductUpdateCommand } from "./shopify-product-update.types.js";
import type { ShopifyShopDomain } from "./shopify.types.js";

const SHOP_DOMAIN = "sirehshope.myshopify.com" as ShopifyShopDomain;
const PRODUCT_ID = "gid://shopify/Product/8349712875567";
const VARIANT_ID = "gid://shopify/ProductVariant/45602785394735";
const INVENTORY_ITEM_ID = "gid://shopify/InventoryItem/987654321";
const COLLECTION_ID = "gid://shopify/Collection/123456789";

describe("ShopifyProductUpdateService", () => {
  it("updates only approved product fields and returns a preservation audit", async () => {
    const before = buildProduct();
    const after = buildProduct({
      title: "Lumora™ Revive Red Light Scalp Massager",
      descriptionHtml: "<p>Approved Lumora product description.</p>",
      vendor: "Lumora Beauty",
      productType: "Scalp Massager",
      tags: ["AutoDS", "Lumora", "Red Light Therapy"],
      status: "DRAFT",
      templateSuffix: "lumora-product",
      seo: {
        title: "Lumora Revive Red Light Scalp Massager",
        description: "Revitalize your scalp-care ritual with Lumora Revive.",
      },
      collections: {
        nodes: [
          {
            id: COLLECTION_ID,
            title: "Lumora Hair Care",
            handle: "lumora-hair-care",
          },
        ],
        pageInfo: completePageInfo(),
      },
      variants: {
        nodes: [
          {
            ...before.variants.nodes[0],
            price: "159.00",
            compareAtPrice: "199.00",
          },
        ],
        pageInfo: completePageInfo(),
      },
    });
    const client = new SequencedShopifyClient(before, after);
    const service = new ShopifyProductUpdateService(() => Promise.resolve(client));

    const audit = await service.update(buildCommand());

    expect(audit.before.status).toBe("ACTIVE");
    expect(audit.after.status).toBe("DRAFT");
    expect(audit.after.title).toBe("Lumora™ Revive Red Light Scalp Massager");
    expect(audit.preservation).toEqual({
      handlePreserved: true,
      variantIdsPreserved: true,
      skusPreserved: true,
      inventoryItemIdsPreserved: true,
      inventoryTrackingPreserved: true,
      inventoryPoliciesPreserved: true,
      noVariantsCreated: true,
      publicationMutationExecuted: false,
    });

    const productMutation = client.calls.find((call) =>
      call.query.includes("mutation UpdateProductMetadata"),
    );
    expect(productMutation?.query).toContain("status: DRAFT");
    expect(productMutation?.variables).not.toHaveProperty("handle");
    expect(productMutation?.variables).not.toHaveProperty("variants");
    expect(productMutation?.variables.tags).toEqual(["AutoDS", "Lumora", "Red Light Therapy"]);

    const variantMutation = client.calls.find((call) =>
      call.query.includes("mutation UpdateExistingProductVariantPrices"),
    );
    expect(variantMutation?.query).toContain("allowPartialUpdates: false");
    expect(variantMutation?.variables.variants).toEqual([
      { id: VARIANT_ID, price: "159.00", compareAtPrice: "199.00" },
    ]);
    expect(JSON.stringify(variantMutation?.variables)).not.toContain("inventoryItem");
    expect(JSON.stringify(variantMutation?.variables)).not.toContain("sku");
  });

  it("requires an exact product handle match before any mutation", async () => {
    const client = new HandleMismatchShopifyClient();
    const service = new ShopifyProductUpdateService(() => Promise.resolve(client));
    const command: SafeShopifyProductUpdateCommand = {
      ...buildCommand(),
      locator: { kind: "handle", handle: "lumora-revive-red-light-scalp-massager" },
    };

    await expect(service.update(command)).rejects.toThrow(
      "Shopify product was not found by exact handle",
    );
    expect(client.calls).toHaveLength(1);
  });

  it("stops before mutation when the protected preflight data is paginated", async () => {
    const product = buildProduct({
      variants: {
        nodes: buildProduct().variants.nodes,
        pageInfo: { hasNextPage: true, endCursor: "cursor" },
      },
    });
    const client = new ReadOnlyShopifyClient(product);
    const service = new ShopifyProductUpdateService(() => Promise.resolve(client));

    await expect(service.update(buildCommand())).rejects.toThrow(
      "Safe product update requires the complete collection and variant set",
    );
    expect(client.calls).toHaveLength(1);
  });
});

interface GraphqlCall {
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

type ProductFixture = ReturnType<typeof buildProduct>;

class SequencedShopifyClient {
  public readonly calls: GraphqlCall[] = [];
  private readCount = 0;

  public constructor(
    private readonly before: ProductFixture,
    private readonly after: ProductFixture,
  ) {}

  public graphql<TData>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ): Promise<TData> {
    this.calls.push({ query, variables });

    if (query.includes("query ProductForSafeUpdateById")) {
      const product = this.readCount === 0 ? this.before : this.after;
      this.readCount += 1;
      return Promise.resolve({ product } as unknown as TData);
    }

    if (query.includes("mutation UpdateProductMetadata")) {
      return Promise.resolve({
        productUpdate: { product: { id: PRODUCT_ID }, userErrors: [] },
      } as unknown as TData);
    }

    return Promise.resolve({
      productVariantsBulkUpdate: {
        product: { id: PRODUCT_ID },
        productVariants: this.after.variants.nodes,
        userErrors: [],
      },
    } as unknown as TData);
  }
}

class HandleMismatchShopifyClient {
  public readonly calls: GraphqlCall[] = [];

  public graphql<TData>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ): Promise<TData> {
    this.calls.push({ query, variables });
    return Promise.resolve({
      products: {
        nodes: [buildProduct({ handle: "another-product" })],
        pageInfo: completePageInfo(),
      },
    } as unknown as TData);
  }
}

class ReadOnlyShopifyClient {
  public readonly calls: GraphqlCall[] = [];

  public constructor(private readonly product: ProductFixture) {}

  public graphql<TData>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ): Promise<TData> {
    this.calls.push({ query, variables });
    return Promise.resolve({ product: this.product } as unknown as TData);
  }
}

function buildCommand(): SafeShopifyProductUpdateCommand {
  return {
    shopDomain: SHOP_DOMAIN,
    locator: { kind: "id", productId: PRODUCT_ID },
    title: "Lumora™ Revive Red Light Scalp Massager",
    descriptionHtml: "<p>Approved Lumora product description.</p>",
    vendor: "Lumora Beauty",
    productType: "Scalp Massager",
    tagsToAdd: ["Lumora", "Red Light Therapy"],
    seo: {
      title: "Lumora Revive Red Light Scalp Massager",
      description: "Revitalize your scalp-care ritual with Lumora Revive.",
    },
    pricing: { price: "159", compareAtPrice: "199" },
    collectionIdsToJoin: [COLLECTION_ID],
    templateSuffix: "lumora-product",
  };
}

function buildProduct(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: PRODUCT_ID,
    title: "Supplier Scalp Massager",
    handle: "lumora-revive-red-light-scalp-massager",
    descriptionHtml: "<p>Supplier description.</p>",
    vendor: "AutoDS Supplier",
    productType: "Massager",
    tags: ["AutoDS"],
    status: "ACTIVE" as const,
    templateSuffix: null,
    seo: { title: null, description: null },
    collections: { nodes: [], pageInfo: completePageInfo() },
    variants: {
      nodes: [
        {
          id: VARIANT_ID,
          title: "Default Title",
          sku: "AUTODS-RRLSM-001",
          price: "99.00",
          compareAtPrice: null,
          inventoryPolicy: "DENY" as const,
          inventoryItem: { id: INVENTORY_ITEM_ID, tracked: true },
        },
      ],
      pageInfo: completePageInfo(),
    },
    ...overrides,
  };
}

function completePageInfo() {
  return { hasNextPage: false, endCursor: null };
}
