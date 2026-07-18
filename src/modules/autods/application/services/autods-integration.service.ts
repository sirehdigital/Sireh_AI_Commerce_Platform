import {
  AutoDsError,
  AutoDsProductNotFoundError,
  AutoDsRepositoryError,
  AutoDsValidationError,
} from "../../domain/errors/autods.errors.js";
import type { AutoDsClient, AutoDsClientHealth } from "../../domain/clients/autods.client.js";
import type {
  AutoDsMoney,
  AutoDsProduct,
  AutoDsProductImage,
  AutoDsProductOptionValue,
  AutoDsProductSynchronization,
  AutoDsProductVariant,
  AutoDsShippingEstimate,
  AutoDsSupplierReference,
} from "../../domain/models/autods-product.model.js";
import type { AutoDsRepository } from "../../domain/repositories/autods.repository.js";
import type {
  AutoDsMoneyDto,
  AutoDsProductDto,
  AutoDsProductImageDto,
  AutoDsProductImportResultDto,
  AutoDsProductOptionValueDto,
  AutoDsProductSynchronizationDto,
  AutoDsProductVariantDto,
  AutoDsShippingEstimateDto,
  AutoDsSupplierReferenceDto,
  FindAutoDsProductDto,
  ImportAutoDsProductDto,
} from "../dtos/autods-product.dto.js";

type AutoDsClock = () => string;

export class AutoDsIntegrationService {
  public constructor(
    private readonly client: AutoDsClient,
    private readonly repository: AutoDsRepository,
    private readonly now: AutoDsClock = () => new Date().toISOString(),
  ) {}

  public async importProduct(command: ImportAutoDsProductDto | undefined): Promise<AutoDsProductImportResultDto> {
    const operationTimestamp = this.getOperationTimestamp();
    const productDto = this.getProductFromCommand(command);
    const normalizedAutoDsProductId = this.normalizeRequiredText(
      productDto.autoDsProductId,
      "AutoDS product ID is required.",
    );

    this.validateProductDto(productDto);

    const existingProduct = await this.executeRepositoryOperation(
      () => this.repository.findByAutoDsProductId(normalizedAutoDsProductId),
      "Failed to inspect an AutoDS product before import.",
    );
    const product = this.mapProductDtoToDomain(productDto, operationTimestamp, existingProduct);
    const persistedProduct =
      existingProduct === undefined
        ? await this.executeRepositoryOperation(
            () => this.repository.save(product),
            "Failed to save an AutoDS product.",
          )
        : await this.executeRepositoryOperation(
            () => this.repository.update(product),
            "Failed to update an AutoDS product.",
          );

    return {
      productId: persistedProduct.id,
      autoDsProductId: persistedProduct.autoDsProductId,
      imported: true,
      created: existingProduct === undefined,
      updated: existingProduct !== undefined,
      importedAt: operationTimestamp,
    };
  }

  public async fetchAndImportProduct(autoDsProductId: string | undefined): Promise<AutoDsProductImportResultDto> {
    const normalizedAutoDsProductId = this.normalizeRequiredText(
      autoDsProductId,
      "AutoDS product ID is required.",
    );
    const product = await this.client.getProduct(normalizedAutoDsProductId);

    if (product === undefined) {
      throw new AutoDsProductNotFoundError("AutoDS product was not found.");
    }

    return this.importProduct({ product });
  }

  public async findProduct(query: FindAutoDsProductDto | undefined): Promise<AutoDsProduct | undefined> {
    if (query === undefined) {
      throw new AutoDsValidationError("AutoDS product lookup query is required.");
    }

    const autoDsProductId = this.normalizeOptionalText(query.autoDsProductId);
    const supplierProductId = this.normalizeOptionalText(query.supplierProductId);

    if (autoDsProductId === undefined && supplierProductId === undefined) {
      throw new AutoDsValidationError("AutoDS product lookup requires an AutoDS product ID or supplier product ID.");
    }

    if (autoDsProductId !== undefined) {
      return this.executeRepositoryOperation(
        () => this.repository.findByAutoDsProductId(autoDsProductId),
        "Failed to find an AutoDS product by AutoDS product ID.",
      );
    }

    if (supplierProductId !== undefined) {
      return this.executeRepositoryOperation(
        () => this.repository.findBySupplierProductId(supplierProductId),
        "Failed to find an AutoDS product by supplier product ID.",
      );
    }

    throw new AutoDsValidationError("AutoDS product lookup requires an AutoDS product ID or supplier product ID.");
  }

