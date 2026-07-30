import type { StorefrontProject } from "../../domain/index.js";
import type { ShopifyThemeMappingModel } from "../mapping/index.js";
import { ArtifactBundleBuilder } from "./artifact-bundle-builder.js";
import { ArtifactSerializer } from "./artifact-serializer.js";
import { ArtifactValidator } from "./artifact-validator.js";
import { AssetManifestGenerator } from "./asset-manifest-generator.js";
import { BlockArtifactGenerator } from "./block-artifact-generator.js";
import { CollectionArtifactGenerator } from "./collection-artifact-generator.js";
import { DynamicSourceArtifactGenerator } from "./dynamic-source-artifact-generator.js";
import { HomepageArtifactGenerator } from "./homepage-artifact-generator.js";
import { MetafieldArtifactGenerator } from "./metafield-artifact-generator.js";
import { MetaobjectArtifactGenerator } from "./metaobject-artifact-generator.js";
import { NavigationArtifactGenerator } from "./navigation-artifact-generator.js";
import { ProductArtifactGenerator } from "./product-artifact-generator.js";
import { SectionArtifactGenerator } from "./section-artifact-generator.js";
import { ThemeSettingsArtifactGenerator } from "./theme-settings-artifact-generator.js";
import type {
  SerializedThemeArtifact,
  ThemeArtifactGenerationResult,
  ThemePreviewArtifactKind,
} from "./theme-artifact.types.js";

export class ThemeArtifactGenerator {
  private readonly serializer = new ArtifactSerializer();
  private readonly homepageGenerator = new HomepageArtifactGenerator();
  private readonly productGenerator = new ProductArtifactGenerator();
  private readonly collectionGenerator = new CollectionArtifactGenerator();
  private readonly navigationGenerator = new NavigationArtifactGenerator();
  private readonly settingsGenerator = new ThemeSettingsArtifactGenerator();
  private readonly sectionGenerator = new SectionArtifactGenerator();
  private readonly blockGenerator = new BlockArtifactGenerator();
  private readonly dynamicSourceGenerator = new DynamicSourceArtifactGenerator();
  private readonly metafieldGenerator = new MetafieldArtifactGenerator();
  private readonly metaobjectGenerator = new MetaobjectArtifactGenerator();
  private readonly assetManifestGenerator = new AssetManifestGenerator();
  private readonly bundleBuilder = new ArtifactBundleBuilder();
  private readonly validator = new ArtifactValidator();

  public generate(input: {
    readonly project: StorefrontProject;
    readonly mapping: ShopifyThemeMappingModel;
    readonly generatedAt: string;
  }): ThemeArtifactGenerationResult {
    const sections = this.sectionGenerator.sections(input.mapping);
    const generatedArtifacts: readonly SerializedThemeArtifact[] = [
      this.artifact("THEME_MAPPING_SOURCE", "theme-preview/theme-mapping.json", input.mapping as unknown as Readonly<Record<string, unknown>>),
      this.artifact("HOMEPAGE_JSON", "theme-preview/homepage.json", this.homepageGenerator.generate(input.mapping.homepage) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("PRODUCT_TEMPLATE_JSON", "theme-preview/product.json", this.productGenerator.generate(input.mapping.products)),
      this.artifact("COLLECTION_TEMPLATE_JSON", "theme-preview/collections.json", this.collectionGenerator.generate(input.mapping.collections)),
      this.artifact("NAVIGATION_JSON", "theme-preview/navigation.json", this.navigationGenerator.generate(input.mapping.navigation) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("THEME_SETTINGS_JSON", "theme-preview/settings.json", this.settingsGenerator.generate(input.mapping.settings) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("SECTION_DEFINITIONS_JSON", "theme-preview/sections.json", this.sectionGenerator.generate(input.mapping) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("BLOCK_DEFINITIONS_JSON", "theme-preview/blocks.json", this.blockGenerator.generate(sections) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("DYNAMIC_SOURCE_REFERENCES_JSON", "theme-preview/dynamic-sources.json", this.dynamicSourceGenerator.generate(sections) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("METAFIELD_DEFINITIONS_JSON", "theme-preview/metafields.json", this.metafieldGenerator.generate(input.mapping.metafields) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("METAOBJECT_DEFINITIONS_JSON", "theme-preview/metaobjects.json", this.metaobjectGenerator.generate(input.mapping.metaobjects) as unknown as Readonly<Record<string, unknown>>),
      this.artifact("ASSET_MANIFEST_JSON", "theme-preview/assets.json", this.assetManifestGenerator.generate(input.mapping) as unknown as Readonly<Record<string, unknown>>),
    ];
    const manifest = this.bundleBuilder.manifest({ projectId: input.project.id, artifacts: generatedArtifacts });
    const manifestArtifact = this.artifact("MANIFEST_INDEX_JSON", "theme-preview/manifest.json", manifest as unknown as Readonly<Record<string, unknown>>);
    const preliminary = generatedArtifacts.concat(manifestArtifact);
    const validation = this.validator.validate({ artifacts: preliminary.concat(this.placeholderBundle(input.project.id)), manifest });
    const bundle = this.bundleBuilder.bundle({
      generatedAt: input.generatedAt,
      projectId: input.project.id,
      planningScore: input.project.qualitySnapshot.overallScore,
      mappingScore: input.project.qualitySnapshot.categoryScores.themeMapping ?? 0,
      artifactValidationScore: validation.score,
      artifactCount: preliminary.length + 1,
      manifest,
      requiresReview: validation.report.requiresHumanReview,
    });
    const bundleArtifact = this.artifact("BUNDLE_METADATA_JSON", "theme-preview/bundle.json", bundle as unknown as Readonly<Record<string, unknown>>);
    const artifacts = preliminary.concat(bundleArtifact);
    const finalValidation = this.validator.validate({ artifacts, manifest, bundle });
    return {
      mapping: input.mapping,
      artifacts,
      manifest,
      bundle: {
        ...bundle,
        artifactValidationScore: finalValidation.score,
      },
      validation: finalValidation.report,
      validationScore: finalValidation.score,
    };
  }

  private artifact(kind: ThemePreviewArtifactKind, path: string, payload: Readonly<Record<string, unknown>>): SerializedThemeArtifact {
    return this.serializer.serialize({ kind, path, payload });
  }

  private placeholderBundle(projectId: string): SerializedThemeArtifact {
    return this.artifact("BUNDLE_METADATA_JSON", "theme-preview/bundle.json", {
      bundleVersion: "2026-07-30",
      projectId,
      placeholder: true,
    });
  }
}
