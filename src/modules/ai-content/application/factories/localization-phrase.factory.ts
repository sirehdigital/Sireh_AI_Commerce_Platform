import type { LocaleProfile } from "../dto/content-localization.types.js";

const EN_TO_MS: readonly [RegExp, string][] = [
  [/\bproduct guide\b/giu, "panduan produk"],
  [/\bproduct\b/giu, "produk"],
  [/\bbenefits\b/giu, "manfaat"],
  [/\bbenefit\b/giu, "manfaat"],
  [/\bfeatures\b/giu, "ciri"],
  [/\bfeature\b/giu, "ciri"],
  [/\bclear\b/giu, "jelas"],
  [/\bguide\b/giu, "panduan"],
  [/\blearn more\b/giu, "ketahui lebih lanjut"],
  [/\bview details\b/giu, "lihat butiran"],
  [/\bshop now\b/giu, "beli sekarang"],
  [/\bread the guide\b/giu, "baca panduan"],
  [/\breturn to your cart\b/giu, "kembali ke troli anda"],
  [/\bcart\b/giu, "troli"],
  [/\bcustomers\b/giu, "pelanggan"],
  [/\bcustomer\b/giu, "pelanggan"],
  [/\bsource-backed\b/giu, "disokong sumber"],
  [/\buse\b/giu, "gunakan"],
  [/\breview\b/giu, "semak"],
];

const MS_TO_EN: readonly [RegExp, string][] = [
  [/\bpanduan produk\b/giu, "product guide"],
  [/\bproduk\b/giu, "product"],
  [/\bmanfaat\b/giu, "benefit"],
  [/\bciri\b/giu, "feature"],
  [/\bjelas\b/giu, "clear"],
  [/\bpanduan\b/giu, "guide"],
  [/\bketahui lebih lanjut\b/giu, "learn more"],
  [/\blihat butiran\b/giu, "view details"],
  [/\bbeli sekarang\b/giu, "shop now"],
  [/\bbaca panduan\b/giu, "read the guide"],
  [/\bkembali ke troli anda\b/giu, "return to your cart"],
  [/\btroli\b/giu, "cart"],
  [/\bpelanggan\b/giu, "customer"],
  [/\bdisokong sumber\b/giu, "source-backed"],
  [/\bgunakan\b/giu, "use"],
  [/\bsemak\b/giu, "review"],
];

export class LocalizationPhraseFactory {
  public localizeText(
    value: string,
    source: LocaleProfile,
    target: LocaleProfile,
    protectedTerms: readonly string[],
    adaptSpelling = true,
  ): string {
    const protectedMap = protect(value, protectedTerms);
    let localized = protectedMap.text;
    const dictionary = source.language === "en" && target.language === "ms" ? EN_TO_MS : source.language === "ms" && target.language === "en" ? MS_TO_EN : [];
    dictionary.forEach(([pattern, replacement]) => {
      localized = localized.replace(pattern, (matched) => preserveCase(matched, replacement));
    });
    if (adaptSpelling) {
      localized = this.applyRegionalSpelling(localized, target);
    }
    return restore(localized, protectedMap.tokens);
  }

  public localizeCTA(value: string, source: LocaleProfile, target: LocaleProfile, protectedTerms: readonly string[]): string {
    const mapped = target.ctaPhrases[value] ?? this.localizeText(value, source, target, protectedTerms);
    return mapped;
  }

  private applyRegionalSpelling(value: string, target: LocaleProfile): string {
    return Object.entries(target.spellingVariants).reduce(
      (current, [source, replacement]) => current.replace(new RegExp(`\\b${source}\\b`, "giu"), replacement),
      value,
    );
  }
}

function protect(value: string, protectedTerms: readonly string[]): { readonly text: string; readonly tokens: Readonly<Record<string, string>> } {
  const tokens: Record<string, string> = {};
  let text = value;
  protectedTerms.forEach((term, index) => {
    const token = `__SACP_PROTECTED_${index}__`;
    tokens[token] = term;
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(term)}(?![\\p{L}\\p{N}_])`, "gu"), token);
  });
  return { text, tokens };
}

function preserveCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  return /^\p{Lu}/u.test(source) ? `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}` : replacement;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function restore(value: string, tokens: Readonly<Record<string, string>>): string {
  return Object.entries(tokens).reduce((current, [token, term]) => current.split(token).join(term), value);
}
