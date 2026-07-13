import type {
  ContentAudience,
  ContentChannel,
  ContentId,
  ContentLanguage,
  ContentMetadata,
  ContentScore,
  ContentSEO,
  ContentSnapshot,
  ContentStatus,
  ContentTemplateId,
  ContentType,
  ContentTone,
} from "../types/content.types.js";
import { ContentAggregateValidator } from "../validators/content-aggregate.validator.js";
import { ContentStatusTransitionValidator } from "../validators/content-status-transition.validator.js";
import type { CTA } from "../value-objects/cta.value-object.js";
import { ContentLength } from "../value-objects/content-length.value-object.js";
import type { Headline } from "../value-objects/headline.value-object.js";
import type { ReadingTime } from "../value-objects/reading-time.value-object.js";

export interface ContentCreateInput {
  readonly id: ContentId;
  readonly type: ContentType;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly headline: Headline;
  readonly body?: string;
  readonly structuredContent?: Readonly<Record<string, string>>;
  readonly audience?: ContentAudience;
  readonly cta?: CTA;
  readonly seo?: ContentSEO;
  readonly score?: ContentScore;
  readonly templateId?: ContentTemplateId;
  readonly metadata?: Partial<ContentMetadata>;
  readonly readingTime?: ReadingTime;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export class Content {
  private static readonly aggregateValidator = new ContentAggregateValidator();
  private static readonly transitionValidator = new ContentStatusTransitionValidator();

  private state: ContentSnapshot;

  private constructor(state: ContentSnapshot) {
    Content.aggregateValidator.assertValid(state);
    this.state = state;
  }

  public static create(input: ContentCreateInput): Content {
    const now = input.createdAt ?? new Date();
    const body = input.body ?? "";
    const structuredContent = { ...(input.structuredContent ?? {}) };
    const metadata = buildMetadata(input.metadata);
    const state: ContentSnapshot = {
      id: input.id.trim(),
      type: input.type,
      status: "draft",
      channel: input.channel,
      language: input.language,
      tone: input.tone,
      headline: input.headline,
      body,
      structuredContent,
      metadata,
      contentLength: ContentLength.fromText([body, ...Object.values(structuredContent)].join(" ")),
      revision: metadata.contentVersion,
      createdAt: new Date(now),
      updatedAt: new Date(input.updatedAt ?? now),
      ...(input.audience === undefined ? {} : { audience: input.audience }),
      ...(input.cta === undefined ? {} : { cta: input.cta }),
      ...(input.seo === undefined ? {} : { seo: input.seo }),
      ...(input.score === undefined ? {} : { score: input.score }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...(input.readingTime === undefined ? {} : { readingTime: input.readingTime }),
    };

    return new Content(state);
  }

  public get id(): ContentId {
    return this.state.id;
  }

  public get status(): ContentStatus {
    return this.state.status;
  }

  public snapshot(): ContentSnapshot {
    return cloneSnapshot(this.state);
  }

  public updateHeadline(headline: Headline): void {
    this.update({ headline });
  }

  public updateBody(body: string): void {
    this.update({ body });
  }

  public updateStructuredContent(structuredContent: Readonly<Record<string, string>>): void {
    this.update({ structuredContent: { ...structuredContent } });
  }

  public assignCTA(cta: CTA): void {
    this.update({ cta });
  }

  public removeCTA(): void {
    this.commit(withoutCTA(this.state));
  }

  public assignSEO(seo: ContentSEO): void {
    this.update({ seo });
  }

  public assignAudience(audience: ContentAudience): void {
    this.update({ audience });
  }

  public assignTemplate(templateId: ContentTemplateId): void {
    this.update({ templateId });
  }

  public changeTone(tone: ContentTone): void {
    this.update({ tone });
  }

  public changeLanguage(language: ContentLanguage): void {
    this.update({ language });
  }

  public changeChannel(channel: ContentChannel): void {
    this.update({ channel });
  }

  public assignScore(score: ContentScore): void {
    this.update({ score });
  }

  public updateMetadata(metadata: Partial<ContentMetadata>): void {
    this.update({
      metadata: buildMetadata({
        ...this.state.metadata,
        ...metadata,
        tags: metadata.tags ?? this.state.metadata.tags,
        custom: {
          ...this.state.metadata.custom,
          ...(metadata.custom ?? {}),
        },
      }),
    });
  }

  public markGenerated(): void {
    this.transitionTo("generated");
  }

  public markReviewed(): void {
    this.transitionTo("reviewed");
  }

  public approve(): void {
    this.transitionTo("approved");
  }

  public reject(): void {
    this.transitionTo("rejected");
  }

  public returnToDraftForRework(): void {
    this.transitionTo("draft");
  }

  public publish(): void {
    this.transitionTo("published");
  }

  public archive(): void {
    this.transitionTo("archived");
  }

  private transitionTo(status: ContentStatus): void {
    Content.transitionValidator.assertCanTransition(this.state.status, status);
    this.update({ status }, false);
  }

  private update(patch: Partial<ContentSnapshot>, incrementRevision = true): void {
    this.commit({ ...cloneSnapshot(this.state), ...patch }, incrementRevision);
  }

  private commit(next: ContentSnapshot, incrementRevision = true): void {
    const revision = incrementRevision ? this.state.revision + 1 : this.state.revision;
    const metadata = buildMetadata({
      ...next.metadata,
      contentVersion: revision,
    });
    const bodyParts = [next.body, ...Object.values(next.structuredContent)];
    const committed = {
      ...next,
      metadata,
      revision,
      contentLength: ContentLength.fromText(bodyParts.join(" ")),
      updatedAt: new Date(),
    };

    Content.aggregateValidator.assertValid(committed);
    this.state = committed;
  }
}

function buildMetadata(metadata: Partial<ContentMetadata> = {}): ContentMetadata {
  const contentVersion = metadata.contentVersion ?? 1;

  return {
    tags: [...(metadata.tags ?? [])],
    contentVersion,
    custom: { ...(metadata.custom ?? {}) },
    ...(metadata.sourceProductId === undefined ? {} : { sourceProductId: metadata.sourceProductId }),
    ...(metadata.sourceMarketingAnalysisId === undefined
      ? {}
      : { sourceMarketingAnalysisId: metadata.sourceMarketingAnalysisId }),
    ...(metadata.campaignId === undefined ? {} : { campaignId: metadata.campaignId }),
    ...(metadata.brandId === undefined ? {} : { brandId: metadata.brandId }),
    ...(metadata.templateId === undefined ? {} : { templateId: metadata.templateId }),
    ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
    ...(metadata.createdBy === undefined ? {} : { createdBy: metadata.createdBy }),
    ...(metadata.reviewedBy === undefined ? {} : { reviewedBy: metadata.reviewedBy }),
    ...(metadata.publicationReference === undefined
      ? {}
      : { publicationReference: metadata.publicationReference }),
  };
}

function cloneSnapshot(snapshot: ContentSnapshot): ContentSnapshot {
  return {
    ...snapshot,
    structuredContent: { ...snapshot.structuredContent },
    metadata: {
      ...snapshot.metadata,
      tags: [...snapshot.metadata.tags],
      custom: { ...snapshot.metadata.custom },
    },
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
    ...(snapshot.audience === undefined ? {} : { audience: cloneAudience(snapshot.audience) }),
    ...(snapshot.seo === undefined
      ? {}
      : { seo: { ...snapshot.seo, secondaryKeywords: [...snapshot.seo.secondaryKeywords] } }),
    ...(snapshot.score === undefined
      ? {}
      : { score: { ...snapshot.score, evaluationNotes: [...snapshot.score.evaluationNotes] } }),
  };
}

function cloneAudience(audience: ContentAudience): ContentAudience {
  return {
    ...audience,
    ...(audience.notes === undefined ? {} : { notes: [...audience.notes] }),
  };
}

function withoutCTA(snapshot: ContentSnapshot): ContentSnapshot {
  const { cta: removedCta, ...rest } = cloneSnapshot(snapshot);
  void removedCta;

  return rest;
}