  public async requireProduct(query: FindAutoDsProductDto | undefined): Promise<AutoDsProduct> {
    const product = await this.findProduct(query);

    if (product === undefined) {
      throw new AutoDsProductNotFoundError("AutoDS product was not found.");
    }

    return product;
  }

  public listProducts(): Promise<readonly AutoDsProduct[]> {
    return this.executeRepositoryOperation(
      () => this.repository.list(),
      "Failed to list AutoDS products.",
    );
  }

  public deleteProduct(autoDsProductId: string | undefined): Promise<void> {
    const normalizedAutoDsProductId = this.normalizeRequiredText(
      autoDsProductId,
      "AutoDS product ID is required.",
    );

    return this.executeRepositoryOperation(
      () => this.repository.delete(normalizedAutoDsProductId),
      "Failed to delete an AutoDS product.",
    );
  }

  public productExists(autoDsProductId: string | undefined): Promise<boolean> {
    const normalizedAutoDsProductId = this.normalizeRequiredText(
      autoDsProductId,
      "AutoDS product ID is required.",
    );

    return this.executeRepositoryOperation(
      () => this.repository.exists(normalizedAutoDsProductId),
      "Failed to check AutoDS product existence.",
    );
  }

  public health(): Promise<AutoDsClientHealth> {
    return this.client.health();
  }

  private getOperationTimestamp(): string {
    return this.normalizeRequiredText(this.now(), "Operation timestamp is required.");
  }

  private getProductFromCommand(command: ImportAutoDsProductDto | undefined): AutoDsProductDto {
    if (command === undefined) {
      throw new AutoDsValidationError("AutoDS import command is required.");
    }

    return command.product;
  }

  private validateProductDto(product: AutoDsProductDto): void {
    this.normalizeRequiredText(product.autoDsProductId, "AutoDS product ID is required.");
    this.normalizeRequiredText(product.title, "AutoDS product title is required.");
    this.validateSupplier(product.supplier);
    product.images.forEach((image) => this.validateImage(image));
    product.variants.forEach((variant) => this.validateVariant(variant));
    product.shippingEstimates.forEach((estimate) => this.validateShippingEstimate(estimate));
    this.validateOptionalTimestamp(product.createdAt, "Product created timestamp must be a non-empty string.");
    this.validateOptionalTimestamp(product.updatedAt, "Product updated timestamp must be a non-empty string.");
    this.validateOptionalTimestamp(product.importedAt, "Product imported timestamp must be a non-empty string.");

    if (product.synchronization !== undefined) {
      this.validateSynchronization(product.synchronization);
    }
  }

  private validateSupplier(supplier: AutoDsSupplierReferenceDto): void {
    this.normalizeRequiredText(supplier.supplierId, "Supplier ID is required.");
    this.normalizeRequiredText(supplier.supplierName, "Supplier name is required.");
    this.normalizeRequiredText(supplier.supplierProductId, "Supplier product ID is required.");
    this.normalizeRequiredText(supplier.supplierProductUrl, "Supplier product URL is required.");
    this.normalizeRequiredText(supplier.marketplace, "Supplier marketplace is required.");
  }

  private validateImage(image: AutoDsProductImageDto): void {
    this.normalizeRequiredText(image.url, "AutoDS product image URL is required.");
    this.validateNonNegativeInteger(image.position, "AutoDS product image position must be a non-negative integer.");
  }

