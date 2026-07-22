import { describe, expect, it, vi } from "vitest";

import type { CreateProductDraftDto } from "../dto/create-product-draft.dto.js";
import type { ProductDraft } from "../../domain/models/product-draft.model.js";
import {
  ProductDraftValidationError,
  type ProductDraftClock,
  type ProductDraftFactoryDependencies,
  type ProductDraftIdGenerator,
} from "../../domain/factories/product-draft.factory.js";
import {
  ProductDraftRepositoryError,
  type ProductDraftRepository,
  type ProductDraftRepositoryListQuery,
  type ProductDraftRepositoryListResult,
  type ProductDraftRepositorySaveOptions,
  type ProductDraftRepositorySaveResult,
} from "../../domain/repositories/product-draft.repository.js";
import {
  CreateProductDraftApplicationError,
  CreateProductDraftService,
  type CreateProductDraftFactoryPort,
} from "./create-product-draft.service.js";

const NOW = "2026-07-18T08:30:00.000Z";
const REQUESTED_AT = "2026-07-18T08:00:00.000Z";

class FakeProductDraftRepository implements ProductDraftRepository {
  public readonly savedDrafts: ProductDraft[] = [];
  public readonly saveOptions: ProductDraftRepositorySaveOptions[] = [];
  public readonly idempotencyLookups: string[] = [];
  public readonly sourceLookups: string[] = [];
  public draftByIdempotencyKey: ProductDraft | null = null;
  public draftBySourceReference: ProductDraft | null = null;
  public saveDraftOverride: ProductDraft | undefined;
  public saveError: ProductDraftRepositoryError | undefined;

  public save(draft: ProductDraft, options: ProductDraftRepositorySaveOptions = {}): Promise<ProductDraftRepositorySaveResult> {
    if (this.saveError !== undefined) {
      throw this.saveError;
    }

    this.savedDrafts.push(draft);
    this.saveOptions.push(options);

    return Promise.resolve({
      draft: this.saveDraftOverride ?? draft,
      created: true,
      updated: false,
    });
  }

  public findById(): Promise<ProductDraft | null> {
    return Promise.resolve(null);
  }

  public findByIdempotencyKey(idempotencyKey: string): Promise<ProductDraft | null> {
    this.idempotencyLookups.push(idempotencyKey);

    return Promise.resolve(this.draftByIdempotencyKey);
  }

  public findBySourceReference(sourceType: ProductDraft["source"]["sourceType"], sourceId: string): Promise<ProductDraft | null> {
    this.sourceLookups.push(`${sourceType}:${sourceId}`);

    return Promise.resolve(this.draftBySourceReference);
  }

  public existsById(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public list(query: ProductDraftRepositoryListQuery = {}): Promise<ProductDraftRepositoryListResult> {
    return Promise.resolve({
      items: [],
      total: 0,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      hasNextPage: false,
    });
  }
}

const buildDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  id: "draft-001",
  status: "draft",
  version: 1,
  source: {
    sourceType: "manual",
    sourceId: "manual-source-001",
    supplierId: "supplier-001",
    supplierProductId: "supplier-product-001",
    importedAt: REQUESTED_AT,
  },
  title: "Test Product",
  description: "Test description",
  vendor: "Test Vendor",
  productType: "Test Type",
  tags: ["Beauty", "Device"],
  targetMarkets: ["US", "MY"],
  images: [
    {
      sourceUrl: "https://images.test/product.jpg",
      position: 1,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "draft-001:variant:1",
      title: "Default",
      sku: "SKU-001",
      options: [
        {
          name: "Color",
          value: "Black",
        },
      ],
      supplierPrice: {
        amount: 12.5,
        currency: "USD",
      },
      sellingPrice: {
        amount: 29.99,
        currency: "USD",
      },
      inventoryQuantity: 5,
      available: true,
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const createValidInput = (overrides: Partial<CreateProductDraftDto> = {}): CreateProductDraftDto => ({
  sourceType: "manual",
  sourceReference: {
    sourceId: "manual-source-001",
    sourceName: "Manual Entry",
    importedAt: REQUESTED_AT,
  },
  supplier: {
    supplierId: "supplier-001",
    supplierName: "Supplier One",
    supplierProductId: "supplier-product-001",
    marketplace: "supplier-marketplace",
  },
  externalCorrelationId: "external-correlation-001",
  title: "Test Product",
  description: "Test description",
  vendor: "Test Vendor",
  productType: "Test Type",
  tags: ["Beauty", "Device"],
  targetMarkets: ["US", "MY"],
  images: [
    {
      url: "https://images.test/product.jpg",
      position: 1,
    },
  ],
  variants: [
    {
      title: "Default",
      sku: "SKU-001",
      price: {
        amount: 29.99,
        currency: "USD",
      },
      cost: {
        amount: 12.5,
        currency: "USD",
      },
      inventoryQuantity: 5,
      optionValues: [
        {
          name: "Color",
          value: "Black",
        },
      ],
    },
  ],
  request: {
    requestedBy: "operator-001",
    requestedAt: REQUESTED_AT,
    correlationId: "correlation-001",
    idempotencyKey: "idempotency-001",
  },
  ...overrides,
});

const createFactory = (draft: ProductDraft = buildDraft()): CreateProductDraftFactoryPort => ({
  create: vi.fn(() => draft),
});

const createService = (
  repository: FakeProductDraftRepository,
  factory: CreateProductDraftFactoryPort = createFactory(),
  idGenerator: ProductDraftIdGenerator = vi.fn(() => "generated-draft-id"),
  clock: ProductDraftClock = vi.fn(() => NOW),
) =>
  new CreateProductDraftService({
    repository,
    idGenerator,
    clock,
    factory,
  });

const expectApplicationErrorCode = async (
  operation: () => Promise<unknown>,
  expectedCode: CreateProductDraftApplicationError["code"],
): Promise<CreateProductDraftApplicationError> => {
  try {
    await operation();
    throw new Error("Expected CreateProductDraftApplicationError.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(CreateProductDraftApplicationError);

    if (error instanceof CreateProductDraftApplicationError) {
      expect(error.code).toBe(expectedCode);
      return error;
    }

    throw error;
  }
};

describe("CreateProductDraftService", () => {
  it("creates and saves a new Product Draft", async () => {
    const repository = new FakeProductDraftRepository();
    const service = createService(repository);

    await service.execute(createValidInput());

    expect(repository.savedDrafts).toHaveLength(1);
  });

  it("returns CREATED", async () => {
    const service = createService(new FakeProductDraftRepository());

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      status: "CREATED",
      created: true,
      idempotentReplay: false,
    });
  });

  it("passes normalized idempotency key to repository save", async () => {
    const repository = new FakeProductDraftRepository();
    const service = createService(repository);

    await service.execute(
      createValidInput({
        request: {
          requestedBy: "operator-001",
          requestedAt: REQUESTED_AT,
          idempotencyKey: " idempotency-001 ",
        },
      }),
    );

    expect(repository.saveOptions).toEqual([{ idempotencyKey: "idempotency-001" }]);
  });

  it("returns existing draft for idempotency replay", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftByIdempotencyKey = buildDraft({ id: "existing-draft" });
    const service = createService(repository);

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      draft: {
        id: "existing-draft",
      },
    });
  });

