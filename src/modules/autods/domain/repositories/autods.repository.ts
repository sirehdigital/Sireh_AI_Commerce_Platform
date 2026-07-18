import type { AutoDsProduct } from "../models/autods-product.model.js";

export interface AutoDsRepository {
  findByAutoDsProductId(autoDsProductId: string): Promise<AutoDsProduct | undefined>;
  findBySupplierProductId(supplierProductId: string): Promise<AutoDsProduct | undefined>;
  save(product: AutoDsProduct): Promise<AutoDsProduct>;
  update(product: AutoDsProduct): Promise<AutoDsProduct>;
  delete(productId: string): Promise<void>;
  exists(autoDsProductId: string): Promise<boolean>;
  list(): Promise<readonly AutoDsProduct[]>;
}
