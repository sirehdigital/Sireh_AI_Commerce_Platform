import type { StorefrontValidationReport } from "../../domain/index.js";
import type {
  ShopifyThemeBlockMapping,
  ShopifyThemeMappingModel,
  ShopifyThemeMetaobjectMapping,
  ShopifyThemeMetafieldMapping,
  ShopifyThemeNavigationMapping,
  ShopifyThemeSectionMapping,
  ShopifyThemeSettingsMapping,
  ShopifyThemeTemplateMapping,
} from "../mapping/index.js";

export type ThemePreviewArtifactKind =
  | "THEME_MAPPING_SOURCE"
  | "HOMEPAGE_JSON"
  | "PRODUCT_TEMPLATE_JSON"
  | "COLLECTION_TEMPLATE_JSON"
  | "NAVIGATION_JSON"
  | "THEME_SETTINGS_JSON"
  | "SECTION_DEFINITIONS_JSON"
  | "BLOCK_DEFINITIONS_JSON"
  | "DYNAMIC_SOURCE_REFERENCES_JSON"
  | "METAFIELD_DEFINITIONS_JSON"
  | "METAOBJECT_DEFINITIONS_JSON"
  | "ASSET_MANIFEST_JSON"
  | "MANIFEST_INDEX_JSON"
  | "BUNDLE_METADATA_JSON";

export interface SerializedThemeArtifact {
  readonly kind: ThemePreviewArtifactKind;
  readonly path: string;
  readonly contentHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ThemeTemplateArtifactPayload {
  readonly templateType: ShopifyThemeTemplateMapping["templateType"];
  readonly role: string;
  readonly sourcePath: string;
  readonly sections: Readonly<Record<string, {
    readonly type: string;
    readonly settings: Readonly<Record<string, string | number | boolean | null>>;
    readonly blocks: readonly ShopifyThemeBlockMapping[];
  }>>;
  readonly order: readonly string[];
  readonly seo: Readonly<Record<string, string>>;
}

export interface ThemeNavigationArtifactPayload {
  readonly navigation: ShopifyThemeNavigationMapping;
}

export interface ThemeSettingsArtifactPayload {
  readonly settings: ShopifyThemeSettingsMapping;
}

export interface ThemeSectionDefinitionsPayload {
  readonly sections: readonly ShopifyThemeSectionMapping[];
}

export interface ThemeBlockDefinitionsPayload {
  readonly blocks: readonly ShopifyThemeBlockMapping[];
}

export interface ThemeDynamicSourceReferencesPayload {
  readonly dynamicSources: readonly {
    readonly ownerType: "section" | "block";
    readonly ownerId: string;
    readonly source: string;
  }[];
}

export interface ThemeMetafieldDefinitionsPayload {
  readonly metafields: readonly ShopifyThemeMetafieldMapping[];
}

export interface ThemeMetaobjectDefinitionsPayload {
  readonly metaobjects: readonly ShopifyThemeMetaobjectMapping[];
}

export interface AssetManifestPayload {
  readonly assets: readonly {
    readonly id: string;
    readonly ownerPath: string;
    readonly assetType: "image" | "json" | "settings" | "navigation" | "metadata";
    readonly required: boolean;
  }[];
}

export interface ManifestIndexPayload {
  readonly manifestVersion: "2026-07-30";
  readonly projectId: string;
  readonly artifacts: readonly {
    readonly kind: ThemePreviewArtifactKind;
    readonly path: string;
    readonly contentHash: string;
  }[];
}

export interface ThemeArtifactBundle {
  readonly bundleVersion: "2026-07-30";
  readonly generatedAt: string;
  readonly projectId: string;
  readonly planningScore: number;
  readonly mappingScore: number;
  readonly artifactValidationScore: number;
  readonly artifactCount: number;
  readonly manifest: ManifestIndexPayload;
  readonly bundleHash: string;
  readonly requiresReview: boolean;
}

export interface ThemeArtifactGenerationResult {
  readonly mapping: ShopifyThemeMappingModel;
  readonly artifacts: readonly SerializedThemeArtifact[];
  readonly manifest: ManifestIndexPayload;
  readonly bundle: ThemeArtifactBundle;
  readonly validation: StorefrontValidationReport;
  readonly validationScore: number;
}
