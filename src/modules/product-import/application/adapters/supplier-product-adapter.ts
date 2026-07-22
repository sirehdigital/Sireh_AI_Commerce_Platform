import type { SupplierProductImportInput } from "../../domain/models/product-import.model.js";

export interface SupplierProductAdapter<Payload = unknown> {
  readonly sourcePlatform: SupplierProductImportInput["sourcePlatform"];
  adapt(payload: Payload): SupplierProductImportInput;
}