  private validateVariant(variant: AutoDsProductVariantDto): void {
    this.normalizeRequiredText(variant.id, "AutoDS product variant ID is required.");
    this.normalizeRequiredText(variant.supplierVariantId, "Supplier variant ID is required.");
    this.normalizeRequiredText(variant.title, "AutoDS product variant title is required.");
    variant.options.forEach((option) => this.validateOptionValue(option));
    this.validateMoney(variant.supplierPrice);

    if (variant.recommendedRetailPrice !== undefined) {
      this.validateMoney(variant.recommendedRetailPrice);
    }

    if (variant.inventoryQuantity !== undefined) {
      this.validateNonNegativeInteger(
        variant.inventoryQuantity,
        "AutoDS inventory quantity must be a non-negative integer.",
      );
    }

    if (variant.imageUrl !== undefined) {
      this.normalizeRequiredText(variant.imageUrl, "AutoDS product variant image URL must be non-empty.");
    }

    if (variant.weightGrams !== undefined) {
      this.validateNonNegativeFiniteNumber(variant.weightGrams, "AutoDS product variant weight must be non-negative.");
    }
  }

  private validateOptionValue(option: AutoDsProductOptionValueDto): void {
    this.normalizeRequiredText(option.name, "AutoDS product option name is required.");
    this.normalizeRequiredText(option.value, "AutoDS product option value is required.");
  }

  private validateMoney(money: AutoDsMoneyDto): void {
    this.validateNonNegativeFiniteNumber(money.amount, "AutoDS money amount must be finite and non-negative.");
    this.normalizeRequiredText(money.currency, "AutoDS money currency is required.");
  }

  private validateShippingEstimate(estimate: AutoDsShippingEstimateDto): void {
    this.normalizeRequiredText(
      estimate.destinationCountryCode,
      "AutoDS shipping destination country code is required.",
    );
    this.normalizeRequiredText(estimate.methodName, "AutoDS shipping method name is required.");
    this.validateMoney(estimate.cost);
    this.validateNonNegativeInteger(
      estimate.minimumDeliveryDays,
      "AutoDS minimum delivery days must be a non-negative integer.",
    );
    this.validateNonNegativeInteger(
      estimate.maximumDeliveryDays,
      "AutoDS maximum delivery days must be a non-negative integer.",
    );

    if (estimate.minimumDeliveryDays > estimate.maximumDeliveryDays) {
      throw new AutoDsValidationError("AutoDS minimum delivery days cannot exceed maximum delivery days.");
    }
  }

  private validateSynchronization(synchronization: AutoDsProductSynchronizationDto): void {
    this.validateOptionalTimestamp(
      synchronization.lastSynchronizedAt,
      "Last synchronized timestamp must be a non-empty string.",
    );
    this.validateOptionalTimestamp(
      synchronization.lastInventorySynchronizedAt,
      "Last inventory synchronized timestamp must be a non-empty string.",
    );
    this.validateOptionalTimestamp(
      synchronization.lastPriceSynchronizedAt,
      "Last price synchronized timestamp must be a non-empty string.",
    );
  }

  private mapProductDtoToDomain(
    product: AutoDsProductDto,
    operationTimestamp: string,
    existingProduct: AutoDsProduct | undefined,
  ): AutoDsProduct {
    const normalizedAutoDsProductId = this.normalizeRequiredText(
      product.autoDsProductId,
      "AutoDS product ID is required.",
    );
    const newInternalId = this.normalizeOptionalText(product.id) ?? `autods:${normalizedAutoDsProductId}`;

    return {
      id: existingProduct?.id ?? newInternalId,
      autoDsProductId: normalizedAutoDsProductId,
      title: this.normalizeRequiredText(product.title, "AutoDS product title is required."),
      ...(product.description === undefined ? {} : { description: product.description }),
      ...this.optionalBrand(product.brand),
      ...this.optionalCategory(product.category),
      ...this.optionalProductType(product.productType),
      tags: this.normalizeTags(product.tags),
      status: product.status,
      supplier: this.mapSupplier(product.supplier),
      images: product.images.map((image) => this.mapImage(image)),
      variants: product.variants.map((variant) => this.mapVariant(variant)),
      shippingEstimates: product.shippingEstimates.map((estimate) => this.mapShippingEstimate(estimate)),
      synchronization: this.mapSynchronization(product.synchronization),
      createdAt: existingProduct?.createdAt ?? this.normalizeTimestamp(product.createdAt, operationTimestamp),
      updatedAt: existingProduct === undefined ? this.normalizeTimestamp(product.updatedAt, operationTimestamp) : operationTimestamp,
      importedAt: existingProduct === undefined ? this.normalizeTimestamp(product.importedAt, operationTimestamp) : operationTimestamp,
    };
  }

