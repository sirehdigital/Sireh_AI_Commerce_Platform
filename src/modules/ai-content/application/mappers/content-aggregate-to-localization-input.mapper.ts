import type { Content } from "../../domain/index.js";
import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import { ContentLocalizationInputFactory } from "../factories/content-localization-input.factory.js";

export class ContentAggregateToLocalizationInputMapper {
  public constructor(private readonly inputFactory = new ContentLocalizationInputFactory()) {}

  public map(content: Content, targetLocale: SupportedLocale): ContentLocalizationInput {
    return this.inputFactory.fromContent(content, targetLocale);
  }
}
