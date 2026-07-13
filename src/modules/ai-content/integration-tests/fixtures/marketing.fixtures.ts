import type { SupportedLocale } from "../../application/dto/content-localization.types.js";
import type { ContentChannel } from "../../domain/index.js";

export const marketingFixture = {
  targetAudience: "Beauty enthusiasts seeking a simple daily routine",
  customerPersona: "Routine-focused beauty shopper",
  customerSegment: "Practical personal-care buyers",
  marketingAngle: "Simple Daily Routine",
  valueProposition: "A practical silicone brush for a consistent cleansing routine",
  campaignObjective: "conversion",
  customerJourneyStage: "consideration",
  brandPositioning: "Practical, transparent and routine-focused",
  targetMarkets: ["US", "UK", "AU", "CA", "MY"],
} as const;

export const localeFixtures: readonly SupportedLocale[] = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-CA",
  "ms-MY",
];

export const channelFixtures: readonly (
  ContentChannel | "facebook" | "instagram" | "tiktok" | "linkedin" | "x" | "youtube"
)[] = [
  "shopify",
  "website",
  "blog",
  "email",
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
  "generic",
];
