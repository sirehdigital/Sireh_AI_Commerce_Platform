import {
  WinningHunterInvalidProductIdentityError,
  WinningHunterUnsupportedUrlError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  WinningHunterAdSignal,
  WinningHunterProductCandidate,
} from "../../domain/models/winninghunter-product-candidate.model.js";
import {
  createStableHash,
  normalizeWinningHunterUrl,
} from "../../domain/value-objects/winninghunter-url-normalizer.js";
import type {
  RawWinningHunterProductRow,
  RawWinningHunterScalar,
} from "../clients/raw-winninghunter-product.dto.js";

export class WinningHunterProductCandidateMapper {
  public mapRow(row: RawWinningHunterProductRow, observedAt: string): WinningHunterProductCandidate {
    const productUrl = stringValue(row.product_url);

    if (productUrl === undefined) {
      throw new WinningHunterUnsupportedUrlError();
    }

    const normalizedProductUrl = normalizeWinningHunterUrl(productUrl);
    const storeUrl = normalizeOptionalUrl(row.urlStore);
    const storeDomain =
      stringValue(row.shopify_shopifydomain)?.toLowerCase() ??
      storeUrl?.domain ??
      normalizedProductUrl.domain;
    const shopifyProductId = stringValue(row.shopify_productid);
    const externalProductId = stringValue(row.productid);
    const id = buildProductIdentity({
      ...(shopifyProductId === undefined ? {} : { shopifyProductId }),
      canonicalProductUrl: normalizedProductUrl.url,
      storeDomain,
      ...(normalizedProductUrl.productHandle === undefined
        ? {}
        : { productHandle: normalizedProductUrl.productHandle }),
      ...(externalProductId === undefined ? {} : { externalProductId }),
    });

    if (id === undefined) {
      throw new WinningHunterInvalidProductIdentityError();
    }

    const lastObservedAt = latestIsoDate([row.lastSeen, row.updated_at, row.created_at]);

    return {
      id,
      source: "WINNING_HUNTER",
      discoverySource: "META_ADS",
      ...(externalProductId === undefined ? {} : { externalProductId }),
      ...(shopifyProductId === undefined ? {} : { shopifyProductId }),
      ...optionalText("title", row.title),
      ...optionalText("description", row.description),
      productUrl,
      canonicalProductUrl: normalizedProductUrl.url,
      ...(storeUrl === undefined ? {} : { storeUrl: storeUrl.url }),
      storeDomain,
      ...(normalizedProductUrl.productHandle === undefined
        ? {}
        : { productHandle: normalizedProductUrl.productHandle }),
      ...optionalNumber("price", row.shopify_productprice, { allowZero: true }),
      ...optionalCurrency(row.shopify_currency),
      ...optionalNumber("totalActiveAdsOnPage", row.total_active_ads_on_page, { allowZero: true }),
      ...optionalNumber("activeAdsGrowthOneWeek", row.total_active_ads_on_page_growth_1w, {
        allowZero: true,
      }),
      ...optionalNumber("activeAdsGrowthOneMonth", row.total_active_ads_on_page_growth_1m, {
        allowZero: true,
      }),
      adSignals: [mapAdSignal(row)],
      discoveredAt: observedAt,
      ...(lastObservedAt === undefined ? {} : { lastObservedAt }),
    };
  }
}

export function buildProductIdentity(input: {
  readonly shopifyProductId?: string;
  readonly canonicalProductUrl?: string;
  readonly storeDomain?: string;
  readonly productHandle?: string;
  readonly externalProductId?: string;
}): string | undefined {
  if (input.shopifyProductId !== undefined) {
    return `winninghunter:shopify:${input.shopifyProductId}`;
  }

  if (input.canonicalProductUrl !== undefined) {
    return `winninghunter:url:${createStableHash(input.canonicalProductUrl)}`;
  }

  if (input.storeDomain !== undefined && input.productHandle !== undefined) {
    return `winninghunter:store-product:${createStableHash(
      `${input.storeDomain}/products/${input.productHandle}`,
    )}`;
  }

  if (input.externalProductId !== undefined) {
    return `winninghunter:external:${input.externalProductId}`;
  }

  return undefined;
}

