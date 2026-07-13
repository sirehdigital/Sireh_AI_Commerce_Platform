import { Content, type ContentCreateInput } from "../aggregates/content.aggregate.js";
import { Headline } from "../value-objects/headline.value-object.js";

export interface ContentFactoryInput extends Omit<ContentCreateInput, "headline"> {
  readonly headline: string;
}

export class ContentFactory {
  public create(input: ContentFactoryInput): Content {
    return Content.create({
      ...input,
      headline: Headline.create(input.headline),
    });
  }
}
