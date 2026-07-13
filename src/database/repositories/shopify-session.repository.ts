import { prisma } from "../prisma/prisma.client.js";
import type {
  ShopifyApiVersion,
  ShopifySession,
  ShopifyShopDomain,
} from "../../integrations/shopify/shopify.types.js";

export interface ShopifySessionRecord {
  readonly shopDomain: string;
  readonly accessToken: string;
  readonly scopes: string;
  readonly apiVersion: string;
  readonly installedAt: Date;
  readonly updatedAt: Date;
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
  getSession(shopDomain: ShopifyShopDomain): Promise<ShopifySession | undefined>;
  deleteSession(shopDomain: ShopifyShopDomain): Promise<void>;
  hasSession(shopDomain: ShopifyShopDomain): Promise<boolean>;
}

export class PrismaShopifySessionRepository implements ShopifySessionRepository {
  public constructor(private readonly client: ShopifySessionPrismaClient) {}

  public async saveSession(session: ShopifySession): Promise<ShopifySession> {
    const saved = await this.client.shopifySession.upsert({
      where: { shopDomain: session.shop },
      create: this.toRecord(session),
      update: {
        accessToken: session.accessToken,
        scopes: this.serializeScopes(session.scope),
        apiVersion: session.apiVersion,
        updatedAt: session.updatedAt,
      },
    });

    return this.toSession(saved);
  }

  public async getSession(shopDomain: ShopifyShopDomain): Promise<ShopifySession | undefined> {
    const stored = await this.client.shopifySession.findUnique({
      where: { shopDomain },
    });

    return stored === null ? undefined : this.toSession(stored);
  }

  public async deleteSession(shopDomain: ShopifyShopDomain): Promise<void> {
    await this.client.shopifySession.deleteMany({
      where: { shopDomain },
    });
  }

  public async hasSession(shopDomain: ShopifyShopDomain): Promise<boolean> {
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
    return {
      shop: record.shopDomain as ShopifyShopDomain,
      accessToken: record.accessToken,
      scope: this.deserializeScopes(record.scopes),
      apiVersion: record.apiVersion as ShopifyApiVersion,
      installedAt: record.installedAt,
      updatedAt: record.updatedAt,
    };
  }

  private serializeScopes(scopes: readonly string[]): string {
    return scopes.join(",");
  }

  private deserializeScopes(scopes: string): readonly string[] {
    if (scopes.trim().length === 0) {
      return [];
    }

    return scopes.split(",").map((scope) => scope.trim()).filter((scope) => scope.length > 0);
  }
}

export const shopifySessionRepository = new PrismaShopifySessionRepository(prisma);
