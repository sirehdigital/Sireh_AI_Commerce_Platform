import type {
  ProductImportIdentity,
  ProductImportRepository,
} from "../../domain/repositories/product-import.repository.js";
import type { ProductImportPipelineResult } from "../../domain/models/product-import.model.js";

export class InMemoryProductImportRepository implements ProductImportRepository {
  private readonly resultsByIdentity = new Map<string, ProductImportPipelineResult>();

  public findByIdentity(identity: ProductImportIdentity): ProductImportPipelineResult | undefined {
    const result = this.resultsByIdentity.get(this.toKey(identity));
    return result === undefined ? undefined : this.clone(result);
  }

  public save(result: ProductImportPipelineResult): ProductImportPipelineResult {
    this.resultsByIdentity.set(
      this.toKey({ sourcePlatform: result.source.platform, externalProductId: result.source.externalProductId }),
      this.clone(result),
    );

    return this.clone(result);
  }

  public clear(): void {
    this.resultsByIdentity.clear();
  }

  private toKey(identity: ProductImportIdentity): string {
    return `${identity.sourcePlatform}:${identity.externalProductId}`.trim().toLowerCase();
  }

  private clone(result: ProductImportPipelineResult): ProductImportPipelineResult {
    return {
      ...result,
      source: { ...result.source },
      warnings: [...result.warnings],
      ...(result.failureReason === undefined
        ? {}
        : { failureReason: { ...result.failureReason, details: { ...result.failureReason.details } } }),
    };
  }
}
