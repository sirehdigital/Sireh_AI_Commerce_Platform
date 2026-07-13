import type { ShopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import { shopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import { isValidShopDomain, shopifyConfig } from "./shopify.config.js";
import { ShopifyClient } from "./shopify.client.js";
import type { ShopifyShopDomain } from "./shopify.types.js";
import type { ShopifyConnectionValidationResult } from "./shopify-sync.types.js";

interface ShopifyConnectionClient {
  getShop(): Promise<unknown>;
}

type ShopifyConnectionClientFactory = (shop: ShopifyShopDomain) => Promise<ShopifyConnectionClient>;

export class ShopifyConnectionValidationService {
  public constructor(
    private readonly sessionRepository: ShopifySessionRepository = shopifySessionRepository,
    private readonly clientFactory: ShopifyConnectionClientFactory = (shop) =>
      ShopifyClient.forShop(shop, this.sessionRepository),
  ) {}

  public async validate(shopDomain: ShopifyShopDomain): Promise<ShopifyConnectionValidationResult> {
    const normalizedShop = shopDomain.trim().toLowerCase() as ShopifyShopDomain;
    const validatedAt = new Date();

    if (!isValidShopDomain(normalizedShop) || shopifyConfig.apiVersion.trim().length === 0) {
      return this.disconnected(normalizedShop, validatedAt, this.requiredScopes());
    }

    const session = await this.sessionRepository.getSession(normalizedShop);
    const missingScopes = this.missingScopes(session?.scope ?? []);

    if (session === undefined) {
      return this.disconnected(normalizedShop, validatedAt, missingScopes);
    }

    try {
      const client = await this.clientFactory(normalizedShop);
      const shopResponse = await client.getShop();
      const responseShopDomain = this.extractShopDomain(shopResponse);
      const domainMatches = responseShopDomain === normalizedShop;

      return {
        shopDomain: normalizedShop,
        connected: domainMatches && missingScopes.length === 0,
        apiReachable: true,
        tokenValid: true,
        requiredScopesPresent: missingScopes.length === 0,
        missingScopes,
        validatedAt,
      };
    } catch {
      return {
        shopDomain: normalizedShop,
        connected: false,
        apiReachable: false,
        tokenValid: false,
        requiredScopesPresent: missingScopes.length === 0,
        missingScopes,
        validatedAt,
      };
    }
  }

  private disconnected(
    shopDomain: ShopifyShopDomain,
    validatedAt: Date,
    missingScopes: readonly string[],
  ): ShopifyConnectionValidationResult {
    return {
      shopDomain,
      connected: false,
      apiReachable: false,
      tokenValid: false,
      requiredScopesPresent: missingScopes.length === 0,
      missingScopes,
      validatedAt,
    };
  }

  private missingScopes(actualScopes: readonly string[]): readonly string[] {
    const actual = new Set(actualScopes.map((scope) => scope.trim()).filter(Boolean));

    return this.requiredScopes().filter((scope) => !actual.has(scope));
  }

  private requiredScopes(): readonly string[] {
    return shopifyConfig.scopes
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
  }

  private extractShopDomain(response: unknown): string | undefined {
    if (!this.isRecord(response)) {
      return undefined;
    }

    const shop = response.shop;
    if (!this.isRecord(shop)) {
      return undefined;
    }

    const myshopifyDomain = shop.myshopify_domain;
    const domain = shop.domain;

    if (typeof myshopifyDomain === "string") {
      return myshopifyDomain.trim().toLowerCase();
    }

    return typeof domain === "string" ? domain.trim().toLowerCase() : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}

export const shopifyConnectionValidationService = new ShopifyConnectionValidationService();
