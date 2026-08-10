import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";
import { CreativePolicyRiskEvaluator } from "../policy/creative-policy-risk-evaluator.js";
import { CreativeRecommendationEngine } from "../recommendations/creative-recommendation-engine.js";
import { PlatformSuitabilityEvaluator } from "../suitability/platform-suitability-evaluator.js";
import {
  CREATIVE_ANALYSIS_DIMENSIONS,
  CREATIVE_ANALYSIS_VERSION,
  CREATIVE_SCORE_LABEL,
  type CreativeAnalysisDimension,
  type CreativeAnalysisFinding,
  type CreativeAnalysisResult,
  type CreativeDimensionAnalysis,
  type CreativeFindingImpact,
  type CreativeFindingType,
} from "../../domain/models/creative-analysis.model.js";

export const CREATIVE_DIMENSION_WEIGHTS: Readonly<Record<CreativeAnalysisDimension, number>> = Object.freeze({
  HOOK: 20,
  HEADLINE: 15,
  PRIMARY_TEXT: 20,
  CTA: 15,
  VISUAL_CONCEPT: 15,
  BRAND_CONSISTENCY: 15,
});

const TOTAL_WEIGHT = Object.values(CREATIVE_DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

interface TextSignals {
  readonly present: boolean;
  readonly text: string;
  readonly wordCount: number;
  readonly uniqueWordRatio: number;
  readonly hasRepeatedWords: boolean;
  readonly excessivePunctuation: boolean;
  readonly allUppercaseAbuse: boolean;
  readonly vagueCta: boolean;
  readonly hasActionLanguage: boolean;
}

export class CreativeDimensionAnalyzer {
  private readonly platformSuitabilityEvaluator = new PlatformSuitabilityEvaluator();
  private readonly policyRiskEvaluator = new CreativePolicyRiskEvaluator();
  private readonly recommendationEngine = new CreativeRecommendationEngine();

  public analyze(record: CreativeIntelligenceRecord): CreativeAnalysisResult {
    const dimensions = CREATIVE_ANALYSIS_DIMENSIONS.map((dimension) => this.analyzeDimension(dimension, record));
    const dimensionScores = this.buildDimensionScores(dimensions);
    const overallScore = clampScore(
      Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score * CREATIVE_DIMENSION_WEIGHTS[dimension.dimension], 0) / TOTAL_WEIGHT),
    );

    const findings = dimensions.flatMap((dimension) => dimension.findings);
    const strengths = dimensions.flatMap((dimension) => dimension.strengths);
    const improvementOpportunities = dimensions.flatMap((dimension) => dimension.improvementOpportunities);

    const analysis: CreativeAnalysisResult = {
      creativeIntelligenceId: record.id,
      creativeId: record.creativeId,
      dimensions,
      dimensionScores,
      overallScore,
      findings,
      strengths,
      improvementOpportunities,
      analysisVersion: CREATIVE_ANALYSIS_VERSION,
      metadata: {
        scoringRule: "WEIGHTED_INTEGER_ROUND_HALF_UP",
        scoreLabel: CREATIVE_SCORE_LABEL,
        advisoryOnly: true,
        sourceRecordVersion: record.version,
      },
    };

    const enrichedAnalysis: CreativeAnalysisResult = {
      ...analysis,
      platformSuitability: this.platformSuitabilityEvaluator.evaluate(analysis),
      policyRisk: this.policyRiskEvaluator.evaluate(record),
    };

    return {
      ...enrichedAnalysis,
      recommendations: this.recommendationEngine.recommend(enrichedAnalysis),
    };
  }

  private analyzeDimension(dimension: CreativeAnalysisDimension, record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    switch (dimension) {
      case "HOOK":
        return this.analyzeHook(record);
      case "HEADLINE":
        return this.analyzeHeadline(record);
      case "PRIMARY_TEXT":
        return this.analyzePrimaryText(record);
      case "CTA":
        return this.analyzeCta(record);
      case "VISUAL_CONCEPT":
        return this.analyzeVisualConcept(record);
      case "BRAND_CONSISTENCY":
        return this.analyzeBrandConsistency(record);
    }
  }

  private analyzeHook(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const signals = analyzeText(record.brief.hook);
    const findings: CreativeAnalysisFinding[] = [];
    let score = 40;

    if (!signals.present) {
      return buildDimensionAnalysis("HOOK", 35, [
        finding("HOOK", "WARNING", "HOOK_MISSING", "Hook is not supplied.", "HIGH"),
        finding("HOOK", "IMPROVEMENT", "HOOK_ADD_CLEAR_OPENING", "Add a concise opening idea before downstream analysis.", "MEDIUM"),
      ]);
    }

    score += 30;
    findings.push(finding("HOOK", "STRENGTH", "HOOK_PRESENT", "Hook material is supplied.", "MEDIUM"));

    if (signals.wordCount >= 4 && signals.wordCount <= 12) {
      score += 20;
      findings.push(finding("HOOK", "STRENGTH", "HOOK_USEFUL_LENGTH", "Hook length is within the useful structural range.", "MEDIUM"));
    } else if (signals.wordCount < 4) {
      score -= 15;
      findings.push(finding("HOOK", "IMPROVEMENT", "HOOK_TOO_SHORT", "Hook is very brief and may need more context.", "MEDIUM"));
    } else {
      score -= 10;
      findings.push(finding("HOOK", "IMPROVEMENT", "HOOK_TOO_LONG", "Hook is long for an opening idea.", "LOW"));
    }

    if (signals.hasRepeatedWords || signals.uniqueWordRatio < 0.7) {
      score -= 10;
      findings.push(finding("HOOK", "WARNING", "HOOK_REPETITIVE", "Hook contains obvious repetition.", "MEDIUM"));
    }

    return buildDimensionAnalysis("HOOK", score, findings);
  }

  private analyzeHeadline(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const signals = analyzeText(record.brief.headline);
    const hookSignals = analyzeText(record.brief.hook);
    const findings: CreativeAnalysisFinding[] = [];
    let score = 40;

    if (!signals.present) {
      return buildDimensionAnalysis("HEADLINE", 35, [
        finding("HEADLINE", "WARNING", "HEADLINE_MISSING", "Headline is not supplied.", "HIGH"),
        finding("HEADLINE", "IMPROVEMENT", "HEADLINE_ADD_CLEAR_SUMMARY", "Add a short summary headline for the creative.", "MEDIUM"),
      ]);
    }

    score += 30;
    findings.push(finding("HEADLINE", "STRENGTH", "HEADLINE_PRESENT", "Headline material is supplied.", "MEDIUM"));

    if (signals.wordCount >= 2 && signals.wordCount <= 8) {
      score += 20;
      findings.push(finding("HEADLINE", "STRENGTH", "HEADLINE_USEFUL_LENGTH", "Headline length is structurally useful.", "MEDIUM"));
    } else if (signals.wordCount < 2) {
      score -= 15;
      findings.push(finding("HEADLINE", "IMPROVEMENT", "HEADLINE_TOO_SHORT", "Headline is very brief.", "MEDIUM"));
    } else {
      score -= 10;
      findings.push(finding("HEADLINE", "IMPROVEMENT", "HEADLINE_TOO_LONG", "Headline is long for quick scanning.", "LOW"));
    }

    if (signals.excessivePunctuation) {
      score -= 8;
      findings.push(finding("HEADLINE", "WARNING", "HEADLINE_EXCESSIVE_PUNCTUATION", "Headline uses repeated punctuation.", "LOW"));
    }

    if (signals.allUppercaseAbuse) {
      score -= 8;
      findings.push(finding("HEADLINE", "WARNING", "HEADLINE_ALL_UPPERCASE", "Headline is mostly uppercase.", "LOW"));
    }

    if (hookSignals.present && normalizeComparableText(signals.text) === normalizeComparableText(hookSignals.text)) {
      score -= 10;
      findings.push(finding("HEADLINE", "IMPROVEMENT", "HEADLINE_DUPLICATES_HOOK", "Headline duplicates the hook.", "MEDIUM"));
    }

    return buildDimensionAnalysis("HEADLINE", score, findings);
  }

  private analyzePrimaryText(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const signals = analyzeText(record.brief.primaryText ?? record.brief.description);
    const findings: CreativeAnalysisFinding[] = [];
    let score = 40;

    if (!signals.present) {
      return buildDimensionAnalysis("PRIMARY_TEXT", 35, [
        finding("PRIMARY_TEXT", "WARNING", "PRIMARY_TEXT_MISSING", "Primary text or description is not supplied.", "HIGH"),
        finding("PRIMARY_TEXT", "IMPROVEMENT", "PRIMARY_TEXT_ADD_CONTEXT", "Add supporting copy that explains the creative idea.", "MEDIUM"),
      ]);
    }

    score += 30;
    findings.push(finding("PRIMARY_TEXT", "STRENGTH", "PRIMARY_TEXT_PRESENT", "Primary text material is supplied.", "MEDIUM"));

    if (signals.wordCount >= 8 && signals.wordCount <= 45) {
      score += 20;
      findings.push(finding("PRIMARY_TEXT", "STRENGTH", "PRIMARY_TEXT_USEFUL_LENGTH", "Primary text has useful structural depth.", "MEDIUM"));
    } else if (signals.wordCount < 8) {
      score -= 18;
      findings.push(finding("PRIMARY_TEXT", "IMPROVEMENT", "PRIMARY_TEXT_TOO_SHORT", "Primary text is minimal.", "MEDIUM"));
    } else {
      score -= 10;
      findings.push(finding("PRIMARY_TEXT", "IMPROVEMENT", "PRIMARY_TEXT_TOO_LONG", "Primary text is long for a concise creative brief.", "LOW"));
    }

    if (signals.hasRepeatedWords || signals.uniqueWordRatio < 0.65) {
      score -= 10;
      findings.push(finding("PRIMARY_TEXT", "WARNING", "PRIMARY_TEXT_REPETITIVE", "Primary text contains obvious repetition.", "MEDIUM"));
    }

    if (record.brief.callToAction !== undefined && signals.text.toLowerCase().includes(record.brief.callToAction.toLowerCase())) {
      score += 5;
      findings.push(finding("PRIMARY_TEXT", "STRENGTH", "PRIMARY_TEXT_SUPPORTS_CTA", "Primary text references the supplied call to action.", "LOW"));
    }

    return buildDimensionAnalysis("PRIMARY_TEXT", score, findings);
  }

  private analyzeCta(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const signals = analyzeText(record.brief.callToAction);
    const findings: CreativeAnalysisFinding[] = [];
    let score = 40;

    if (!signals.present) {
      return buildDimensionAnalysis("CTA", 30, [
        finding("CTA", "WARNING", "CTA_MISSING", "Call to action is not supplied.", "HIGH"),
        finding("CTA", "IMPROVEMENT", "CTA_ADD_ACTION", "Add a clear next-step action.", "MEDIUM"),
      ]);
    }

    score += 30;
    findings.push(finding("CTA", "STRENGTH", "CTA_PRESENT", "Call to action is supplied.", "MEDIUM"));

    if (signals.hasActionLanguage) {
      score += 20;
      findings.push(finding("CTA", "STRENGTH", "CTA_ACTION_LANGUAGE", "Call to action uses clear action language.", "MEDIUM"));
    } else {
      score -= 12;
      findings.push(finding("CTA", "IMPROVEMENT", "CTA_ACTION_LANGUAGE_WEAK", "Call to action could use clearer action language.", "MEDIUM"));
    }

    if (signals.vagueCta) {
      score -= 10;
      findings.push(finding("CTA", "IMPROVEMENT", "CTA_TOO_VAGUE", "Call to action is structurally vague.", "LOW"));
    }

    if (signals.wordCount > 5) {
      score -= 8;
      findings.push(finding("CTA", "IMPROVEMENT", "CTA_TOO_LONG", "Call to action is long for a direct next step.", "LOW"));
    }

    return buildDimensionAnalysis("CTA", score, findings);
  }

  private analyzeVisualConcept(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const signals = analyzeText(record.brief.visualConcept);
    const findings: CreativeAnalysisFinding[] = [];
    let score = 40;

    if (!signals.present) {
      return buildDimensionAnalysis("VISUAL_CONCEPT", 35, [
        finding("VISUAL_CONCEPT", "WARNING", "VISUAL_CONCEPT_MISSING", "Visual concept metadata is not supplied.", "HIGH"),
        finding("VISUAL_CONCEPT", "IMPROVEMENT", "VISUAL_CONCEPT_ADD_EXECUTION_DETAIL", "Add descriptive execution detail for future creative production.", "MEDIUM"),
      ]);
    }

    score += 30;
    findings.push(finding("VISUAL_CONCEPT", "STRENGTH", "VISUAL_CONCEPT_PRESENT", "Visual concept metadata is supplied.", "MEDIUM"));

    if (signals.wordCount >= 6 && signals.wordCount <= 30) {
      score += 20;
      findings.push(finding("VISUAL_CONCEPT", "STRENGTH", "VISUAL_CONCEPT_DESCRIPTIVE", "Visual concept has useful descriptive detail.", "MEDIUM"));
    } else if (signals.wordCount < 6) {
      score -= 15;
      findings.push(finding("VISUAL_CONCEPT", "IMPROVEMENT", "VISUAL_CONCEPT_TOO_THIN", "Visual concept is very brief.", "MEDIUM"));
    } else {
      score -= 8;
      findings.push(finding("VISUAL_CONCEPT", "IMPROVEMENT", "VISUAL_CONCEPT_TOO_LONG", "Visual concept is long for compact execution metadata.", "LOW"));
    }

    return buildDimensionAnalysis("VISUAL_CONCEPT", score, findings);
  }

  private analyzeBrandConsistency(record: CreativeIntelligenceRecord): CreativeDimensionAnalysis {
    const hasBrandName = record.brandName !== undefined;
    const hasBrandTone = record.brandTone !== undefined;
    const briefText = [record.brief.hook, record.brief.headline, record.brief.primaryText, record.brief.description, record.brief.callToAction, record.brief.visualConcept]
      .filter((value): value is string => value !== undefined)
      .join(" ");
    const findings: CreativeAnalysisFinding[] = [];
    let score = 55;

    if (!hasBrandName && !hasBrandTone) {
      return buildDimensionAnalysis("BRAND_CONSISTENCY", 55, [
        finding("BRAND_CONSISTENCY", "WARNING", "BRAND_CONTEXT_LIMITED", "Brand context is limited; neutral foundation score applied.", "MEDIUM"),
        finding("BRAND_CONSISTENCY", "IMPROVEMENT", "BRAND_CONTEXT_ADD_NAME_OR_TONE", "Add brand name or tone for stronger consistency analysis.", "LOW"),
      ]);
    }

    if (hasBrandName) {
      score += 15;
      findings.push(finding("BRAND_CONSISTENCY", "STRENGTH", "BRAND_NAME_PRESENT", "Brand name is available for analysis context.", "MEDIUM"));
    }

    if (hasBrandTone) {
      score += 15;
      findings.push(finding("BRAND_CONSISTENCY", "STRENGTH", "BRAND_TONE_PRESENT", "Brand tone is available for analysis context.", "MEDIUM"));
    }

    if (hasBrandName && briefText.toLowerCase().includes(record.brandName.toLowerCase())) {
      score += 5;
      findings.push(finding("BRAND_CONSISTENCY", "STRENGTH", "BRAND_NAME_REFERENCED", "Brief references the supplied brand name.", "LOW"));
    }

    if (hasBrandTone && wordSet(record.brandTone).some((word) => word.length >= 5 && wordSet(briefText).includes(word))) {
      score += 5;
      findings.push(finding("BRAND_CONSISTENCY", "STRENGTH", "BRAND_TONE_EVIDENCE_PRESENT", "Brief contains wording that overlaps with supplied brand tone.", "LOW"));
    } else if (hasBrandTone) {
      findings.push(finding("BRAND_CONSISTENCY", "IMPROVEMENT", "BRAND_TONE_EVIDENCE_LIMITED", "Brief has limited explicit evidence of the supplied brand tone.", "LOW"));
    }

    return buildDimensionAnalysis("BRAND_CONSISTENCY", score, findings);
  }

  private buildDimensionScores(dimensions: readonly CreativeDimensionAnalysis[]): Readonly<Record<CreativeAnalysisDimension, number>> {
    return Object.freeze(
      dimensions.reduce(
        (scores, dimension) => ({
          ...scores,
          [dimension.dimension]: dimension.score,
        }),
        {} as Record<CreativeAnalysisDimension, number>,
      ),
    );
  }
}

