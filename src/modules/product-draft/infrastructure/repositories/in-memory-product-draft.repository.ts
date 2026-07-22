import type {
  ProductDraft,
  ProductDraftAiMetadata,
  ProductDraftApprovalMetadata,
  ProductDraftBranding,
  ProductDraftImage,
  ProductDraftMoney,
  ProductDraftOptionValue,
  ProductDraftPublicationMetadata,
  ProductDraftRiskAssessment,
  ProductDraftSeo,
  ProductDraftShippingEstimate,
  ProductDraftSourceReference,
  ProductDraftSourceType,
  ProductDraftVariant,
} from "../../domain/models/product-draft.model.js";
import {
  ProductDraftRepositoryError,
  type ProductDraftRepository,
  type ProductDraftRepositoryListQuery,
  type ProductDraftRepositoryListResult,
  type ProductDraftRepositorySaveOptions,
  type ProductDraftRepositorySaveResult,
} from "../../domain/repositories/product-draft.repository.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

interface StoredProductDraftRecord {
  readonly draft: ProductDraft;
  readonly idempotencyKey?: string;
  readonly sourceReferenceKey: string;
}

export class InMemoryProductDraftRepository implements ProductDraftRepository {
  private readonly draftsById = new Map<string, StoredProductDraftRecord>();
  private readonly draftIdsByIdempotencyKey = new Map<string, string>();
  private readonly draftIdsBySourceReference = new Map<string, string>();

  public save(
    draft: ProductDraft,
    options: ProductDraftRepositorySaveOptions = {},
  ): Promise<ProductDraftRepositorySaveResult> {
    const id = this.normalizeId(draft.id);
    const existingRecord = this.draftsById.get(id);
    const idempotencyKey = this.normalizeOptionalKey(options.idempotencyKey);
    const sourceReferenceKey = this.toSourceReferenceKey(draft.source.sourceType, draft.source.sourceId);

    this.assertUniqueIdempotencyKey(id, idempotencyKey);
    this.assertUniqueSourceReference(id, sourceReferenceKey);

    if (existingRecord !== undefined) {
      this.assertVersionCanBeSaved(existingRecord.draft, draft);

      if (draft.version === existingRecord.draft.version && this.areEquivalentDrafts(existingRecord.draft, draft)) {
        return Promise.resolve({
          draft: this.cloneDraft(existingRecord.draft),
          created: false,
          updated: false,
        });
      }
    }

    const storedDraft = this.cloneDraft(draft);
    const storedRecord: StoredProductDraftRecord = {
      draft: storedDraft,
      sourceReferenceKey,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };

    this.replaceIndexes(id, existingRecord, storedRecord);
    this.draftsById.set(id, storedRecord);

    return Promise.resolve({
      draft: this.cloneDraft(storedDraft),
      created: existingRecord === undefined,
      updated: existingRecord !== undefined,
    });
  }

  public findById(id: string): Promise<ProductDraft | null> {
    const record = this.draftsById.get(this.normalizeId(id));

    return Promise.resolve(record === undefined ? null : this.cloneDraft(record.draft));
  }

  public findByIdempotencyKey(idempotencyKey: string): Promise<ProductDraft | null> {
    const normalizedKey = this.normalizeOptionalKey(idempotencyKey);

    if (normalizedKey === undefined) {
      return Promise.resolve(null);
    }

    const draftId = this.draftIdsByIdempotencyKey.get(normalizedKey);
    const record = draftId === undefined ? undefined : this.draftsById.get(draftId);

    return Promise.resolve(record === undefined ? null : this.cloneDraft(record.draft));
  }

  public findBySourceReference(
    sourceType: ProductDraftSourceType,
    sourceId: string,
  ): Promise<ProductDraft | null> {
    const draftId = this.draftIdsBySourceReference.get(this.toSourceReferenceKey(sourceType, sourceId));
    const record = draftId === undefined ? undefined : this.draftsById.get(draftId);

    return Promise.resolve(record === undefined ? null : this.cloneDraft(record.draft));
  }

  public existsById(id: string): Promise<boolean> {
    return Promise.resolve(this.draftsById.has(this.normalizeId(id)));
  }

  public list(query: ProductDraftRepositoryListQuery = {}): Promise<ProductDraftRepositoryListResult> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const filteredDrafts = this.getOrderedDrafts().filter((draft) => this.matchesQuery(draft, query));
    const items = filteredDrafts.slice(offset, offset + limit).map((draft) => this.cloneDraft(draft));
    const nextOffset = offset + items.length;
    const hasNextPage = nextOffset < filteredDrafts.length;

