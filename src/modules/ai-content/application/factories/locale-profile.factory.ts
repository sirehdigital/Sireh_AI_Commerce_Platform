import type { LocaleProfile, SupportedLocale } from "../dto/content-localization.types.js";
import { UnsupportedSourceLocaleError, UnsupportedTargetLocaleError } from "../errors/product-content.errors.js";

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "en-US", "en-GB", "en-AU", "en-CA", "ms", "ms-MY"];

const PROFILES: Record<SupportedLocale, LocaleProfile> = {
  en: profile("en", "en", "Global", {}, { cart: "cart" }, {}),
  "en-US": profile("en-US", "en", "United States", { colour: "color", favourite: "favorite", centre: "center" }, { basket: "cart" }, {}),
  "en-GB": profile("en-GB", "en", "United Kingdom", { color: "colour", favorite: "favourite", center: "centre" }, { cart: "basket" }, {}),
  "en-AU": profile("en-AU", "en", "Australia", { color: "colour", favorite: "favourite", center: "centre" }, { basket: "cart" }, {}),
  "en-CA": profile("en-CA", "en", "Canada", { favorite: "favourite", center: "centre" }, { basket: "cart" }, {}),
  ms: profile("ms", "ms", "Malaysia", {}, { cart: "troli", product: "produk", guide: "panduan" }, {
    "Learn more": "Ketahui lebih lanjut",
    "View details": "Lihat butiran",
    "Shop now": "Beli sekarang",
    "Read the guide": "Baca panduan",
    "Explore the product": "Terokai produk",
    "Return to your cart": "Kembali ke troli anda",
  }),
  "ms-MY": profile("ms-MY", "ms", "Malaysia", {}, { cart: "troli", product: "produk", guide: "panduan" }, {
    "Learn more": "Ketahui lebih lanjut",
    "View details": "Lihat butiran",
    "Shop now": "Beli sekarang",
    "Read the guide": "Baca panduan",
    "Explore the product": "Terokai produk",
    "Return to your cart": "Kembali ke troli anda",
  }),
};

export class LocaleProfileFactory {
  public source(locale: string): LocaleProfile {
    const normalized = normalizeLocale(locale);
    if (normalized === undefined) {
      throw new UnsupportedSourceLocaleError(locale);
    }
    return PROFILES[normalized];
  }

  public target(locale: string): LocaleProfile {
    const normalized = normalizeLocale(locale);
    if (normalized === undefined) {
      throw new UnsupportedTargetLocaleError(locale);
    }
    return PROFILES[normalized];
  }
}

export function normalizeLocale(locale: string | undefined): SupportedLocale | undefined {
  const normalized = locale?.trim();
  if (normalized === undefined) {
    return undefined;
  }
  const exact = SUPPORTED_LOCALES.find((supported) => supported.toLowerCase() === normalized.toLowerCase());
  return exact;
}

function profile(
  locale: SupportedLocale,
  language: LocaleProfile["language"],
  region: string,
  spellingVariants: Readonly<Record<string, string>>,
  commerceTerms: Readonly<Record<string, string>>,
  ctaPhrases: Readonly<Record<string, string>>,
): LocaleProfile {
  return {
    locale,
    language,
    region,
    spellingVariants,
    commerceTerms,
    ctaPhrases,
    seoFillerWords: language === "ms" ? ["dan", "untuk", "dengan"] : ["and", "for", "with"],
    formalityGuidance: language === "ms" ? "Use natural Malaysian Malay commerce wording." : "Preserve the source tone with regional spelling.",
    dateFormatGuidance: region === "United States" ? "MM/DD/YYYY" : "DD/MM/YYYY",
    numberFormatGuidance: "Preserve numeric values; adapt separators only as guidance.",
    currencyFormatGuidance: "Do not convert currency without explicit verified data.",
  };
}
