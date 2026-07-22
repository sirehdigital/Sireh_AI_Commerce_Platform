import type { CreateProductDraftDto } from "../dto/create-product-draft.dto.js";
import type { ProductDraft } from "../../domain/models/product-draft.model.js";
import {
  ProductDraftFactory,
  ProductDraftValidationError,
  type ProductDraftClock,
  type ProductDraftFactoryDependencies,
  type ProductDraftIdGenerator,
  type ProductDraftValidationIssue,
} from "../../domain/factories/product-draft.factory.js";
import {
  ProductDraftRepositoryError,
  type ProductDraftRepository,
} from "../../domain/repositories/product-draft.repository.js";

export type CreateProductDraftResultStatus = "CREATED" | "IDEMPOTENT_REPLAY";

export type CreateProductDraftApplicationErrorCode =
  | "DUPLICATE_SOURCE_REFERENCE"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "VERSION_CONFLICT"
  | "REPOSITORY_FAILURE"
  | "UNKNOWN";

export type CreateProductDraftApplicationErrorMetadata = Readonly<Record<string, string | number | boolean | null>>;

export interface CreateProductDraftFactoryPort {
  create(input: CreateProductDraftDto, dependencies: ProductDraftFactoryDependencies): ProductDraft;
}

export interface CreateProductDraftServiceDependencies {
  readonly repository: ProductDraftRepository;
  readonly idGenerator: ProductDraftIdGenerator;
  readonly clock: ProductDraftClock;
  readonly factory?: CreateProductDraftFactoryPort;
}

export interface CreateProductDraftResult {
  readonly status: CreateProductDraftResultStatus;
  readonly draft: ProductDraft;
  readonly created: boolean;
  readonly idempotentReplay: boolean;
  readonly correlationId?: string;
  readonly externalCorrelationId?: string;
  readonly idempotencyKey?: string;
}

export class CreateProductDraftApplicationError extends Error {
  public readonly code: CreateProductDraftApplicationErrorCode;
  public readonly metadata: CreateProductDraftApplicationErrorMetadata;
  public readonly validationIssues: readonly ProductDraftValidationIssue[];
  public override readonly cause?: unknown;

