import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogOutlineItem,
} from "../dto/blog-content.types.js";

export class BlogOutlineFactory {
  public create(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): readonly BlogOutlineItem[] {
    const topics = structureFor(options.articleType, options.language);
    const selectedTopics = topics.slice(0, options.sectionCount);
    const allocation = allocateWords(options.targetWordCount, selectedTopics.length);

    return selectedTopics.map((topic, index) => ({
      order: index + 1,
      heading: topic.heading,
      purpose: topic.purpose,
      targetWordAllocation: allocation[index] ?? 120,
      primaryTopic: topic.topic,
      supportingFacts: supportingFacts(input, topic.topic),
      productRelevance: productRelevance(input, topic.topic),
      ctaMarker: index === selectedTopics.length - 1,
    }));
  }
}

interface Topic {
  readonly heading: string;
  readonly purpose: string;
  readonly topic: string;
}

function structureFor(articleType: BlogContentGenerationOptions["articleType"], language: string): readonly Topic[] {
  const ms = language === "ms";
  const common: readonly Topic[] = [
    topic(ms ? "Gambaran produk" : "Product overview", ms ? "Frame the source product facts." : "Frame the source product facts.", "overview"),
    topic(ms ? "Manfaat utama" : "Key benefits", ms ? "Explain grounded benefits." : "Explain grounded benefits.", "benefits"),
    topic(ms ? "Ciri penting" : "Important features", ms ? "Connect features to buyer needs." : "Connect features to buyer needs.", "features"),
    topic(ms ? "Sesuai untuk siapa" : "Who it is for", ms ? "Clarify audience fit." : "Clarify audience fit.", "audience"),
    topic(ms ? "Pertimbangan sebelum membeli" : "Considerations before buying", ms ? "Surface limitations and risk notes." : "Surface limitations and risk notes.", "considerations"),
    topic(ms ? "Soalan lazim" : "Common questions", ms ? "Answer grounded questions." : "Answer grounded questions.", "faq"),
    topic(ms ? "Langkah seterusnya" : "Next step", ms ? "Guide a low-pressure action." : "Guide a low-pressure action.", "cta"),
  ];

  if (articleType === "how-to-article") {
    return [
      topic(ms ? "Persediaan" : "Preparation", "Clarify safe source-based preparation.", "preparation"),
      topic(ms ? "Langkah berpandu" : "Step-by-step guidance", "Use only supplied usage guidance.", "usage"),
      ...common.slice(1),
    ];
  }
  if (articleType === "buying-guide" || articleType === "product-comparison-framework") {
    return [
      topic(ms ? "Kriteria pembelian" : "Buying criteria", "Set practical decision criteria.", "criteria"),
      topic(ms ? "Pertimbangan ciri" : "Feature considerations", "Explain relevant features.", "features"),
      topic(ms ? "Pertimbangan manfaat" : "Benefit considerations", "Explain relevant benefits.", "benefits"),
      ...common.slice(3),
    ];
  }
  if (articleType === "brand-story") {
    return [
      topic(ms ? "Konteks jenama" : "Brand context", "Use supplied brand context only.", "brand"),
      topic(ms ? "Masalah pelanggan" : "Customer problem", "Connect known customer need.", "problem"),
      ...common.slice(0, 5),
    ];
  }
  if (articleType === "faq-article") {
    return common.filter((_, index) => [0, 5, 4, 6].includes(index));
  }
  return common;
}

function topic(heading: string, purpose: string, topicName: string): Topic {
  return { heading, purpose, topic: topicName };
}

function supportingFacts(input: BlogContentGenerationInput, topicName: string): readonly string[] {
  const byTopic: Record<string, readonly string[]> = {
    benefits: input.benefits ?? [],
    features: input.features ?? [],
    usage: input.usageGuidance ?? [],
    considerations: input.productRisks ?? [],
    brand: [input.brand ?? ""].filter(Boolean),
  };
  const facts = byTopic[topicName] ?? [input.productDescription ?? input.productTitle];
  return facts.slice(0, 4);
}

function productRelevance(input: BlogContentGenerationInput, topicName: string): string {
  return `${input.productTitle} relevance is based on ${topicName} information supplied in the source input.`;
}

function allocateWords(total: number, count: number): readonly number[] {
  const safeCount = Math.max(1, count);
  const base = Math.max(80, Math.floor(total / safeCount));
  const allocation = Array.from({ length: safeCount }, () => base);
  const remainder = Math.max(0, total - base * safeCount);
  return allocation.map((value, index) => value + (index === 0 ? remainder : 0));
}