export function parseWinningHunterNumber(
  value: RawWinningHunterScalar,
  options: { readonly allowZero?: boolean; readonly allowNegative?: boolean } = {},
): number | undefined {
  const text = stringValue(value);

  if (text === undefined) {
    return undefined;
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (!options.allowNegative && parsed < 0) {
    return undefined;
  }

  if (!options.allowZero && parsed === 0) {
    return undefined;
  }

  return parsed;
}

export function extractWinningHunterCurrency(value: RawWinningHunterScalar): string | undefined {
  const directCurrency = stringValue(value);

  if (directCurrency !== undefined && isIsoStyleCurrency(directCurrency)) {
    return directCurrency.toUpperCase();
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const active = stringValue(value.active as RawWinningHunterScalar);

  return active !== undefined && isIsoStyleCurrency(active) ? active.toUpperCase() : undefined;
}

export function cloneCandidate(
  candidate: WinningHunterProductCandidate,
): WinningHunterProductCandidate {
  return {
    ...candidate,
    adSignals: candidate.adSignals.map((signal) => ({
      ...signal,
      countries: [...signal.countries],
      rankHistory: { ...signal.rankHistory },
    })),
  };
}

function mapAdSignal(row: RawWinningHunterProductRow): WinningHunterAdSignal {
  const externalAdId =
    stringValue(row.id) ??
    stringValue(row.page_id) ??
    stringValue(row.productid) ??
    createStableHash(JSON.stringify(row));

  return {
    externalAdId,
    ...optionalText("pageId", row.page_id),
    ...optionalText("pageName", row.pageName),
    countries: parseCountries(row.countries),
    ...optionalText("startedAt", row.started),
    ...optionalText("lastSeenAt", row.lastSeen),
    ...optionalText("updatedAt", row.updated_at),
    ...optionalText("mediaType", row.display_format),
    ...optionalText("caption", row.caption),
    ...optionalText("adCopy", row.copy),
    ...optionalNumber("activeSeenCount", row.activeSeen, { allowZero: true }),
    ...optionalNumber("adRank", row.ad_rank, { allowZero: true }),
    rankHistory: parseRankHistory(row.rank_history),
    ...optionalNumber("euAdSpend", row.total_eu_adspend, { allowZero: true }),
    ...optionalNumber("euViews", row.total_eu_views, { allowZero: true }),
  };
}

function parseCountries(value: RawWinningHunterScalar): readonly string[] {
  if (Array.isArray(value)) {
    return value
      .map((country) => stringValueFromUnknown(country))
      .filter((country): country is string => country !== undefined);
  }

  return (
    stringValue(value)
      ?.split(",")
      .map((country) => country.trim())
      .filter((country) => country.length > 0) ?? []
  );
}

function parseRankHistory(value: RawWinningHunterScalar): Readonly<Record<string, number>> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => [key, parseRankHistoryNumber(rawValue)])
      .filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}

function optionalText<Key extends string>(
  key: Key,
  value: RawWinningHunterScalar,
): Partial<Record<Key, string>> {
  const parsed = stringValue(value);

  return parsed === undefined ? {} : ({ [key]: parsed } as Partial<Record<Key, string>>);
}

function optionalNumber<Key extends string>(
  key: Key,
  value: RawWinningHunterScalar,
  options?: { readonly allowZero?: boolean; readonly allowNegative?: boolean },
): Partial<Record<Key, number>> {
  const parsed = parseWinningHunterNumber(value, options);

  return parsed === undefined ? {} : ({ [key]: parsed } as Partial<Record<Key, number>>);
}

function optionalCurrency(value: RawWinningHunterScalar): { readonly currency?: string } {
  const currency = extractWinningHunterCurrency(value);

  return currency === undefined ? {} : { currency };
}

function normalizeOptionalUrl(
  value: RawWinningHunterScalar,
): { readonly url: string; readonly domain: string } | undefined {
  const parsed = stringValue(value);

  if (parsed === undefined) {
    return undefined;
  }

  try {
    return normalizeWinningHunterUrl(parsed);
  } catch {
    return undefined;
  }
}

function latestIsoDate(values: readonly RawWinningHunterScalar[]): string | undefined {
  return values
    .map((value) => stringValue(value))
    .filter((value): value is string => value !== undefined)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function stringValue(value: RawWinningHunterScalar): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length === 0 ? undefined : trimmed;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function stringValueFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? stringValue(value) : undefined;
}

function isIsoStyleCurrency(value: string): boolean {
  return /^[a-z]{3}$/iu.test(value.trim());
}

function parseRankHistoryNumber(value: unknown): number | undefined {
  return typeof value === "string" || typeof value === "number"
    ? parseWinningHunterNumber(value)
    : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
