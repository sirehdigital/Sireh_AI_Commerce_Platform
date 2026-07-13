import { InvalidContentTemplateError } from "../errors/content-domain.errors.js";
import type {
  ContentChannel,
  ContentSectionDefinition,
  ContentTemplateId,
  ContentTemplateSnapshot,
  ContentType,
} from "../types/content.types.js";

export interface ContentTemplateCreateInput {
  readonly id: ContentTemplateId;
  readonly name: string;
  readonly contentType: ContentType;
  readonly channel: ContentChannel;
  readonly sections?: readonly ContentSectionDefinition[];
  readonly requiredVariables?: readonly string[];
  readonly optionalVariables?: readonly string[];
  readonly version?: number;
  readonly active?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class ContentTemplate {
  private constructor(private readonly state: ContentTemplateSnapshot) {}

  public static create(input: ContentTemplateCreateInput): ContentTemplate {
    const id = input.id.trim();
    const name = input.name.trim();
    const version = input.version ?? 1;

    if (id.length === 0) {
      throw new InvalidContentTemplateError("Content template ID is required.");
    }

    if (name.length === 0) {
      throw new InvalidContentTemplateError("Content template name is required.");
    }

    if (!Number.isInteger(version) || version < 1) {
      throw new InvalidContentTemplateError("Content template version must be a positive integer.");
    }

    return new ContentTemplate({
      id,
      name,
      contentType: input.contentType,
      channel: input.channel,
      sections: [...(input.sections ?? [])],
      requiredVariables: dedupe(input.requiredVariables ?? []),
      optionalVariables: dedupe(input.optionalVariables ?? []),
      version,
      active: input.active ?? true,
      metadata: { ...(input.metadata ?? {}) },
    });
  }

  public snapshot(): ContentTemplateSnapshot {
    return {
      ...this.state,
      sections: [...this.state.sections],
      requiredVariables: [...this.state.requiredVariables],
      optionalVariables: [...this.state.optionalVariables],
      metadata: { ...this.state.metadata },
    };
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
