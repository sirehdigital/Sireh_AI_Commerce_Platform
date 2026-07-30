import type { StorefrontValidationReport } from "../../domain/index.js";

export type ShopifyThemeMappingArtifactKind =
  | "THEME_MAPPING_PREVIEW"
  | "HOMEPAGE_PREVIEW"
  | "PRODUCT_PREVIEW"
  | "COLLECTION_PREVIEW"
  | "NAVIGATION_PREVIEW"
  | "THEME_SETTINGS_PREVIEW"
  | "METAFIELD_DEFINITIONS_PREVIEW"
  | "METAOBJECT_DEFINITIONS_PREVIEW";

export interface ShopifyThemeBlockMapping {
  readonly id: string;
  readonly type: string;
  readonly order: number;
  readonly settings: Readonly<Record<string, string | number | boolean | null>>;
  readonly dynamicSources: readonly string[];
}

export interface ShopifyThemeSectionMapping {
  readonly id: string;
  readonly type: string;
  readonly order: number;
  readonly settings: Readonly<Record<string, string | number | boolean | null>>;
  readonly blocks: readonly ShopifyThemeBlockMapping[];
  readonly dynamicSources: readonly string[];
  readonly themeReference: string;
}

export interface ShopifyThemeTemplateMapping {
  readonly path: string;
  readonly templateType: "index" | "product" | "collection";
  readonly role: string;
  readonly sections: readonly ShopifyThemeSectionMapping[];
  readonly order: readonly string[];
  readonly seo: Readonly<Record<string, string>>;
}

export interface ShopifyThemeNavigationMapping {
  readonly mainMenu: readonly ShopifyThemeNavigationItemMapping[];
  readonly footerMenu: readonly ShopifyThemeNavigationItemMapping[];
  readonly mobileMenu: readonly ShopifyThemeNavigationItemMapping[];
  readonly utilityLinks: readonly ShopifyThemeNavigationItemMapping[];
}

export interface ShopifyThemeNavigationItemMapping {
  readonly id: string;
  readonly label: string;
  readonly handle: string;
  readonly url: string;
  readonly parentId?: string;
  readonly order: number;
}

export interface ShopifyThemeSettingsMapping {
  readonly typography: Readonly<Record<string, string>>;
  readonly brandColors: Readonly<Record<string, string>>;
  readonly buttons: Readonly<Record<string, string | number>>;
  readonly spacing: Readonly<Record<string, number>>;
  readonly containerWidth: number;
  readonly announcementBar: Readonly<Record<string, string | boolean>>;
  readonly footer: Readonly<Record<string, string | boolean>>;
  readonly socialLinks: readonly string[];
  readonly newsletterEnabled: boolean;
}

export interface ShopifyThemeMetafieldMapping {
  readonly ownerType: "PRODUCT" | "COLLECTION" | "PAGE" | "SHOP";
  readonly namespace: string;
  readonly key: string;
  readonly valueType: string;
  readonly dynamicSource: string;
  readonly required: boolean;
}

export interface ShopifyThemeMetaobjectMapping {
  readonly type: string;
  readonly name: string;
  readonly fields: readonly ShopifyThemeMetafieldMapping[];
  readonly source: string;
}

export interface ShopifyThemePreviewArtifactModel {
  readonly id: string;
  readonly kind: ShopifyThemeMappingArtifactKind;
  readonly path: string;
  readonly contentHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ShopifyThemeMappingModel {
  readonly projectId: string;
  readonly generatedAt: string;
  readonly homepage: ShopifyThemeTemplateMapping;
  readonly products: readonly ShopifyThemeTemplateMapping[];
  readonly collections: readonly ShopifyThemeTemplateMapping[];
  readonly navigation: ShopifyThemeNavigationMapping;
  readonly settings: ShopifyThemeSettingsMapping;
  readonly metafields: readonly ShopifyThemeMetafieldMapping[];
  readonly metaobjects: readonly ShopifyThemeMetaobjectMapping[];
  readonly previewArtifacts: readonly ShopifyThemePreviewArtifactModel[];
  readonly validation: StorefrontValidationReport;
}
