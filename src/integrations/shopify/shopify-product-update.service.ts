import { AppError } from "../../shared/errors/app-error.js";
import { ShopifyClient } from "./shopify.client.js";
import type {
  SafeShopifyProductUpdateAudit,
  SafeShopifyProductUpdateCommand,
  ShopifyProductAuditChange,
  ShopifyProductPreservationAudit,
  ShopifyProductSnapshot,
} from "./shopify-product-update.types.js";
import type { ShopifyShopDomain } from "./shopify.types.js";

const PRODUCT_ID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const COLLECTION_ID_PATTERN = /^gid:\/\/shopify\/Collection\/\d+$/u;
const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TEMPLATE_SUFFIX_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u;
const MAX_TAGS = 250;

const PRODUCT_AUDIT_FRAGMENT = `
fragment ProductUpdateAuditFields on Product {
  id
  title
  handle
  descriptionHtml
  vendor
  productType
  tags
  status
  templateSuffix
  seo {
    title
    description
  }
  collections(first: 250) {
    nodes {
      id
      title
      handle
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
  variants(first: 250) {
    nodes {
      id
      title
      sku
      price
      compareAtPrice
      inventoryPolicy
      inventoryItem {
        id
        tracked
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const PRODUCT_BY_ID_QUERY = `${PRODUCT_AUDIT_FRAGMENT}
query ProductForSafeUpdateById($id: ID!) {
  product(id: $id) {
    ...ProductUpdateAuditFields
  }
}
`;

const PRODUCT_BY_HANDLE_QUERY = `${PRODUCT_AUDIT_FRAGMENT}
query ProductForSafeUpdateByHandle($query: String!) {
  products(first: 2, query: $query) {
    nodes {
      ...ProductUpdateAuditFields
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

// Inline fields avoid coupling this workflow to Shopify's ProductInput ->
// ProductUpdateInput type rename while retaining schema validation.
const UPDATE_PRODUCT_MUTATION = `
mutation UpdateProductMetadata(
  $id: ID!
  $title: String!
  $descriptionHtml: String!
  $vendor: String!
  $productType: String!
  $tags: [String!]!
  $seo: SEOInput!
  $templateSuffix: String!
  $collectionsToJoin: [ID!]!
) {
  productUpdate(
    product: {
      id: $id
      title: $title
      descriptionHtml: $descriptionHtml
      vendor: $vendor
      productType: $productType
      tags: $tags
      seo: $seo
      templateSuffix: $templateSuffix
      collectionsToJoin: $collectionsToJoin
      status: DRAFT
    }
  ) {
    product {
      id
    }
    userErrors {
      field
      message
    }
  }
}
`;

const UPDATE_VARIANT_PRICES_MUTATION = `
mutation UpdateExistingProductVariantPrices(
  $productId: ID!
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId
    variants: $variants
    allowPartialUpdates: false
  ) {
    product {
      id
    }
    productVariants {
      id
      sku
      price
      compareAtPrice
      inventoryPolicy
      inventoryItem {
        id
        tracked
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

interface ShopifyProductUpdateClient {
  graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData>;
}

type ShopifyProductUpdateClientFactory = (
  shopDomain: ShopifyShopDomain,
) => Promise<ShopifyProductUpdateClient>;

export interface ShopifyProductUpdateVerificationPolicy {
  readonly descriptionHtmlEquivalent: (expected: string, actual: string) => boolean;
}

const STRICT_PRODUCT_UPDATE_VERIFICATION: ShopifyProductUpdateVerificationPolicy = {
  descriptionHtmlEquivalent: (expected, actual) => expected === actual,
};

interface GraphqlPageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

interface GraphqlCollection {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
}

interface GraphqlVariant {
  readonly id: string;
  readonly title: string;
  readonly sku: string | null;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly inventoryPolicy: "DENY" | "CONTINUE";
  readonly inventoryItem: {
    readonly id: string;
    readonly tracked: boolean;
  };
}

interface GraphqlProduct {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly tags: readonly string[];
  readonly status: "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED";
  readonly templateSuffix: string | null;
  readonly seo: {
    readonly title: string | null;
    readonly description: string | null;
  };
  readonly collections: {
    readonly nodes: readonly GraphqlCollection[];
    readonly pageInfo: GraphqlPageInfo;
  };
  readonly variants: {
    readonly nodes: readonly GraphqlVariant[];
    readonly pageInfo: GraphqlPageInfo;
  };
}

interface ProductByIdResponse {
  readonly product: GraphqlProduct | null;
}

interface ProductsByHandleResponse {
  readonly products: {
    readonly nodes: readonly GraphqlProduct[];
    readonly pageInfo: GraphqlPageInfo;
  };
}

interface GraphqlUserError {
  readonly field: readonly string[] | null;
  readonly message: string;
}

interface ProductUpdateResponse {
  readonly productUpdate: {
    readonly product: { readonly id: string } | null;
    readonly userErrors: readonly GraphqlUserError[];
  };
}

interface VariantUpdateResponse {
  readonly productVariantsBulkUpdate: {
    readonly product: { readonly id: string } | null;
    readonly productVariants: readonly GraphqlVariant[] | null;
    readonly userErrors: readonly GraphqlUserError[];
  };
}

interface ProductMutationVariables extends Record<string, unknown> {
  readonly id: string;
  readonly title: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly tags: readonly string[];
  readonly seo: {
    readonly title: string;
    readonly description: string;
  };
  readonly templateSuffix: string;
  readonly collectionsToJoin: readonly string[];
}

interface VariantMutationInput {
  readonly id: string;
  readonly price: string;
  readonly compareAtPrice: string | null;
}

export class ShopifyProductUpdateService {
  public constructor(
    private readonly clientFactory: ShopifyProductUpdateClientFactory = (shopDomain) =>
      ShopifyClient.forShop(shopDomain),
    private readonly verificationPolicy: ShopifyProductUpdateVerificationPolicy =
      STRICT_PRODUCT_UPDATE_VERIFICATION,
  ) {}

  public async update(
    command: SafeShopifyProductUpdateCommand,
  ): Promise<SafeShopifyProductUpdateAudit> {
    const normalized = this.validateCommand(command);
    const client = await this.clientFactory(normalized.shopDomain);
    const before = await this.loadProduct(client, normalized);
    const mergedTags = this.mergeTags(before.tags, normalized.tagsToAdd);
    const collectionIdsToJoin = normalized.collectionIdsToJoin.filter(
      (collectionId) => !before.collections.some((collection) => collection.id === collectionId),
    );

    await this.updateProduct(client, before.id, normalized, mergedTags, collectionIdsToJoin);
    await this.updateVariantPrices(client, before, normalized);

    const after = await this.loadProductById(client, before.id);
    const preservation = this.buildPreservationAudit(before, after);
    this.assertPreserved(preservation, before.id);
    this.assertRequestedUpdate(after, normalized, mergedTags);

    return {
      shopDomain: normalized.shopDomain,
      productId: before.id,
      before,
      after,
      changes: this.buildChanges(before, after),
      preservation,
      status: "completed",
      completedAt: new Date(),
    };
  }

  private async loadProduct(
    client: ShopifyProductUpdateClient,
    command: SafeShopifyProductUpdateCommand,
  ): Promise<ShopifyProductSnapshot> {
    if (command.locator.kind === "id") {
      return this.loadProductById(client, command.locator.productId);
    }

    const handle = command.locator.handle;
    const response = await client.graphql<ProductsByHandleResponse>(PRODUCT_BY_HANDLE_QUERY, {
      query: `handle:${handle}`,
    });
    const exactMatches = response.products.nodes.filter((product) => product.handle === handle);

    if (exactMatches.length === 0) {
      throw AppError.notFound("Shopify product was not found by exact handle.", {
        handle,
      });
    }

    if (exactMatches.length !== 1) {
      throw AppError.conflict("Shopify product handle lookup was not unique.", {
        handle,
        productIds: exactMatches.map((product) => product.id),
      });
    }

    const product = exactMatches[0];
    if (product === undefined) {
      throw AppError.internal("Exact Shopify product handle lookup returned no product.");
    }

    return this.toSnapshot(product);
  }

  private async loadProductById(
    client: ShopifyProductUpdateClient,
    productId: string,
  ): Promise<ShopifyProductSnapshot> {
    const response = await client.graphql<ProductByIdResponse>(PRODUCT_BY_ID_QUERY, {
      id: productId,
    });

    if (response.product === null) {
      throw AppError.notFound("Shopify product was not found by exact ID.", { productId });
    }

    if (response.product.id !== productId) {
      throw AppError.conflict("Shopify returned a different product ID than requested.", {
        requestedProductId: productId,
        returnedProductId: response.product.id,
      });
    }

    return this.toSnapshot(response.product);
  }

  private async updateProduct(
    client: ShopifyProductUpdateClient,
    productId: string,
    command: SafeShopifyProductUpdateCommand,
    tags: readonly string[],
    collectionIdsToJoin: readonly string[],
  ): Promise<void> {
    const variables: ProductMutationVariables = {
      id: productId,
      title: command.title,
      descriptionHtml: command.descriptionHtml,
      vendor: command.vendor,
      productType: command.productType,
      tags,
      seo: command.seo,
      templateSuffix: command.templateSuffix,
      collectionsToJoin: collectionIdsToJoin,
    };
    const response = await client.graphql<ProductUpdateResponse>(
      UPDATE_PRODUCT_MUTATION,
      variables,
    );

    this.assertNoUserErrors("productUpdate", response.productUpdate.userErrors);

    if (response.productUpdate.product?.id !== productId) {
      throw AppError.conflict("Shopify product update did not confirm the requested product ID.", {
        productId,
        returnedProductId: response.productUpdate.product?.id,
      });
    }
  }

  private async updateVariantPrices(
    client: ShopifyProductUpdateClient,
    product: ShopifyProductSnapshot,
    command: SafeShopifyProductUpdateCommand,
  ): Promise<void> {
    const variants: readonly VariantMutationInput[] = product.variants.map((variant) => ({
      id: variant.id,
      price: command.pricing.price,
      compareAtPrice: command.pricing.compareAtPrice,
    }));
    const response = await client.graphql<VariantUpdateResponse>(UPDATE_VARIANT_PRICES_MUTATION, {
      productId: product.id,
      variants,
    });

    this.assertNoUserErrors(
      "productVariantsBulkUpdate",
      response.productVariantsBulkUpdate.userErrors,
    );

    if (response.productVariantsBulkUpdate.product?.id !== product.id) {
      throw AppError.conflict("Shopify variant update did not confirm the requested product ID.", {
        productId: product.id,
        returnedProductId: response.productVariantsBulkUpdate.product?.id,
      });
    }

    const updatedVariantIds = new Set(
      (response.productVariantsBulkUpdate.productVariants ?? []).map((variant) => variant.id),
    );
    const missingVariantIds = product.variants
      .map((variant) => variant.id)
      .filter((variantId) => !updatedVariantIds.has(variantId));

    if (missingVariantIds.length > 0) {
      throw AppError.conflict("Shopify did not confirm every requested variant price update.", {
        productId: product.id,
        missingVariantIds,
      });
    }
  }

  private toSnapshot(product: GraphqlProduct): ShopifyProductSnapshot {
    if (product.collections.pageInfo.hasNextPage || product.variants.pageInfo.hasNextPage) {
      throw AppError.conflict(
        "Safe product update requires the complete collection and variant set in one preflight read.",
        {
          productId: product.id,
          collectionsTruncated: product.collections.pageInfo.hasNextPage,
          variantsTruncated: product.variants.pageInfo.hasNextPage,
        },
        "SHOPIFY_PRODUCT_PREFLIGHT_TRUNCATED",
      );
    }

    if (product.variants.nodes.length === 0) {
      throw AppError.conflict("Shopify product has no variants to update safely.", {
        productId: product.id,
      });
    }

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      descriptionHtml: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      tags: [...product.tags],
      status: product.status,
      templateSuffix: product.templateSuffix,
      seo: {
        title: product.seo.title,
        description: product.seo.description,
      },
      collections: product.collections.nodes.map((collection) => ({ ...collection })),
      variants: product.variants.nodes.map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryPolicy: variant.inventoryPolicy,
        inventoryItemId: variant.inventoryItem.id,
        inventoryTracked: variant.inventoryItem.tracked,
      })),
    };
  }

  private validateCommand(
    command: SafeShopifyProductUpdateCommand,
  ): SafeShopifyProductUpdateCommand {
    if (command.locator.kind === "id") {
      this.assertPattern(command.locator.productId, PRODUCT_ID_PATTERN, "product ID");
    } else {
      this.assertPattern(command.locator.handle, HANDLE_PATTERN, "product handle");
    }

    this.assertNonEmpty(command.title, "title");
    this.assertNonEmpty(command.descriptionHtml, "HTML description");
    this.assertNonEmpty(command.vendor, "vendor");
    this.assertNonEmpty(command.productType, "product type");
    this.assertNonEmpty(command.seo.title, "SEO title");
    this.assertNonEmpty(command.seo.description, "SEO description");
    this.assertPattern(command.templateSuffix, TEMPLATE_SUFFIX_PATTERN, "template suffix");
    this.assertMoney(command.pricing.price, "price");

    if (command.pricing.compareAtPrice !== null) {
      this.assertMoney(command.pricing.compareAtPrice, "compare-at price");

      if (Number(command.pricing.compareAtPrice) <= Number(command.pricing.price)) {
        throw AppError.badRequest(
          "Compare-at price must be greater than price.",
          undefined,
          "INVALID_PRICE",
        );
      }
    }

    for (const collectionId of command.collectionIdsToJoin) {
      this.assertPattern(collectionId, COLLECTION_ID_PATTERN, "collection ID");
    }

    return {
      ...command,
      title: command.title.trim(),
      descriptionHtml: command.descriptionHtml.trim(),
      vendor: command.vendor.trim(),
      productType: command.productType.trim(),
      tagsToAdd: this.normalizeValues(command.tagsToAdd),
      seo: {
        title: command.seo.title.trim(),
        description: command.seo.description.trim(),
      },
      pricing: {
        price: this.normalizeMoney(command.pricing.price),
        compareAtPrice:
          command.pricing.compareAtPrice === null
            ? null
            : this.normalizeMoney(command.pricing.compareAtPrice),
      },
      collectionIdsToJoin: this.normalizeValues(command.collectionIdsToJoin),
      templateSuffix: command.templateSuffix.trim(),
    };
  }

  private mergeTags(existing: readonly string[], additions: readonly string[]): readonly string[] {
    const merged = this.normalizeValues([...existing, ...additions]);

    if (merged.length > MAX_TAGS) {
      throw AppError.badRequest(`Shopify product tags cannot exceed ${MAX_TAGS}.`, {
        tagCount: merged.length,
      });
    }

    return merged;
  }

  private buildPreservationAudit(
    before: ShopifyProductSnapshot,
    after: ShopifyProductSnapshot,
  ): ShopifyProductPreservationAudit {
    const beforeVariants = new Map(before.variants.map((variant) => [variant.id, variant]));
    const afterIds = after.variants.map((variant) => variant.id);
    const variantIdsPreserved = this.sameStringSet(
      before.variants.map((variant) => variant.id),
      afterIds,
    );

    return {
      handlePreserved: before.handle === after.handle,
      variantIdsPreserved,
      skusPreserved: after.variants.every(
        (variant) => beforeVariants.get(variant.id)?.sku === variant.sku,
      ),
      inventoryItemIdsPreserved: after.variants.every(
        (variant) => beforeVariants.get(variant.id)?.inventoryItemId === variant.inventoryItemId,
      ),
      inventoryTrackingPreserved: after.variants.every(
        (variant) => beforeVariants.get(variant.id)?.inventoryTracked === variant.inventoryTracked,
      ),
      inventoryPoliciesPreserved: after.variants.every(
        (variant) => beforeVariants.get(variant.id)?.inventoryPolicy === variant.inventoryPolicy,
      ),
      noVariantsCreated: variantIdsPreserved && after.variants.length === before.variants.length,
      publicationMutationExecuted: false,
    };
  }

  private assertPreserved(audit: ShopifyProductPreservationAudit, productId: string): void {
    const failedChecks = Object.entries(audit)
      .filter(([name, passed]) => name !== "publicationMutationExecuted" && passed === false)
      .map(([name]) => name);

    if (failedChecks.length > 0) {
      throw AppError.conflict(
        "Shopify product update violated protected AutoDS linkage invariants.",
        { productId, failedChecks },
        "SHOPIFY_PRODUCT_PRESERVATION_FAILED",
      );
    }
  }

  private assertRequestedUpdate(
    product: ShopifyProductSnapshot,
    command: SafeShopifyProductUpdateCommand,
    expectedTags: readonly string[],
  ): void {
    const mismatches: string[] = [];

    this.collectMismatch(mismatches, "title", product.title === command.title);
    this.collectMismatch(
      mismatches,
      "descriptionHtml",
      this.verificationPolicy.descriptionHtmlEquivalent(
        command.descriptionHtml,
        product.descriptionHtml,
      ),
    );
    this.collectMismatch(mismatches, "vendor", product.vendor === command.vendor);
    this.collectMismatch(mismatches, "productType", product.productType === command.productType);
    this.collectMismatch(mismatches, "tags", this.sameStringSet(product.tags, expectedTags));
    this.collectMismatch(mismatches, "seo.title", product.seo.title === command.seo.title);
    this.collectMismatch(
      mismatches,
      "seo.description",
      product.seo.description === command.seo.description,
    );
    this.collectMismatch(
      mismatches,
      "templateSuffix",
      product.templateSuffix === command.templateSuffix,
    );
    this.collectMismatch(mismatches, "status", product.status === "DRAFT");
    this.collectMismatch(
      mismatches,
      "collections",
      command.collectionIdsToJoin.every((collectionId) =>
        product.collections.some((collection) => collection.id === collectionId),
      ),
    );
    this.collectMismatch(
      mismatches,
      "variantPrices",
      product.variants.every(
        (variant) =>
          variant.price === command.pricing.price &&
          variant.compareAtPrice === command.pricing.compareAtPrice,
      ),
    );

    if (mismatches.length > 0) {
      throw AppError.conflict(
        "Shopify product read-back did not match the requested update.",
        { productId: product.id, mismatches },
        "SHOPIFY_PRODUCT_READBACK_FAILED",
      );
    }
  }

  private buildChanges(
    before: ShopifyProductSnapshot,
    after: ShopifyProductSnapshot,
  ): readonly ShopifyProductAuditChange[] {
    const changes: ShopifyProductAuditChange[] = [];
    const compare = (field: string, previous: unknown, current: unknown): void => {
      if (JSON.stringify(previous) !== JSON.stringify(current)) {
        changes.push({ field, before: previous, after: current });
      }
    };

    compare("title", before.title, after.title);
    compare("descriptionHtml", before.descriptionHtml, after.descriptionHtml);
    compare("vendor", before.vendor, after.vendor);
    compare("productType", before.productType, after.productType);
    compare("tags", before.tags, after.tags);
    compare("status", before.status, after.status);
    compare("templateSuffix", before.templateSuffix, after.templateSuffix);
    compare("seo", before.seo, after.seo);
    compare("collections", before.collections, after.collections);

    const beforeVariants = new Map(before.variants.map((variant) => [variant.id, variant]));
    for (const variant of after.variants) {
      const previous = beforeVariants.get(variant.id);
      compare(`variants.${variant.id}.price`, previous?.price, variant.price);
      compare(
        `variants.${variant.id}.compareAtPrice`,
        previous?.compareAtPrice,
        variant.compareAtPrice,
      );
    }

    return changes;
  }

  private assertNoUserErrors(stage: string, errors: readonly GraphqlUserError[]): void {
    if (errors.length === 0) {
      return;
    }

    throw AppError.badRequest(
      `Shopify ${stage} returned user errors.`,
      {
        stage,
        errors: errors.map((error) => ({
          field: error.field,
          message: error.message,
        })),
      },
      "SHOPIFY_PRODUCT_UPDATE_REJECTED",
    );
  }

  private assertNonEmpty(value: string, field: string): void {
    if (value.trim().length === 0) {
      throw AppError.badRequest(`Shopify product ${field} is required.`);
    }
  }

  private assertPattern(value: string, pattern: RegExp, field: string): void {
    if (!pattern.test(value.trim())) {
      throw AppError.badRequest(`Invalid Shopify ${field}.`, { field, value });
    }
  }

  private assertMoney(value: string, field: string): void {
    if (!MONEY_PATTERN.test(value.trim())) {
      throw AppError.badRequest(`Invalid Shopify ${field}.`, { field, value }, "INVALID_PRICE");
    }
  }

  private normalizeMoney(value: string): string {
    return Number(value).toFixed(2);
  }

  private normalizeValues(values: readonly string[]): readonly string[] {
    const unique = new Map<string, string>();

    for (const value of values) {
      const normalized = value.trim();
      if (normalized.length > 0 && !unique.has(normalized.toLowerCase())) {
        unique.set(normalized.toLowerCase(), normalized);
      }
    }

    return [...unique.values()];
  }

  private sameStringSet(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const normalizedRight = new Set(right.map((value) => value.toLowerCase()));
    return left.every((value) => normalizedRight.has(value.toLowerCase()));
  }

  private collectMismatch(mismatches: string[], field: string, matches: boolean): void {
    if (!matches) {
      mismatches.push(field);
    }
  }
}

export const shopifyProductUpdateService = new ShopifyProductUpdateService();
