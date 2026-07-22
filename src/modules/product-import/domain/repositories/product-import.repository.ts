import type { ProductImportPipelineResult, ProductImportSourcePlatform } from "../models/product-import.model.js";

export interface ProductImportIdentity {
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly externalProductId: string;
}

export interface ProductImportRepository {
  findByIdentity(identity: ProductImportIdentity): ProductImportPipelineResult | undefined;
  save(result: ProductImportPipelineResult): ProductImportPipelineResult;
}
