import {
  ContentTemplate,
  type ContentTemplateCreateInput,
} from "../entities/content-template.entity.js";

export class ContentTemplateFactory {
  public create(input: ContentTemplateCreateInput): ContentTemplate {
    return ContentTemplate.create(input);
  }
}