    return Promise.resolve({
      items,
      total: filteredDrafts.length,
      limit,
      offset,
      hasNextPage,
      ...(hasNextPage ? { nextOffset } : {}),
    });
  }

  public clear(): void {
    this.draftsById.clear();
    this.draftIdsByIdempotencyKey.clear();
    this.draftIdsBySourceReference.clear();
  }

  private assertUniqueIdempotencyKey(id: string, idempotencyKey: string | undefined): void {
    if (idempotencyKey === undefined) {
      return;
    }

    const existingDraftId = this.draftIdsByIdempotencyKey.get(idempotencyKey);

    if (existingDraftId !== undefined && existingDraftId !== id) {
      throw new ProductDraftRepositoryError(
        "DUPLICATE_IDEMPOTENCY_KEY",
        "Product Draft idempotency key is already assigned to another draft.",
        {
          draftId: id,
          existingDraftId,
        },
      );
    }
  }

  private assertUniqueSourceReference(id: string, sourceReferenceKey: string): void {
    const existingDraftId = this.draftIdsBySourceReference.get(sourceReferenceKey);

    if (existingDraftId !== undefined && existingDraftId !== id) {
      throw new ProductDraftRepositoryError(
        "DUPLICATE_SOURCE_REFERENCE",
        "Product Draft source reference is already assigned to another draft.",
        {
          draftId: id,
          existingDraftId,
        },
      );
    }
  }

  private assertVersionCanBeSaved(storedDraft: ProductDraft, incomingDraft: ProductDraft): void {
    if (incomingDraft.version < storedDraft.version) {
      throw new ProductDraftRepositoryError("VERSION_CONFLICT", "Product Draft version is stale.", {
        draftId: incomingDraft.id,
        incomingVersion: incomingDraft.version,
        storedVersion: storedDraft.version,
      });
    }

    if (incomingDraft.version === storedDraft.version && !this.areEquivalentDrafts(storedDraft, incomingDraft)) {
      throw new ProductDraftRepositoryError(
        "VERSION_CONFLICT",
        "Product Draft with the same version cannot overwrite different content.",
        {
          draftId: incomingDraft.id,
          version: incomingDraft.version,
        },
      );
    }
  }

  private replaceIndexes(
    id: string,
    existingRecord: StoredProductDraftRecord | undefined,
    storedRecord: StoredProductDraftRecord,
  ): void {
    if (existingRecord?.idempotencyKey !== undefined) {
      this.draftIdsByIdempotencyKey.delete(existingRecord.idempotencyKey);
    }

    this.draftIdsBySourceReference.delete(existingRecord?.sourceReferenceKey ?? storedRecord.sourceReferenceKey);

    if (storedRecord.idempotencyKey !== undefined) {
      this.draftIdsByIdempotencyKey.set(storedRecord.idempotencyKey, id);
    }

    this.draftIdsBySourceReference.set(storedRecord.sourceReferenceKey, id);
  }

  private matchesQuery(draft: ProductDraft, query: ProductDraftRepositoryListQuery): boolean {
    return (
      this.matchesStatus(draft, query) &&
      this.matchesSourceType(draft, query) &&
      this.matchesRiskLevel(draft, query) &&
      this.matchesDateRange(draft.createdAt, query.createdFrom, query.createdTo) &&
      this.matchesDateRange(draft.updatedAt, query.updatedFrom, query.updatedTo)
    );
  }

  private matchesStatus(draft: ProductDraft, query: ProductDraftRepositoryListQuery): boolean {
    return query.status === undefined || draft.status === query.status;
  }

  private matchesSourceType(draft: ProductDraft, query: ProductDraftRepositoryListQuery): boolean {
    return query.sourceType === undefined || draft.source.sourceType === query.sourceType;
  }

  private matchesRiskLevel(draft: ProductDraft, query: ProductDraftRepositoryListQuery): boolean {
    return query.riskLevel === undefined || draft.riskAssessment?.level === query.riskLevel;
  }

  private matchesDateRange(value: string, from: string | undefined, to: string | undefined): boolean {
    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
      return false;
    }

    if (from !== undefined) {
      const fromTimestamp = Date.parse(from);

      if (!Number.isFinite(fromTimestamp)) {
        throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list query has an invalid start date.", {
          field: "from",
        });
      }

      if (timestamp < fromTimestamp) {
        return false;
      }
    }

    if (to !== undefined) {
      const toTimestamp = Date.parse(to);

      if (!Number.isFinite(toTimestamp)) {
        throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list query has an invalid end date.", {
          field: "to",
        });
      }

      if (timestamp > toTimestamp) {
        return false;
      }
    }

    return true;
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_LIST_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list limit is outside the allowed range.", {
        limit,
        maximumLimit: MAX_LIST_LIMIT,
      });
    }

    return limit;
  }

  private normalizeOffset(offset: number | undefined): number {
    if (offset === undefined) {
      return 0;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list offset is outside the allowed range.", {
        offset,
      });
    }

    return offset;
  }

  private getOrderedDrafts(): readonly ProductDraft[] {
    return [...this.draftsById.values()]
      .map((record) => record.draft)
      .sort((first, second) => {
        const createdComparison = Date.parse(second.createdAt) - Date.parse(first.createdAt);

        return createdComparison === 0 ? first.id.localeCompare(second.id) : createdComparison;
      });
  }

  private normalizeId(id: string): string {
    return id.trim();
  }

  private normalizeOptionalKey(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue === undefined || normalizedValue.length === 0 ? undefined : normalizedValue;
  }

  private toSourceReferenceKey(sourceType: ProductDraftSourceType, sourceId: string): string {
    return `${sourceType}:${sourceId.trim().toLowerCase()}`;
  }

  private areEquivalentDrafts(first: ProductDraft, second: ProductDraft): boolean {
    return this.toStableJson(first) === this.toStableJson(second);
  }

  private toStableJson(value: unknown): string {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }

    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.toStableJson(item)).join(",")}]`;
    }

    return `{${Object.entries(value)
      .filter((entry) => entry[1] !== undefined)
      .sort((first, second) => first[0].localeCompare(second[0]))
      .map((entry) => `${JSON.stringify(entry[0])}:${this.toStableJson(entry[1])}`)
      .join(",")}}`;
  }

  private cloneDraft(draft: ProductDraft): ProductDraft {
    return {
      id: draft.id,
      status: draft.status,
      version: draft.version,
      source: this.cloneSource(draft.source),
      title: draft.title,
      description: draft.description,
      ...(draft.brand === undefined ? {} : { brand: draft.brand }),
      ...(draft.category === undefined ? {} : { category: draft.category }),
      ...(draft.productType === undefined ? {} : { productType: draft.productType }),
      ...(draft.vendor === undefined ? {} : { vendor: draft.vendor }),
      tags: [...draft.tags],
      targetMarkets: [...draft.targetMarkets],
      images: draft.images.map((image) => this.cloneImage(image)),
      variants: draft.variants.map((variant) => this.cloneVariant(variant)),
      ...(draft.shipping === undefined ? {} : { shipping: this.cloneShipping(draft.shipping) }),
      ...(draft.seo === undefined ? {} : { seo: this.cloneSeo(draft.seo) }),
      ...(draft.branding === undefined ? {} : { branding: this.cloneBranding(draft.branding) }),
      ...(draft.riskAssessment === undefined ? {} : { riskAssessment: this.cloneRiskAssessment(draft.riskAssessment) }),
      ...(draft.ai === undefined ? {} : { ai: this.cloneAi(draft.ai) }),
      ...(draft.approval === undefined ? {} : { approval: this.cloneApproval(draft.approval) }),
      ...(draft.publication === undefined ? {} : { publication: this.clonePublication(draft.publication) }),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      ...(draft.archivedAt === undefined ? {} : { archivedAt: draft.archivedAt }),
      ...(draft.failureCode === undefined ? {} : { failureCode: draft.failureCode }),
      ...(draft.failureMessage === undefined ? {} : { failureMessage: draft.failureMessage }),
    };
  }

  private cloneSource(source: ProductDraftSourceReference): ProductDraftSourceReference {
    return {
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      ...(source.supplierId === undefined ? {} : { supplierId: source.supplierId }),
      ...(source.supplierProductId === undefined ? {} : { supplierProductId: source.supplierProductId }),
      importedAt: source.importedAt,
    };
  }

  private cloneImage(image: ProductDraftImage): ProductDraftImage {
    return {
      ...(image.id === undefined ? {} : { id: image.id }),
      sourceUrl: image.sourceUrl,
      ...(image.altText === undefined ? {} : { altText: image.altText }),
      position: image.position,
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      selected: image.selected,
      primary: image.primary,
    };
  }

  private cloneVariant(variant: ProductDraftVariant): ProductDraftVariant {
    return {
      id: variant.id,
      ...(variant.sourceVariantId === undefined ? {} : { sourceVariantId: variant.sourceVariantId }),
      title: variant.title,
      ...(variant.sku === undefined ? {} : { sku: variant.sku }),
      ...(variant.barcode === undefined ? {} : { barcode: variant.barcode }),
      options: variant.options.map((option) => this.cloneOptionValue(option)),
      supplierPrice: this.cloneMoney(variant.supplierPrice),
      sellingPrice: this.cloneMoney(variant.sellingPrice),
      ...(variant.compareAtPrice === undefined ? {} : { compareAtPrice: this.cloneMoney(variant.compareAtPrice) }),
      ...(variant.inventoryQuantity === undefined ? {} : { inventoryQuantity: variant.inventoryQuantity }),
      available: variant.available,
      ...(variant.weightGrams === undefined ? {} : { weightGrams: variant.weightGrams }),
      ...(variant.imageId === undefined ? {} : { imageId: variant.imageId }),
    };
  }

  private cloneOptionValue(option: ProductDraftOptionValue): ProductDraftOptionValue {
    return {
      name: option.name,
      value: option.value,
    };
  }

  private cloneMoney(money: ProductDraftMoney): ProductDraftMoney {
    return {
      amount: money.amount,
      currency: money.currency,
    };
  }

  private cloneShipping(shipping: ProductDraftShippingEstimate): ProductDraftShippingEstimate {
    return {
      minimumDeliveryDays: shipping.minimumDeliveryDays,
      maximumDeliveryDays: shipping.maximumDeliveryDays,
      ...(shipping.shipsFromCountry === undefined ? {} : { shipsFromCountry: shipping.shipsFromCountry }),
      shipsToCountries: [...shipping.shipsToCountries],
    };
  }

  private cloneSeo(seo: ProductDraftSeo): ProductDraftSeo {
    return {
      ...(seo.title === undefined ? {} : { title: seo.title }),
      ...(seo.description === undefined ? {} : { description: seo.description }),
      ...(seo.handle === undefined ? {} : { handle: seo.handle }),
    };
  }

  private cloneBranding(branding: ProductDraftBranding): ProductDraftBranding {
    return {
      ...(branding.brandName === undefined ? {} : { brandName: branding.brandName }),
      ...(branding.productName === undefined ? {} : { productName: branding.productName }),
      ...(branding.collectionName === undefined ? {} : { collectionName: branding.collectionName }),
      ...(branding.positioning === undefined ? {} : { positioning: branding.positioning }),
      targetAudience: [...branding.targetAudience],
      ...(branding.valueProposition === undefined ? {} : { valueProposition: branding.valueProposition }),
    };
  }

  private cloneRiskAssessment(riskAssessment: ProductDraftRiskAssessment): ProductDraftRiskAssessment {
    return {
      level: riskAssessment.level,
      ...(riskAssessment.score === undefined ? {} : { score: riskAssessment.score }),
      reasons: [...riskAssessment.reasons],
      restrictedClaims: [...riskAssessment.restrictedClaims],
      ...(riskAssessment.assessedAt === undefined ? {} : { assessedAt: riskAssessment.assessedAt }),
    };
  }

  private cloneAi(ai: ProductDraftAiMetadata): ProductDraftAiMetadata {
    return {
      analyzed: ai.analyzed,
      branded: ai.branded,
      copyGenerated: ai.copyGenerated,
      pricingRecommended: ai.pricingRecommended,
      riskAssessed: ai.riskAssessed,
      ...(ai.lastProcessedAt === undefined ? {} : { lastProcessedAt: ai.lastProcessedAt }),
      ...(ai.modelReference === undefined ? {} : { modelReference: ai.modelReference }),
    };
  }

  private cloneApproval(approval: ProductDraftApprovalMetadata): ProductDraftApprovalMetadata {
    return {
      approvalRequired: approval.approvalRequired,
      ...(approval.approvalId === undefined ? {} : { approvalId: approval.approvalId }),
      ...(approval.requestedAt === undefined ? {} : { requestedAt: approval.requestedAt }),
      ...(approval.reviewedAt === undefined ? {} : { reviewedAt: approval.reviewedAt }),
      ...(approval.reviewedBy === undefined ? {} : { reviewedBy: approval.reviewedBy }),
      ...(approval.rejectionReason === undefined ? {} : { rejectionReason: approval.rejectionReason }),
      ...(approval.changeRequestReason === undefined ? {} : { changeRequestReason: approval.changeRequestReason }),
    };
  }

  private clonePublication(publication: ProductDraftPublicationMetadata): ProductDraftPublicationMetadata {
    return {
      ...(publication.marketplace === undefined ? {} : { marketplace: publication.marketplace }),
      ...(publication.storeId === undefined ? {} : { storeId: publication.storeId }),
      ...(publication.externalProductId === undefined ? {} : { externalProductId: publication.externalProductId }),
      ...(publication.externalHandle === undefined ? {} : { externalHandle: publication.externalHandle }),
      ...(publication.publishedAt === undefined ? {} : { publishedAt: publication.publishedAt }),
      ...(publication.lastSynchronizedAt === undefined
        ? {}
        : { lastSynchronizedAt: publication.lastSynchronizedAt }),
      ...(publication.publicationErrorCode === undefined
        ? {}
        : { publicationErrorCode: publication.publicationErrorCode }),
      ...(publication.publicationErrorMessage === undefined
        ? {}
        : { publicationErrorMessage: publication.publicationErrorMessage }),
    };
  }
}
