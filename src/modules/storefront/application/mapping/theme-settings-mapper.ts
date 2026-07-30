import type { StorefrontProfile } from "../../domain/index.js";
import type { ShopifyThemeSettingsMapping } from "./theme-mapping.types.js";

export class ThemeSettingsMapper {
  public map(profile: StorefrontProfile): ShopifyThemeSettingsMapping {
    return {
      typography: {
        direction: profile.typographyDirection,
        headingStyle: "editorial",
        bodyStyle: "clean",
      },
      brandColors: {
        primary: profile.preferredColorPalette[0] ?? "#111111",
        background: profile.preferredColorPalette[1] ?? "#FFFFFF",
        accent: profile.preferredColorPalette[2] ?? "#D9B99B",
      },
      buttons: {
        shape: "rounded",
        size: "large",
        borderRadius: 999,
      },
      spacing: {
        sectionY: 72,
        blockGap: 24,
        mobileSectionY: 48,
      },
      containerWidth: 1200,
      announcementBar: {
        enabled: true,
        tone: "calm",
      },
      footer: {
        enabled: true,
        groups: profile.footerRequirements.join(", "),
      },
      socialLinks: profile.socialLinks.map((link) => link.url),
      newsletterEnabled: profile.homepagePriorities.includes("newsletter"),
    };
  }
}