  it("returns IDEMPOTENT_REPLAY", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftByIdempotencyKey = buildDraft();
    const service = createService(repository);

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      created: false,
      idempotentReplay: true,
    });
  });

  it("does not generate an ID during replay", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftByIdempotencyKey = buildDraft();
    const idGenerator = vi.fn(() => "generated-draft-id");
    const service = createService(repository, createFactory(), idGenerator);

    await service.execute(createValidInput());

    expect(idGenerator).not.toHaveBeenCalled();
  });

  it("does not invoke factory creation during replay", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftByIdempotencyKey = buildDraft();
    const factoryCreate = vi.fn(() => buildDraft());
    const factory: CreateProductDraftFactoryPort = {
      create: factoryCreate,
    };
    const service = createService(repository, factory);

    await service.execute(createValidInput());

    expect(factoryCreate).not.toHaveBeenCalled();
  });

  it("does not save during replay", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftByIdempotencyKey = buildDraft();
    const service = createService(repository);

    await service.execute(createValidInput());

    expect(repository.savedDrafts).toHaveLength(0);
  });

  it("rejects duplicate source reference without matching idempotency", async () => {
    const repository = new FakeProductDraftRepository();
    repository.draftBySourceReference = buildDraft({ id: "existing-source-draft" });
    const service = createService(repository);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "DUPLICATE_SOURCE_REFERENCE");
  });

  it("does not confuse supplier identity with source identity", async () => {
    const repository = new FakeProductDraftRepository();
    const service = createService(repository);

    await service.execute(
      createValidInput({
        sourceReference: {
          sourceId: "source-identity",
        },
        supplier: {
          supplierProductId: "supplier-product-identity",
        },
      }),
    );

    expect(repository.sourceLookups).toEqual(["manual:source-identity"]);
  });

  it("translates factory validation errors", async () => {
    const repository = new FakeProductDraftRepository();
    const factory: CreateProductDraftFactoryPort = {
      create: vi.fn(() => {
        throw new ProductDraftValidationError([
          {
            code: "TITLE_REQUIRED",
            field: "title",
            message: "Value must be non-empty.",
          },
        ]);
      }),
    };
    const service = createService(repository, factory);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "VALIDATION_FAILED");
  });

  it("preserves safe validation issues", async () => {
    const repository = new FakeProductDraftRepository();
    const factory: CreateProductDraftFactoryPort = {
      create: vi.fn(() => {
        throw new ProductDraftValidationError([
          {
            code: "TITLE_REQUIRED",
            field: "title",
            message: "Value must be non-empty.",
          },
        ]);
      }),
    };
    const service = createService(repository, factory);
    const error = await expectApplicationErrorCode(() => service.execute(createValidInput()), "VALIDATION_FAILED");

    expect(error.validationIssues).toEqual([
      {
        code: "TITLE_REQUIRED",
        field: "title",
        message: "Value must be non-empty.",
      },
    ]);
  });

  it("translates duplicate idempotency repository errors", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("DUPLICATE_IDEMPOTENCY_KEY", "Duplicate idempotency key.");
    const service = createService(repository);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "IDEMPOTENCY_CONFLICT");
  });

  it("resolves duplicate idempotency race as replay when possible", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("DUPLICATE_IDEMPOTENCY_KEY", "Duplicate idempotency key.");
    const service = createService(repository);
    repository.draftByIdempotencyKey = null;

    repository.findByIdempotencyKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildDraft({ id: "race-winner" }));

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      draft: {
        id: "race-winner",
      },
    });
  });

  it("translates duplicate source repository errors", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("DUPLICATE_SOURCE_REFERENCE", "Duplicate source.");
    const service = createService(repository);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "DUPLICATE_SOURCE_REFERENCE");
  });

  it("translates version conflicts", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("VERSION_CONFLICT", "Version conflict.");
    const service = createService(repository);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "VERSION_CONFLICT");
  });

  it("translates unknown repository failures", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("UNKNOWN", "Unknown repository failure.");
    const service = createService(repository);

    await expectApplicationErrorCode(() => service.execute(createValidInput()), "REPOSITORY_FAILURE");
  });

  it("preserves correlation ID in result", async () => {
    const service = createService(new FakeProductDraftRepository());

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      correlationId: "correlation-001",
      externalCorrelationId: "external-correlation-001",
    });
  });

  it("does not invent correlation ID", async () => {
    const service = createService(new FakeProductDraftRepository());
    const input = createValidInput({
      request: {
        requestedBy: "operator-001",
        requestedAt: REQUESTED_AT,
      },
    });
    Reflect.deleteProperty(input, "externalCorrelationId");

    await expect(service.execute(input)).resolves.not.toHaveProperty("correlationId");
  });

  it("does not mutate the DTO", async () => {
    const service = createService(new FakeProductDraftRepository());
    const input = createValidInput({
      request: {
        requestedBy: "operator-001",
        requestedAt: REQUESTED_AT,
        idempotencyKey: " idempotency-001 ",
      },
    });

    await service.execute(input);

    expect(input.request.idempotencyKey).toBe(" idempotency-001 ");
  });

  it("uses injected ID generator", async () => {
    const repository = new FakeProductDraftRepository();
    const idGenerator = vi.fn(() => "generated-draft-id");
    const factory: CreateProductDraftFactoryPort = {
      create: vi.fn((_input: CreateProductDraftDto, dependencies: ProductDraftFactoryDependencies) =>
        buildDraft({ id: dependencies.idGenerator() }),
      ),
    };
    const service = createService(repository, factory, idGenerator);

    const result = await service.execute(createValidInput({ request: { requestedBy: "operator-001", requestedAt: REQUESTED_AT } }));

    expect(result.draft.id).toBe("generated-draft-id");
  });

  it("uses injected clock", async () => {
    const repository = new FakeProductDraftRepository();
    const clock = vi.fn(() => NOW);
    const factory: CreateProductDraftFactoryPort = {
      create: vi.fn((_input: CreateProductDraftDto, dependencies: ProductDraftFactoryDependencies) =>
        buildDraft({ createdAt: dependencies.clock(), updatedAt: dependencies.clock() }),
      ),
    };
    const service = createService(repository, factory, vi.fn(() => "generated-draft-id"), clock);

    const result = await service.execute(createValidInput({ request: { requestedBy: "operator-001", requestedAt: REQUESTED_AT } }));

    expect(result.draft.createdAt).toBe(NOW);
  });

  it("returns the repository-owned aggregate", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveDraftOverride = buildDraft({ id: "repository-owned-draft" });
    const service = createService(repository);

    await expect(service.execute(createValidInput())).resolves.toMatchObject({
      draft: {
        id: "repository-owned-draft",
      },
    });
  });

  it("does not expose raw repository errors", async () => {
    const repository = new FakeProductDraftRepository();
    repository.saveError = new ProductDraftRepositoryError("VERSION_CONFLICT", "Raw repository message.", {
      draftId: "draft-001",
    });
    const service = createService(repository);
    const error = await expectApplicationErrorCode(() => service.execute(createValidInput()), "VERSION_CONFLICT");

    expect(error).not.toBe(repository.saveError);
    expect(error.message).toBe("Product Draft version conflict prevented creation.");
    expect(error.metadata).toMatchObject({ repositoryErrorCode: "VERSION_CONFLICT" });
  });

  it("handles blank idempotency keys consistently", async () => {
    const repository = new FakeProductDraftRepository();
    const service = createService(repository);

    const result = await service.execute(
      createValidInput({
        request: {
          requestedBy: "operator-001",
          requestedAt: REQUESTED_AT,
          idempotencyKey: " ",
        },
      }),
    );

    expect(repository.idempotencyLookups).toEqual([]);
    expect(repository.saveOptions).toEqual([{}]);
    expect(result).not.toHaveProperty("idempotencyKey");
  });
});