function buildDimensionAnalysis(dimension: CreativeAnalysisDimension, score: number, findings: readonly CreativeAnalysisFinding[]): CreativeDimensionAnalysis {
  return {
    dimension,
    score: clampScore(score),
    findings: [...findings],
    strengths: findings.filter((findingEntry) => findingEntry.type === "STRENGTH").map((findingEntry) => findingEntry.message),
    improvementOpportunities: findings.filter((findingEntry) => findingEntry.type === "IMPROVEMENT").map((findingEntry) => findingEntry.message),
  };
}

function finding(
  dimension: CreativeAnalysisDimension,
  type: CreativeFindingType,
  code: string,
  message: string,
  impact: CreativeFindingImpact,
): CreativeAnalysisFinding {
  return { dimension, type, code, message, impact };
}

function analyzeText(value: string | undefined): TextSignals {
  const text = value?.trim() ?? "";
  const words = wordSet(text);
  const uniqueWords = new Set(words);

  return {
    present: text.length > 0,
    text,
    wordCount: words.length,
    uniqueWordRatio: words.length === 0 ? 1 : uniqueWords.size / words.length,
    hasRepeatedWords: hasAdjacentRepeatedWords(words),
    excessivePunctuation: /[!?]{2,}/u.test(text),
    allUppercaseAbuse: hasAllUppercaseAbuse(text),
    vagueCta: /^(learn more|click here|more|details|submit)$/iu.test(text),
    hasActionLanguage: /\b(shop|buy|explore|discover|get|start|try|learn|book|join|claim|view|see|order)\b/iu.test(text),
  };
}

function wordSet(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length > 0);
}

function hasAdjacentRepeatedWords(words: readonly string[]): boolean {
  return words.some((word, index) => index > 0 && word === words[index - 1]);
}

function hasAllUppercaseAbuse(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/gu, "");
  return letters.length >= 6 && letters === letters.toUpperCase();
}

function normalizeComparableText(text: string): string {
  return wordSet(text).join(" ");
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
