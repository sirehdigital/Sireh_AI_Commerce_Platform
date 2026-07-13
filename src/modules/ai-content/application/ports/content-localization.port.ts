import type {
  ContentLocalizationInput,
  ContentLocalizationOptions,
  LocalizedContentPackage,
} from "../dto/content-localization.types.js";

export interface ContentLocalizationPort {
  localize(input: ContentLocalizationInput, options: ContentLocalizationOptions): LocalizedContentPackage;
}