  private mapSupplier(supplier: AutoDsSupplierReferenceDto): AutoDsSupplierReference {
    return {
      supplierId: this.normalizeRequiredText(supplier.supplierId, "Supplier ID is required."),
      supplierName: this.normalizeRequiredText(supplier.supplierName, "Supplier name is required."),
      supplierProductId: this.normalizeRequiredText(supplier.supplierProductId, "Supplier product ID is required."),
      supplierProductUrl: this.normalizeRequiredText(supplier.supplierProductUrl, "Supplier product URL is required."),
      marketplace: this.normalizeRequiredText(supplier.marketplace, "Supplier marketplace is required."),
      ...this.optionalCountryCode(supplier.countryCode),
    };
  }

  private mapImage(image: AutoDsProductImageDto): AutoDsProductImage {
    return {
      ...this.optionalImageId(image.id),
      url: this.normalizeRequiredText(image.url, "AutoDS product image URL is required."),
      ...this.optionalAltText(image.altText),
      position: image.position,
    };
  }

  private mapVariant(variant: AutoDsProductVariantDto): AutoDsProductVariant {
    return {
      id: this.normalizeRequiredText(variant.id, "AutoDS product variant ID is required."),
      supplierVariantId: this.normalizeRequiredText(variant.supplierVariantId, "Supplier variant ID is required."),
      ...this.optionalSku(variant.sku),
      title: this.normalizeRequiredText(variant.title, "AutoDS product variant title is required."),
      options: variant.options.map((option) => this.mapOptionValue(option)),
      supplierPrice: this.mapMoney(variant.supplierPrice),
      ...(variant.recommendedRetailPrice === undefined
        ? {}
        : { recommendedRetailPrice: this.mapMoney(variant.recommendedRetailPrice) }),
      available: variant.available,
      ...(variant.inventoryQuantity === undefined ? {} : { inventoryQuantity: variant.inventoryQuantity }),
      ...this.optionalImageUrl(variant.imageUrl),
      ...this.optionalBarcode(variant.barcode),
      ...(variant.weightGrams === undefined ? {} : { weightGrams: variant.weightGrams }),
    };
  }

  private mapOptionValue(option: AutoDsProductOptionValueDto): AutoDsProductOptionValue {
    return {
      name: this.normalizeRequiredText(option.name, "AutoDS product option name is required."),
      value: this.normalizeRequiredText(option.value, "AutoDS product option value is required."),
    };
  }

  private mapMoney(money: AutoDsMoneyDto): AutoDsMoney {
    return {
      amount: money.amount,
      currency: this.normalizeRequiredText(money.currency, "AutoDS money currency is required."),
    };
  }

  private mapShippingEstimate(estimate: AutoDsShippingEstimateDto): AutoDsShippingEstimate {
    return {
      destinationCountryCode: this.normalizeRequiredText(
        estimate.destinationCountryCode,
        "AutoDS shipping destination country code is required.",
      ),
      methodName: this.normalizeRequiredText(estimate.methodName, "AutoDS shipping method name is required."),
      cost: this.mapMoney(estimate.cost),
      minimumDeliveryDays: estimate.minimumDeliveryDays,
      maximumDeliveryDays: estimate.maximumDeliveryDays,
      trackingAvailable: estimate.trackingAvailable,
    };
  }

  private mapSynchronization(
    synchronization: AutoDsProductSynchronizationDto | undefined,
  ): AutoDsProductSynchronization {
    if (synchronization === undefined) {
      return {
        status: "pending",
      };
    }

    return {
      status: synchronization.status,
      ...this.optionalLastSynchronizedAt(synchronization.lastSynchronizedAt),
      ...this.optionalLastInventorySynchronizedAt(synchronization.lastInventorySynchronizedAt),
      ...this.optionalLastPriceSynchronizedAt(synchronization.lastPriceSynchronizedAt),
      ...this.optionalFailureReason(synchronization.failureReason),
    };
  }

