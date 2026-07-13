import type { Content } from "../../domain/index.js";
import type { LocalizedContentPackage } from "../dto/content-localization.types.js";

export class LocalizedContentToDomainMapper {
  public map(contentPackage: LocalizedContentPackage): readonly Content[] {
    return contentPackage.contents;
  }
}
