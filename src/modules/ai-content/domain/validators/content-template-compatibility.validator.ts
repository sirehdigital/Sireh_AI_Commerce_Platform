import { InvalidContentTemplateError } from "../errors/content-domain.errors.js";
import type { ContentChannel, ContentTemplateSnapshot, ContentType } from "../types/content.types.js";

export class ContentTemplateCompatibilityValidator {
  public assertCompatible(
    template: ContentTemplateSnapshot,
    type: ContentType,
    channel: ContentChannel,
  ): void {
    if (!template.active) {
      throw new InvalidContentTemplateError("Content template is inactive.", {
        templateId: template.id,
      });
    }

    if (template.contentType !== type || template.channel !== channel) {
      throw new InvalidContentTemplateError("Content template does not match content type and channel.", {
        templateId: template.id,
        templateType: template.contentType,
        templateChannel: template.channel,
        type,
        channel,
      });
    }
  }
}
