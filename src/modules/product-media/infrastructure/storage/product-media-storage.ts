export interface ProductMediaStorageRecord {
  readonly assetId: string;
  readonly storageKey: string;
  readonly contentType: string;
  readonly sizeBytes?: number;
  readonly readUrl?: string;
}

export interface ProductMediaStorage {
  storeMetadata(record: ProductMediaStorageRecord): Promise<ProductMediaStorageRecord>;
}

export class InMemoryProductMediaStorage implements ProductMediaStorage {
  private readonly records = new Map<string, ProductMediaStorageRecord>();

  public storeMetadata(record: ProductMediaStorageRecord): Promise<ProductMediaStorageRecord> {
    this.records.set(record.assetId, { ...record });
    return Promise.resolve({ ...record });
  }

  public findByAssetId(assetId: string): ProductMediaStorageRecord | undefined {
    const record = this.records.get(assetId);
    return record === undefined ? undefined : { ...record };
  }
}
