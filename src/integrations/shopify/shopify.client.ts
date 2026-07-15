/**
 * Project: Sireh AI Commerce Platform
 * Module: Shopify API Client
 * Sprint: SACP-01.02
 * Author: Gemini Code Assist
 * Status: Production Ready
 */

import { AppError } from "../../shared/errors/app-error.js";
import {
  shopifySessionRepository,
  type ShopifySessionRepository,
} from "../../database/repositories/shopify-session.repository.js";
import { shopifyConfig } from "./shopify.config.js";
import type { ShopifyAccessToken, ShopifyApiVersion, ShopifyShopDomain } from "./shopify.types.js";

interface ShopifyClientOptions {
  shop: ShopifyShopDomain;
  accessToken: ShopifyAccessToken;
  apiVersion?: ShopifyApiVersion;
  requestTimeoutMs?: number;
  maxRetries?: number;
}

interface ShopifyGraphqlError {
  readonly message: string;
  readonly path?: readonly (string | number)[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}

interface ShopifyGraphqlResponse<TData> {
  readonly data?: TData;
  readonly errors?: readonly ShopifyGraphqlError[];
}

export class ShopifyClient {
  private readonly shop: ShopifyShopDomain;
  private readonly accessToken: ShopifyAccessToken;
  private readonly apiVersion: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  public constructor(options: ShopifyClientOptions);
  public constructor(
    shop: ShopifyShopDomain,
    accessToken: ShopifyAccessToken,
    apiVersion?: ShopifyApiVersion,
  );
  constructor(
    optionsOrShop: ShopifyClientOptions | ShopifyShopDomain,
    accessToken?: ShopifyAccessToken,
    apiVersion?: ShopifyApiVersion,
  ) {
    if (typeof optionsOrShop === "string") {
      if (accessToken === undefined) {
        throw AppError.unauthorized(
          `No active session found for shop: ${optionsOrShop}. Please install the app first.`,
        );
      }

      this.shop = optionsOrShop;
      this.accessToken = accessToken;
      this.apiVersion = apiVersion ?? shopifyConfig.apiVersion;
      this.requestTimeoutMs = 10_000;
      this.maxRetries = 2;
      return;
    }

    const options = optionsOrShop;

    if (options.accessToken === undefined) {
      throw AppError.unauthorized(
        `No active session found for shop: ${options.shop}. Please install the app first.`,
      );
    }

    this.shop = options.shop;
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion ?? shopifyConfig.apiVersion;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  public static async forShop(
    shop: ShopifyShopDomain,
    repository: ShopifySessionRepository = shopifySessionRepository,
  ): Promise<ShopifyClient> {
    const session = await repository.getSession(shop);

    if (session === undefined) {
      throw AppError.unauthorized(
        `No active session found for shop: ${shop}. Please install the app first.`,
      );
    }

    return new ShopifyClient({
      shop: session.shop,
      accessToken: session.accessToken,
      apiVersion: session.apiVersion,
    });
  }

  public async get<T>(path: string): Promise<T> {
    const response = await this.request(path);

    return response.json() as Promise<T>;
  }

  public async graphql<TData>(
    query: string,
    variables: Readonly<Record<string, unknown>> = {},
  ): Promise<TData> {
    const response = await this.request("graphql.json", {
      method: "POST",
      body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as ShopifyGraphqlResponse<TData>;

    if (payload.errors !== undefined && payload.errors.length > 0) {
      throw AppError.badRequest(
        "Shopify Admin GraphQL operation failed.",
        {
          errors: payload.errors.map((error) => ({
            message: error.message,
            ...(error.path === undefined ? {} : { path: error.path }),
            ...(error.extensions === undefined ? {} : { extensions: error.extensions }),
          })),
        },
        "SHOPIFY_GRAPHQL_ERROR",
      );
    }

    if (payload.data === undefined) {
      throw AppError.internal(
        "Shopify Admin GraphQL response did not include data.",
        undefined,
        "SHOPIFY_GRAPHQL_EMPTY_RESPONSE",
      );
    }

    return payload.data;
  }

  public async getPaginated<T>(path: string, responseKey: string, pageLimit = 100): Promise<T[]> {
    const results: T[] = [];
    let nextPath: string | undefined = this.withLimit(path, pageLimit);
    let pagesRead = 0;
    const maxPages = 10;

    while (nextPath !== undefined && pagesRead < maxPages) {
      const response = await this.request(nextPath);
      const payload = (await response.json()) as Record<string, unknown>;
      const pageItems = payload[responseKey];

      if (Array.isArray(pageItems)) {
        results.push(...(pageItems as T[]));
      }

      nextPath = this.extractNextPath(response.headers.get("link"));
      pagesRead += 1;
    }

    return results;
  }

  private async request(
    path: string,
    init?: Pick<RequestInit, "method" | "body">,
  ): Promise<Response> {
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const response = await this.fetchOnce(path, init);

      if (response.ok) {
        return response;
      }

      if (!this.shouldRetry(response.status) || attempt === this.maxRetries) {
        throw this.toShopifyError(response);
      }

      await this.delay(this.retryDelayMs(response));
      attempt += 1;
    }

    throw AppError.internal("Shopify Admin API request failed.");
  }

  private async fetchOnce(
    path: string,
    init?: Pick<RequestInit, "method" | "body">,
  ): Promise<Response> {
    const url = this.toAdminUrl(path);

    const requestInit: RequestInit = {
      method: init?.method ?? "GET",
      signal: AbortSignal.timeout(this.requestTimeoutMs),
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    };

    if (init?.body !== undefined) {
      requestInit.body = init.body;
    }

    return fetch(url, requestInit);
  }

  private toAdminUrl(path: string): string {
    if (path.startsWith("https://")) {
      return path;
    }

    return `https://${this.shop}/admin/api/${this.apiVersion}/${path}`;
  }

  private withLimit(path: string, pageLimit: number): string {
    const separator = path.includes("?") ? "&" : "?";

    return path.includes("limit=") ? path : `${path}${separator}limit=${pageLimit}`;
  }

  private extractNextPath(linkHeader: string | null): string | undefined {
    if (linkHeader === null) {
      return undefined;
    }

    const nextLink = linkHeader
      .split(",")
      .map((link) => link.trim())
      .find((link) => link.includes('rel="next"'));

    if (nextLink === undefined) {
      return undefined;
    }

    const match = /^<([^>]+)>/.exec(nextLink);
    if (match?.[1] === undefined) {
      return undefined;
    }

    return match[1];
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private retryDelayMs(response: Response): number {
    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter === null ? 0 : Number.parseInt(retryAfter, 10);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, 1000);
    }

    return 100;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  private toShopifyError(response: Response): AppError {
    const details = {
      status: response.status,
      statusText: response.statusText,
    };

    if (response.status === 401) {
      return AppError.unauthorized("Shopify Admin API token is invalid.", details);
    }

    if (response.status === 403) {
      return AppError.forbidden("Shopify Admin API access is forbidden.", details);
    }

    if (response.status === 404) {
      return AppError.notFound("Shopify Admin API resource was not found.", details);
    }

    if (response.status === 429) {
      return AppError.internal("Shopify Admin API rate limit was exceeded.", details);
    }

    return AppError.internal("Shopify Admin API request failed.", details);
  }

  public async getShop(): Promise<unknown> {
    return this.get("shop.json");
  }

  public async getProducts(): Promise<unknown> {
    return this.get("products.json");
  }

  public async getAllProducts(): Promise<unknown[]> {
    return this.getPaginated("products.json", "products");
  }

  public async getCustomCollections(): Promise<unknown[]> {
    return this.getPaginated("custom_collections.json", "custom_collections");
  }

  public async getSmartCollections(): Promise<unknown[]> {
    return this.getPaginated("smart_collections.json", "smart_collections");
  }

  public async getInventoryLevels(): Promise<unknown[]> {
    return this.getPaginated("inventory_levels.json", "inventory_levels");
  }

  public async getLocations(): Promise<unknown[]> {
    return this.getPaginated("locations.json", "locations");
  }

  public async getOrders(): Promise<unknown> {
    return this.get("orders.json");
  }

  public async getAllOrders(): Promise<unknown[]> {
    return this.getPaginated("orders.json?status=any", "orders");
  }

  public async getCustomers(): Promise<unknown> {
    return this.get("customers.json");
  }

  public async getAllCustomers(): Promise<unknown[]> {
    return this.getPaginated("customers.json", "customers");
  }
}