  public constructor(
    code: CreateProductDraftApplicationErrorCode,
    message: string,
    metadata: CreateProductDraftApplicationErrorMetadata = {},
    validationIssues: readonly ProductDraftValidationIssue[] = [],
    cause?: unknown,
  ) {
    super(message);
    this.name = "CreateProductDraftApplicationError";
    this.code = code;
    this.metadata = { ...metadata };
    this.validationIssues = validationIssues.map((issue) => ({ ...issue }));
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CreateProductDraftService {
  private readonly repository: ProductDraftRepository;
  private readonly idGenerator: ProductDraftIdGenerator;
  private readonly clock: ProductDraftClock;
  private readonly factory: CreateProductDraftFactoryPort;

  public constructor(dependencies: CreateProductDraftServiceDependencies) {
    this.repository = dependencies.repository;
    this.idGenerator = dependencies.idGenerator;
    this.clock = dependencies.clock;
    this.factory = dependencies.factory ?? ProductDraftFactory;
  }

  public async execute(input: CreateProductDraftDto): Promise<CreateProductDraftResult> {
    const idempotencyKey = this.normalizeOptionalText(input.request.idempotencyKey);

    try {
      if (idempotencyKey !== undefined) {
        const existingDraft = await this.repository.findByIdempotencyKey(idempotencyKey);

        if (existingDraft !== null) {
          return this.toReplayResult(existingDraft, input, idempotencyKey);
        }
      }

      const existingSourceDraft = await this.repository.findBySourceReference(input.sourceType, input.sourceReference.sourceId);

      if (existingSourceDraft !== null) {
        throw this.createDuplicateSourceError(input, existingSourceDraft.id);
      }

      const draft = this.factory.create(input, {
        idGenerator: this.idGenerator,
        clock: this.clock,
      });
      const saveResult = await this.repository.save(draft, { ...(idempotencyKey === undefined ? {} : { idempotencyKey }) });

      return this.toCreatedResult(saveResult.draft, input, idempotencyKey);
    } catch (error: unknown) {
      if (error instanceof CreateProductDraftApplicationError) {
        throw error;
      }

      if (error instanceof ProductDraftValidationError) {
        throw new CreateProductDraftApplicationError(
          "VALIDATION_FAILED",
          "Product Draft creation request failed validation.",
          {},
          error.issues,
          error,
        );
      }

      if (error instanceof ProductDraftRepositoryError) {
        return await this.translateRepositoryError(error, input, idempotencyKey);
      }

      throw new CreateProductDraftApplicationError(
        "UNKNOWN",
        "Product Draft creation failed for an unknown reason.",
        {},
        [],
        error,
      );
    }
  }

  private async translateRepositoryError(
    error: ProductDraftRepositoryError,
    input: CreateProductDraftDto,
    idempotencyKey: string | undefined,
  ): Promise<CreateProductDraftResult> {
    if (error.code === "DUPLICATE_IDEMPOTENCY_KEY") {
      const replayDraft = idempotencyKey === undefined ? null : await this.repository.findByIdempotencyKey(idempotencyKey);

      if (replayDraft !== null) {
        return this.toReplayResult(replayDraft, input, idempotencyKey);
      }

      throw new CreateProductDraftApplicationError(
        "IDEMPOTENCY_CONFLICT",
        "Product Draft idempotency key is already associated with another creation request.",
        this.safeRepositoryMetadata(error),
        [],
        error,
      );
    }

    if (error.code === "DUPLICATE_SOURCE_REFERENCE") {
      throw new CreateProductDraftApplicationError(
        "DUPLICATE_SOURCE_REFERENCE",
        "Product Draft source reference is already associated with another draft.",
        this.safeRepositoryMetadata(error),
        [],
        error,
      );
    }

    if (error.code === "VERSION_CONFLICT") {
      throw new CreateProductDraftApplicationError(
        "VERSION_CONFLICT",
        "Product Draft version conflict prevented creation.",
        this.safeRepositoryMetadata(error),
        [],
        error,
      );
    }

    throw new CreateProductDraftApplicationError(
      "REPOSITORY_FAILURE",
      "Product Draft repository failed during creation.",
      this.safeRepositoryMetadata(error),
      [],
      error,
    );
  }

  private toCreatedResult(
    draft: ProductDraft,
    input: CreateProductDraftDto,
    idempotencyKey: string | undefined,
  ): CreateProductDraftResult {
    const correlationId = this.normalizeOptionalText(input.request.correlationId);
    const externalCorrelationId = this.normalizeOptionalText(input.externalCorrelationId);

    return {
      status: "CREATED",
      draft,
      created: true,
      idempotentReplay: false,
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(externalCorrelationId === undefined ? {} : { externalCorrelationId }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };
  }

  private toReplayResult(
    draft: ProductDraft,
    input: CreateProductDraftDto,
    idempotencyKey: string | undefined,
  ): CreateProductDraftResult {
    const correlationId = this.normalizeOptionalText(input.request.correlationId);
    const externalCorrelationId = this.normalizeOptionalText(input.externalCorrelationId);

    return {
      status: "IDEMPOTENT_REPLAY",
      draft,
      created: false,
      idempotentReplay: true,
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(externalCorrelationId === undefined ? {} : { externalCorrelationId }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };
  }

  private createDuplicateSourceError(
    input: CreateProductDraftDto,
    existingDraftId: string,
  ): CreateProductDraftApplicationError {
    return new CreateProductDraftApplicationError(
      "DUPLICATE_SOURCE_REFERENCE",
      "Product Draft source reference is already associated with another draft.",
      {
        existingDraftId,
        sourceType: input.sourceType,
        sourceId: this.normalizeOptionalText(input.sourceReference.sourceId) ?? "",
      },
    );
  }

  private safeRepositoryMetadata(error: ProductDraftRepositoryError): CreateProductDraftApplicationErrorMetadata {
    return {
      ...error.metadata,
      repositoryErrorCode: error.code,
    };
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue === undefined || normalizedValue.length === 0 ? undefined : normalizedValue;
  }
}
