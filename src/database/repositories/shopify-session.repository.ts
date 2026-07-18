import { prisma } from "../prisma/prisma.client.js";
import { AppError } from "../../shared/errors/app-error.js";
import { isValidShopDomain } from "../../integrations/shopify/shopify.config.js";
import type {
  ShopifyApiVersion,
  ShopifySession,
  ShopifyShopDomain,
} from "../../integrations/shopify/shopify.types.js";

export interface ShopifySessionRecord {
  readonly id?: string;
  readonly shopDomain: string;
  readonly accessToken: string;
  readonly scopes: string;
  readonly apiVersion: string;
  readonly tenantId?: string | null;
  readonly installedAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt?: Date | null;
  readonly revokedAt?: Date | null;
}

export interface ShopifySessionWhereUniqueInput {
  readonly shopDomain: string;
}

export interface ShopifySessionUpsertArgs {
  readonly where: ShopifySessionWhereUniqueInput;
  readonly create: ShopifySessionRecord;
  readonly update: Omit<ShopifySessionRecord, "shopDomain" | "installedAt">;
}

export interface ShopifySessionFindUniqueArgs {
  readonly where: ShopifySessionWhereUniqueInput;
}

export interface ShopifySessionDeleteManyArgs {
  readonly where: ShopifySessionWhereUniqueInput;
}

export interface ShopifySessionDeleteManyResult {
  readonly count: number;
}

export interface ShopifySessionDelegate {
  upsert(args: ShopifySessionUpsertArgs): Promise<ShopifySessionRecord>;
  findUnique(args: ShopifySessionFindUniqueArgs): Promise<ShopifySessionRecord | null>;
  deleteMany(args: ShopifySessionDeleteManyArgs): Promise<ShopifySessionDeleteManyResult>;
}

export interface ShopifySessionPrismaClient {
  readonly shopifySession: ShopifySessionDelegate;
}

export interface ShopifySessionRepository {
  saveSession(session: ShopifySession): Promise<ShopifySession>;
  getSession(shopDomain: string): Promise<ShopifySession | undefined>;
  deleteSession(shopDomain: string): Promise<void>;
  hasSession(shopDomain: string): Promise<boolean>;
}

export class PrismaShopifySessionRepository implements ShopifySessionRepository {
  public constructor(private readonly client: ShopifySessionPrismaClient) {}

  public async saveSession(session: ShopifySession): Promise<ShopifySession> {
    const normalizedShop = this.normalizeShopDomain(session.shop);
    const preparedSession = this.copySession({
      ...session,
      shop: normalizedShop,
      scope: this.normalizeScopes(session.scope),
      updatedAt: new Date(session.updatedAt),
    });

    const saved = await this.client.shopifySession.upsert({
      where: { shopDomain: normalizedShop },
      create: this.toRecord(preparedSession),
      update: {
        accessToken: preparedSession.accessToken,
        scopes: this.serializeScopes(preparedSession.scope),
        apiVersion: preparedSession.apiVersion,
        updatedAt: preparedSession.updatedAt,
      },
    });

    return this.toSession(saved);
  }

  public async getSession(shopDomain: string): Promise<ShopifySession | undefined> {
    const normalizedShop = this.normalizeShopDomain(shopDomain);
    const stored = await this.client.shopifySession.findUnique({
      where: { shopDomain: normalizedShop },
    });

    return stored === null ? undefined : this.toSession(stored);
  }

  public async deleteSession(shopDomain: string): Promise<void> {
    const normalizedShop = this.normalizeShopDomain(shopDomain);

    await this.client.shopifySession.deleteMany({
      where: { shopDomain: normalizedShop },
    });
  }

  public async hasSession(shopDomain: string): Promise<boolean> {
    return (await this.getSession(shopDomain)) !== undefined;
  }

  private toRecord(session: ShopifySession): ShopifySessionRecord {
    return {
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scopes: this.serializeScopes(session.scope),
      apiVersion: session.apiVersion,
      installedAt: session.installedAt,
      updatedAt: session.updatedAt,
    };
  }

  private toSession(record: ShopifySessionRecord): ShopifySession {
    const normalizedShop = this.normalizeShopDomain(record.shopDomain);
    const expiresAt = record.expiresAt ?? undefined;
    const revokedAt = record.revokedAt ?? undefined;

    if (record.accessToken.trim().length === 0) {
      throw AppError.internal("Stored Shopify session is invalid.");
    }

    if (record.apiVersion.trim().length === 0) {
      throw AppError.internal("Stored Shopify session is invalid.");
    }

    if (revokedAt !== undefined) {
      throw AppError.unauthorized("Shopify session has been revoked.");
    }

    if (expiresAt !== undefined && expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized("Shopify session has expired.");
    }

    return this.copySession({
      ...(record.id === undefined ? {} : { id: record.id }),
      shop: normalizedShop,
      accessToken: record.accessToken,
      scope: this.deserializeScopes(record.scopes),
      apiVersion: record.apiVersion as ShopifyApiVersion,
      ...(record.tenantId === null || record.tenantId === undefined
        ? {}
        : { tenantId: record.tenantId }),
      installedAt: new Date(record.installedAt),
      updatedAt: new Date(record.updatedAt),
      ...(expiresAt === undefined ? {} : { expiresAt: new Date(expiresAt) }),
      ...(revokedAt === undefined ? {} : { revokedAt: new Date(revokedAt) }),
    });
  }

  private serializeScopes(scopes: readonly string[]): string {
    return this.normalizeScopes(scopes).join(",");
  }

  private deserializeScopes(scopes: string): readonly string[] {
    if (scopes.trim().length === 0) {
      return [];
    }

    return this.normalizeScopes(scopes.split(","));
  }

  private normalizeShopDomain(shopDomain: string): ShopifyShopDomain {
    const normalizedShop = shopDomain.trim().toLowerCase();

    if (!isValidShopDomain(normalizedShop)) {
      throw AppError.badRequest("Invalid shop domain provided.");
    }

    return normalizedShop as ShopifyShopDomain;
  }

  private normalizeScopes(scopes: readonly string[]): readonly string[] {
    return [...new Set(scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0))].sort();
  }

  private copySession(session: ShopifySession): ShopifySession {
    return {
      ...(session.id === undefined ? {} : { id: session.id }),
      shop: session.shop,
      accessToken: session.accessToken,
      scope: [...session.scope],
      apiVersion: session.apiVersion,
      ...(session.tenantId === undefined ? {} : { tenantId: session.tenantId }),
      installedAt: new Date(session.installedAt),
      updatedAt: new Date(session.updatedAt),
      ...(session.expiresAt === undefined ? {} : { expiresAt: new Date(session.expiresAt) }),
      ...(session.revokedAt === undefined ? {} : { revokedAt: new Date(session.revokedAt) }),
    };
  }
}

export const shopifySessionRepository = new PrismaShopifySessionRepository(prisma);
