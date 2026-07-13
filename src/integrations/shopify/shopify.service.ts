/**
 * Project: Sireh AI Commerce Platform (SACP)
 * Company: Sireh Digital Studio
 */

const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/**
 * Provides centralized business logic for interacting with Shopify.
 */
export class ShopifyService {
  validateShopDomain(shop: string): boolean {
    return SHOPIFY_DOMAIN_REGEX.test(shop.trim().toLowerCase());
  }
}

export const shopifyService = new ShopifyService();
