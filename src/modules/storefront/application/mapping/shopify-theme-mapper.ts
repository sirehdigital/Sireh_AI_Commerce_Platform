import type { StorefrontPlan } from "../../domain/index.js";
import { CollectionTemplateMapper } from "./collection-template-mapper.js";
import { HomepageMapper } from "./homepage-mapper.js";
import { hashPayload } from "./mapping-utils.js";
import { MetafieldMapper } from "./metafield-mapper.js";
import { MetaobjectMapper } from "./metaobject-mapper.js";
import { NavigationMapper } from "./navigation-mapper.js";
import { ProductTemplateMapper } from "./product-template-mapper.js";
import { ThemeMappingValidator } from "./theme-mapping-validator.js";
import { ThemeSettingsMapper } from "./theme-settings-mapper.js";
import type { ShopifyThemeMappingModel, ShopifyThemePreviewArtifactModel } from "./theme-mapping.types.js";

export class ShopifyThemeMapper {
  private readonly homepageMapper = new HomepageMapper();
  private readonly productMapper = new ProductTemplateMapper();
  private readonly collectionMapper = new CollectionTemplateMapper();
  private readonly navigationMapper = new NavigationMapper();
  private readonly settingsMapper = new ThemeSettingsMapper();
  private readonly metafieldMapper = new MetafieldMapper();
  private readonly metaobjectMapper = new MetaobjectMapper();
  private readonly validator = new ThemeMappingValidator();

  public map(input: { readonly projectId: string; readonly plan: StorefrontPlan; readonly generatedAt: string }): ShopifyThemeMappingModel {
    const homepage = this.homepageMapper.map(input.plan.homepage);
    const products = input.plan.productPages.map((product) => this.productMapper.map(product));
    const collections = input.plan.collections.map((collection) => this.collectionMapper.map(collection));
    const navigation = this.navigationMapper.map(input.plan.navigation);
    const settings = this.settingsMapper.map(input.plan.profile);
    const metafields = this.metafieldMapper.map(input.plan);
    const metaobjects = this.metaobjectMapper.map(input.plan, metafields);
    const base = {
      projectId: input.projectId,
      generatedAt: input.generatedAt,
      homepage,
      products,
      collections,
      navigation,
      settings,
      metafields,
      metaobjects,
      previewArtifacts: [] as readonly ShopifyThemePreviewArtifactModel[],
    };
    const previewArtifacts = this.previewArtifacts(base);
    const mapped = { ...base, previewArtifacts };
    return {
      ...mapped,
      validation: this.validator.validate(mapped),
    };
  }

  private previewArtifacts(input: Omit<ShopifyThemeMappingModel, "validation" | "previewArtifacts">): readonly ShopifyThemePreviewArtifactModel[] {
    const artifacts = [
      { kind: "THEME_MAPPING_PREVIEW" as const, path: "theme-preview/theme-mapping.json", payload: input },
      { kind: "HOMEPAGE_PREVIEW" as const, path: "theme-preview/homepage.json", payload: input.homepage },
      { kind: "PRODUCT_PREVIEW" as const, path: "theme-preview/products.json", payload: { products: input.products } },
      { kind: "COLLECTION_PREVIEW" as const, path: "theme-preview/collections.json", payload: { collections: input.collections } },
      { kind: "NAVIGATION_PREVIEW" as const, path: "theme-preview/navigation.json", payload: input.navigation },
      { kind: "THEME_SETTINGS_PREVIEW" as const, path: "theme-preview/settings.json", payload: input.settings },
      { kind: "METAFIELD_DEFINITIONS_PREVIEW" as const, path: "theme-preview/metafields.json", payload: { metafields: input.metafields } },
      { kind: "METAOBJECT_DEFINITIONS_PREVIEW" as const, path: "theme-preview/metaobjects.json", payload: { metaobjects: input.metaobjects } },
    ];
    return artifacts.map((artifact, index) => ({
      id: `theme-mapping:${input.projectId}:${index + 1}`,
      kind: artifact.kind,
      path: artifact.path,
      contentHash: hashPayload(artifact.payload),
      payload: artifact.payload as Readonly<Record<string, unknown>>,
    }));
  }
}
