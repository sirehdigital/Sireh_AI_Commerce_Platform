import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";
import type { VideoScriptGenerationInput } from "../dto/video-script.types.js";

export class SocialContentToVideoInputMapper {
  public map(socialMediaContentPackage: SocialMediaContentPackage): Partial<VideoScriptGenerationInput> {
    const campaignObjective = objectiveFromSocial(socialMediaContentPackage.objective);
    const campaignId =
      typeof socialMediaContentPackage.sourceMetadata.campaignId === "string"
        ? socialMediaContentPackage.sourceMetadata.campaignId
        : undefined;

    return {
      productId: socialMediaContentPackage.productId,
      productTitle: socialMediaContentPackage.hook,
      benefits: socialMediaContentPackage.benefitBullets,
      highlights: socialMediaContentPackage.productHighlights,
      socialMediaContentPackage,
      language: socialMediaContentPackage.language,
      tone: socialMediaContentPackage.tone,
      ...(campaignObjective === undefined ? {} : { campaignObjective }),
      ...(campaignId === undefined ? {} : { campaignId }),
    };
  }
}

function objectiveFromSocial(
  objective: SocialMediaContentPackage["objective"],
): VideoScriptGenerationInput["campaignObjective"] {
  if (objective === "product-launch") {
    return "product-launch";
  }
  if (objective === "brand-positioning") {
    return "brand-positioning";
  }
  if (objective === "education") {
    return "education";
  }
  if (objective === "conversion") {
    return "conversion";
  }
  if (objective === "traffic") {
    return "traffic";
  }
  if (objective === "retargeting") {
    return "retargeting";
  }
  return "engagement";
}
