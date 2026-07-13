import crypto from "node:crypto";
import { prisma } from "../../database/prisma/prisma.client.js";
import { AppError } from "../../shared/errors/app-error.js";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStateRecord {
  readonly shop: string;
  readonly expiresAt: number;
}

export interface ShopifyOAuthStateRecord {
  readonly stateHash: string;
  readonly shopDomain: string;
  readonly expiresAt: Date;
}

export interface ShopifyOAuthStateDelegate {
  upsert(args: {
    readonly where: { readonly stateHash: string };
    readonly create: ShopifyOAuthStateRecord;
    readonly update: ShopifyOAuthStateRecord;
  }): Promise<ShopifyOAuthStateRecord>;
  findUnique(args: {
    readonly where: { readonly stateHash: string };
  }): Promise<ShopifyOAuthStateRecord | null>;
  deleteMany(args: {
    readonly where: { readonly stateHash?: string; readonly expiresAt?: { readonly lt: Date } };
  }): Promise<{ readonly count: number }>;
  count(): Promise<number>;
}

export interface ShopifyOAuthStatePrismaClient {
  readonly shopifyOAuthState: ShopifyOAuthStateDelegate;
}

export interface ShopifyOAuthStateRepository {
  saveOAuthState(state: string, shopDomain: string): Promise<void>;
  getOAuthState(state: string): Promise<OAuthStateRecord | undefined>;
  deleteOAuthState(state: string): Promise<void>;
  consumeOAuthState(state: string, shopDomain: string): Promise<OAuthStateRecord>;
  getOAuthStateCount(): Promise<number>;
  hashState(state: string): string;
}

export class PrismaShopifyOAuthStateRepository implements ShopifyOAuthStateRepository {
  public constructor(private readonly client: ShopifyOAuthStatePrismaClient) {}

  public async saveOAuthState(state: string, shopDomain: string): Promise<void> {
    const stateHash = this.hashState(state);
    const normalizedShop = this.normalizeShop(shopDomain);
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.client.shopifyOAuthState.upsert({
      where: { stateHash },
      create: {
        stateHash,
        shopDomain: normalizedShop,
        expiresAt,
      },
      update: {
        stateHash,
        shopDomain: normalizedShop,
        expiresAt,
      },
    });
  }

  public async getOAuthState(state: string): Promise<OAuthStateRecord | undefined> {
    const storedState = await this.client.shopifyOAuthState.findUnique({
      where: { stateHash: this.hashState(state) },
    });

    return storedState === null ? undefined : this.toOAuthStateRecord(storedState);
  }

  public async deleteOAuthState(state: string): Promise<void> {
    await this.client.shopifyOAuthState.deleteMany({
      where: { stateHash: this.hashState(state) },
    });
  }

  public async consumeOAuthState(state: string, shopDomain: string): Promise<OAuthStateRecord> {
    const stateHash = this.hashState(state);
    const normalizedShop = this.normalizeShop(shopDomain);
    const storedState = await this.client.shopifyOAuthState.findUnique({
      where: { stateHash },
    });

    if (storedState === null) {
      throw AppError.forbidden("Invalid state. OAuth request cannot be verified.");
    }

    if (storedState.expiresAt.getTime() < Date.now()) {
      await this.client.shopifyOAuthState.deleteMany({
        where: { stateHash },
      });
      throw AppError.forbidden("Invalid state. OAuth request cannot be verified.");
    }

    if (storedState.shopDomain !== normalizedShop) {
      throw AppError.forbidden("Invalid state. OAuth request cannot be verified.");
    }

    return this.toOAuthStateRecord(storedState);
  }

  public async getOAuthStateCount(): Promise<number> {
    return this.client.shopifyOAuthState.count();
  }

  public hashState(state: string): string {
    return crypto.createHash("sha256").update(state).digest("hex");
  }

  private normalizeShop(shopDomain: string): string {
    return shopDomain.trim().toLowerCase();
  }

  private toOAuthStateRecord(record: ShopifyOAuthStateRecord): OAuthStateRecord {
    return {
      shop: record.shopDomain,
      expiresAt: record.expiresAt.getTime(),
    };
  }
}

const prismaClient = prisma as unknown as ShopifyOAuthStatePrismaClient;
const prismaOAuthStateRepository = new PrismaShopifyOAuthStateRepository(prismaClient);
let activeOAuthStateRepository: ShopifyOAuthStateRepository = prismaOAuthStateRepository;

export function saveOAuthState(state: string, shopDomain: string): Promise<void> {
  return activeOAuthStateRepository.saveOAuthState(state, shopDomain);
}

export function getOAuthState(state: string): Promise<OAuthStateRecord | undefined> {
  return activeOAuthStateRepository.getOAuthState(state);
}

export function deleteOAuthState(state: string): Promise<void> {
  return activeOAuthStateRepository.deleteOAuthState(state);
}

export function consumeOAuthState(state: string, shopDomain: string): Promise<OAuthStateRecord> {
  return activeOAuthStateRepository.consumeOAuthState(state, shopDomain);
}

export function getOAuthStateCount(): Promise<number> {
  return activeOAuthStateRepository.getOAuthStateCount();
}

export function hashOAuthState(state: string): string {
  return activeOAuthStateRepository.hashState(state);
}

export function setOAuthStateRepositoryForTesting(
  repository: ShopifyOAuthStateRepository,
): void {
  activeOAuthStateRepository = repository;
}

export function resetOAuthStateRepositoryForTesting(): void {
  activeOAuthStateRepository = prismaOAuthStateRepository;
}
