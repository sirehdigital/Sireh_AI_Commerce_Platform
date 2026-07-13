/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Product Writer Types
 * Sprint: SAI-03A.01
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

export interface ProductWriterInput {
  productName: string;
  productType?: string;
  targetMarket?: string;
  tone?: "premium" | "friendly" | "professional" | "luxury" | "simple";
  language?: "en" | "ms";
  keywords?: string[];
}

export interface ProductWriterOutput {
  title: string;
  shortDescription: string;
  longDescription: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  benefits: string[];
  callToAction: string;
}

export interface ProductWriterService {
  generateProductCopy(input: ProductWriterInput): Promise<ProductWriterOutput>;
}
