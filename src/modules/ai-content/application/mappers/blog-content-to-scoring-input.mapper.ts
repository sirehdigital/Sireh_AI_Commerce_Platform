import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { BlogContentPackage } from "../dto/blog-content.types.js";

export class BlogContentToScoringInputMapper {
  public map(contentPackage: BlogContentPackage): ContentQualityScoringInput {
    return {
      contentId: `score:${contentPackage.productId}:blog-content`,
      contentType: "blog-article",
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: contentPackage.tone,
      ...audience(contentPackage),
      headline: contentPackage.recommendedTitle,
      body: [
        contentPackage.articleSummary,
        contentPackage.introduction,
        ...contentPackage.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
        ...contentPackage.faqSection.flatMap((item) => [item.question, item.answer]),
        contentPackage.conclusion,
      ].join("\n\n"),
      structuredContent: {
        outline: contentPackage.outline.map((item) => `${item.order}. ${item.heading}`).join("\n"),
        faq: contentPackage.faqSection.map((item) => `${item.question}: ${item.answer}`).join("\n"),
      },
      cta: contentPackage.primaryCTA,
      searchIntent: contentPackage.searchIntent,
      sourceMetadata: contentPackage.sourceMetadata,
      campaignMetadata: { objective: contentPackage.objective },
      correlationMetadata: {},
      blogContentPackage: contentPackage,
    };
  }
}

function audience(contentPackage: BlogContentPackage): Pick<ContentQualityScoringInput, "audience"> | Record<string, never> {
  if (contentPackage.targetAudience === undefined) {
    return {};
  }
  return {
    audience: {
      ...(contentPackage.targetAudience.description === undefined ? {} : { description: contentPackage.targetAudience.description }),
      ...(contentPackage.targetAudience.customerSegment === undefined
        ? {}
        : { segmentReference: contentPackage.targetAudience.customerSegment }),
    },
  };
}