  private normalizeTags(tags: readonly string[]): readonly string[] {
    const seenTags = new Set<string>();
    const normalizedTags: string[] = [];

    for (const tag of tags) {
      const normalizedTag = this.normalizeOptionalText(tag);

      if (normalizedTag === undefined) {
        continue;
      }

      const dedupeKey = normalizedTag.toLowerCase();

      if (!seenTags.has(dedupeKey)) {
        seenTags.add(dedupeKey);
        normalizedTags.push(normalizedTag);
      }
    }

    return normalizedTags;
  }

  private normalizeRequiredText(value: string | undefined, message: string): string {
    const normalizedValue = this.normalizeOptionalText(value);

    if (normalizedValue === undefined) {
      throw new AutoDsValidationError(message);
    }

    return normalizedValue;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue === undefined || normalizedValue.length === 0 ? undefined : normalizedValue;
  }

  private optionalBrand(value: string | undefined): Pick<AutoDsProduct, "brand"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { brand: normalizedValue };
  }

  private optionalCategory(value: string | undefined): Pick<AutoDsProduct, "category"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { category: normalizedValue };
  }

  private optionalProductType(
    value: string | undefined,
  ): Pick<AutoDsProduct, "productType"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { productType: normalizedValue };
  }

  private optionalCountryCode(
    value: string | undefined,
  ): Pick<AutoDsSupplierReference, "countryCode"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { countryCode: normalizedValue };
  }

  private optionalImageId(value: string | undefined): Pick<AutoDsProductImage, "id"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { id: normalizedValue };
  }

  private optionalAltText(value: string | undefined): Pick<AutoDsProductImage, "altText"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { altText: normalizedValue };
  }

  private optionalSku(value: string | undefined): Pick<AutoDsProductVariant, "sku"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { sku: normalizedValue };
  }

  private optionalImageUrl(
    value: string | undefined,
  ): Pick<AutoDsProductVariant, "imageUrl"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { imageUrl: normalizedValue };
  }

  private optionalBarcode(value: string | undefined): Pick<AutoDsProductVariant, "barcode"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { barcode: normalizedValue };
  }

  private optionalLastSynchronizedAt(
    value: string | undefined,
  ): Pick<AutoDsProductSynchronization, "lastSynchronizedAt"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { lastSynchronizedAt: normalizedValue };
  }

  private optionalLastInventorySynchronizedAt(
    value: string | undefined,
  ): Pick<AutoDsProductSynchronization, "lastInventorySynchronizedAt"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { lastInventorySynchronizedAt: normalizedValue };
  }

  private optionalLastPriceSynchronizedAt(
    value: string | undefined,
  ): Pick<AutoDsProductSynchronization, "lastPriceSynchronizedAt"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { lastPriceSynchronizedAt: normalizedValue };
  }

  private optionalFailureReason(
    value: string | undefined,
  ): Pick<AutoDsProductSynchronization, "failureReason"> | Record<string, never> {
    const normalizedValue = this.normalizeOptionalText(value);

    return normalizedValue === undefined ? {} : { failureReason: normalizedValue };
  }

  private normalizeTimestamp(timestamp: string | undefined, fallbackTimestamp: string): string {
    return this.normalizeOptionalText(timestamp) ?? fallbackTimestamp;
  }

  private validateOptionalTimestamp(timestamp: string | undefined, message: string): void {
    if (timestamp !== undefined) {
      this.normalizeRequiredText(timestamp, message);
    }
  }

  private validateNonNegativeInteger(value: number, message: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new AutoDsValidationError(message);
    }
  }

  private validateNonNegativeFiniteNumber(value: number, message: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new AutoDsValidationError(message);
    }
  }

  private async executeRepositoryOperation<Result>(
    operation: () => Promise<Result>,
    failureMessage: string,
  ): Promise<Result> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof AutoDsError) {
        throw error;
      }

      throw new AutoDsRepositoryError(failureMessage, error instanceof Error ? error : undefined);
    }
  }
}
