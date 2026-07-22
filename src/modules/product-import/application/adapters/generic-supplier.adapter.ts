import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  ProductImportSourcePlatform,
  SupplierProductImportDeliveryEstimate,
  SupplierProductImportImageInput,
  SupplierProductImportInput,
  SupplierProductImportVariantInput,
} from "../../domain/models/product-import.model.js";
import type { SupplierProductAdapter } from "./supplier-product-adapter.js";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};

const requiredString = (payload: Record<string, unknown>, key: string): string => {
  const value = optionalString(payload[key]);

  if (value === undefined) {
    throw AppError.badRequest(`Generic supplier payload is missing ${key}.`, { field: key }, "PRODUCT_IMPORT_ADAPTER_FAILED");
  }

  return value;
};

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const stringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordArray = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const optionalField = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

export class GenericSupplierAdapter implements SupplierProductAdapter<Record<string, unknown>> {
  public readonly sourcePlatform = "generic" as const;

  public adapt(payload: Record<string, unknown>): SupplierProductImportInput {
    if (!isRecord(payload)) {
      throw AppError.badRequest("Generic supplier payload must be an object.", {}, "PRODUCT_IMPORT_ADAPTER_FAILED");
    }

    const sourcePlatform = (optionalString(payload.sourcePlatform) ?? this.sourcePlatform) as ProductImportSourcePlatform;

    return {
      externalProductId: requiredString(payload, "externalProductId"),
      sourcePlatform,
      ...optionalField("supplierName", optionalString(payload.supplierName)),
      ...optionalField("supplierUrl", optionalString(payload.supplierUrl)),
      title: requiredString(payload, "title"),
      ...optionalField("description", optionalString(payload.description)),
      ...optionalField("brand", optionalString(payload.brand)),
      ...optionalField("category", optionalString(payload.category)),
      ...optionalField("productType", optionalString(payload.productType)),
      images: recordArray(payload.images).map((image, index) => this.toImageInput(image, index)),
      variants: recordArray(payload.variants).map((variant) => this.toVariantInput(variant)),
      ...optionalField("supplierPrice", optionalNumber(payload.supplierPrice)),
      ...optionalField("compareAtPrice", optionalNumber(payload.compareAtPrice)),
      currency: optionalString(payload.currency) ?? "USD",
      ...optionalField("inventory", optionalNumber(payload.inventory)),
      ...optionalField("shippingOrigin", optionalString(payload.shippingOrigin)),
      shippingDestinations: stringArray(payload.shippingDestinations),
      ...optionalField("estimatedDelivery", this.toDeliveryEstimate(payload.estimatedDelivery)),
      tags: stringArray(payload.tags),
      rawMetadata: isRecord(payload.rawMetadata) ? payload.rawMetadata : payload,
    };
  }

  private toImageInput(image: Record<string, unknown>, index: number): SupplierProductImportImageInput {
    return {
      url: requiredString(image, "url"),
      ...optionalField("altText", optionalString(image.altText)),
      position: optionalNumber(image.position) ?? index + 1,
      ...optionalField("width", optionalNumber(image.width)),
      ...optionalField("height", optionalNumber(image.height)),
      isPrimary: image.isPrimary === true,
    };
  }

  private toVariantInput(variant: Record<string, unknown>): SupplierProductImportVariantInput {
    return {
      ...optionalField("externalVariantId", optionalString(variant.externalVariantId)),
      ...optionalField("sku", optionalString(variant.sku)),
      ...optionalField("title", optionalString(variant.title)),
      ...optionalField("optionValues", isRecord(variant.optionValues) ? this.toStringRecord(variant.optionValues) : undefined),
      ...optionalField("supplierPrice", optionalNumber(variant.supplierPrice)),
      ...optionalField("compareAtPrice", optionalNumber(variant.compareAtPrice)),
      ...optionalField("currency", optionalString(variant.currency)),
      ...optionalField("inventory", optionalNumber(variant.inventory)),
      ...optionalField("weight", optionalNumber(variant.weight)),
      ...optionalField("weightUnit", optionalString(variant.weightUnit) as SupplierProductImportInput["variants"][number]["weightUnit"]),
      ...optionalField("imageUrl", optionalString(variant.imageUrl)),
      ...optionalField("available", variant.available === undefined ? undefined : variant.available === true),
    };
  }

  private toDeliveryEstimate(value: unknown): SupplierProductImportDeliveryEstimate | undefined {
    if (!isRecord(value)) {
      return undefined;
    }

    return {
      ...optionalField("minDays", optionalNumber(value.minDays)),
      ...optionalField("maxDays", optionalNumber(value.maxDays)),
    };
  }

  private toStringRecord(value: Record<string, unknown>): Readonly<Record<string, string>> {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
}
