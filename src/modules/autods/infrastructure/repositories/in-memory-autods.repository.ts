import { AutoDsProductNotFoundError } from "../../domain/errors/autods.errors.js";
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

export class InMemoryAutoDsRepository implements AutoDsRepository {
  private readonly productsByAutoDsProductId = new Map<string, AutoDsProduct>();

  public findByAutoDsProductId(autoDsProductId: string): Promise<AutoDsProduct | undefined> {
    const product = this.productsByAutoDsProductId.get(this.normalizeAutoDsProductId(autoDsProductId));

    return Promise.resolve(product === undefined ? undefined : this.cloneProduct(product));
  }

  public findBySupplierProductId(supplierProductId: string): Promise<AutoDsProduct | undefined> {
    const product = this.getOrderedProducts().find(
      (candidate) => candidate.supplier.supplierProductId === supplierProductId,
    );

    return Promise.resolve(product === undefined ? undefined : this.cloneProduct(product));
  }

  public save(product: AutoDsProduct): Promise<AutoDsProduct> {
    const productCopy = this.cloneProduct(product);
    this.productsByAutoDsProductId.set(this.normalizeAutoDsProductId(product.autoDsProductId), productCopy);

    return Promise.resolve(this.cloneProduct(productCopy));
  }

  public update(product: AutoDsProduct): Promise<AutoDsProduct> {
    const normalizedAutoDsProductId = this.normalizeAutoDsProductId(product.autoDsProductId);

    if (!this.productsByAutoDsProductId.has(normalizedAutoDsProductId)) {
      throw new AutoDsProductNotFoundError(`AutoDS product with ID "${product.autoDsProductId}" was not found.`);
    }

    const productCopy = this.cloneProduct(product);
    this.productsByAutoDsProductId.set(normalizedAutoDsProductId, productCopy);

    return Promise.resolve(this.cloneProduct(productCopy));
  }

  public delete(productId: string): Promise<void> {
    this.productsByAutoDsProductId.delete(this.normalizeAutoDsProductId(productId));

    return Promise.resolve();
  }

  public exists(autoDsProductId: string): Promise<boolean> {
    return Promise.resolve(this.productsByAutoDsProductId.has(this.normalizeAutoDsProductId(autoDsProductId)));
  }

  public list(): Promise<readonly AutoDsProduct[]> {
    return Promise.resolve(this.getOrderedProducts().map((product) => this.cloneProduct(product)));
  }

  private normalizeAutoDsProductId(autoDsProductId: string): string {
    return autoDsProductId.trim().toLowerCase();
  }

  private getOrderedProducts(): readonly AutoDsProduct[] {
    return [...this.productsByAutoDsProductId.values()].sort((first, second) =>
      this.normalizeAutoDsProductId(first.autoDsProductId).localeCompare(
        this.normalizeAutoDsProductId(second.autoDsProductId),
      ),
    );
  }

  private cloneProduct(product: AutoDsProduct): AutoDsProduct {
    return {
      id: product.id,
      autoDsProductId: product.autoDsProductId,
      title: product.title,
      ...(product.description === undefined ? {} : { description: product.description }),
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      tags: [...product.tags],
      status: product.status,
      supplier: this.cloneSupplier(product.supplier),
      images: product.images.map((image) => this.cloneImage(image)),
      variants: product.variants.map((variant) => this.cloneVariant(variant)),
      shippingEstimates: product.shippingEstimates.map((estimate) => this.cloneShippingEstimate(estimate)),
      synchronization: this.cloneSynchronization(product.synchronization),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      ...(product.importedAt === undefined ? {} : { importedAt: product.importedAt }),
    };
  }

  private cloneSupplier(supplier: AutoDsSupplierReference): AutoDsSupplierReference {
    return {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      supplierProductId: supplier.supplierProductId,
      supplierProductUrl: supplier.supplierProductUrl,
      marketplace: supplier.marketplace,
      ...(supplier.countryCode === undefined ? {} : { countryCode: supplier.countryCode }),
    };
  }

  private cloneImage(image: AutoDsProductImage): AutoDsProductImage {
    return {
      ...(image.id === undefined ? {} : { id: image.id }),
      url: image.url,
      ...(image.altText === undefined ? {} : { altText: image.altText }),
      position: image.position,
    };
  }

  private cloneVariant(variant: AutoDsProductVariant): AutoDsProductVariant {
    return {
      id: variant.id,
      supplierVariantId: variant.supplierVariantId,
      ...(variant.sku === undefined ? {} : { sku: variant.sku }),
      title: variant.title,
      options: variant.options.map((option) => this.cloneOptionValue(option)),
      supplierPrice: this.cloneMoney(variant.supplierPrice),
      ...(variant.recommendedRetailPrice === undefined
        ? {}
        : { recommendedRetailPrice: this.cloneMoney(variant.recommendedRetailPrice) }),
      available: variant.available,
      ...(variant.inventoryQuantity === undefined ? {} : { inventoryQuantity: variant.inventoryQuantity }),
      ...(variant.imageUrl === undefined ? {} : { imageUrl: variant.imageUrl }),
      ...(variant.barcode === undefined ? {} : { barcode: variant.barcode }),
      ...(variant.weightGrams === undefined ? {} : { weightGrams: variant.weightGrams }),
    };
  }

  private cloneOptionValue(option: AutoDsProductOptionValue): AutoDsProductOptionValue {
    return {
      name: option.name,
      value: option.value,
    };
  }

  private cloneMoney(money: AutoDsMoney): AutoDsMoney {
    return {
      amount: money.amount,
      currency: money.currency,
    };
  }

  private cloneShippingEstimate(estimate: AutoDsShippingEstimate): AutoDsShippingEstimate {
    return {
      destinationCountryCode: estimate.destinationCountryCode,
      methodName: estimate.methodName,
      cost: this.cloneMoney(estimate.cost),
      minimumDeliveryDays: estimate.minimumDeliveryDays,
      maximumDeliveryDays: estimate.maximumDeliveryDays,
      trackingAvailable: estimate.trackingAvailable,
    };
  }

  private cloneSynchronization(synchronization: AutoDsProductSynchronization): AutoDsProductSynchronization {
    return {
      status: synchronization.status,
      ...(synchronization.lastSynchronizedAt === undefined
        ? {}
        : { lastSynchronizedAt: synchronization.lastSynchronizedAt }),
      ...(synchronization.lastInventorySynchronizedAt === undefined
        ? {}
        : { lastInventorySynchronizedAt: synchronization.lastInventorySynchronizedAt }),
      ...(synchronization.lastPriceSynchronizedAt === undefined
        ? {}
        : { lastPriceSynchronizedAt: synchronization.lastPriceSynchronizedAt }),
      ...(synchronization.failureReason === undefined ? {} : { failureReason: synchronization.failureReason }),
    };
  }
}
