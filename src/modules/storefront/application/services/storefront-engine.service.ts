import { createHash } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ProductDraftRepository } from "../../../product-draft/domain/repositories/product-draft.repository.js";
import type { ProductMediaRepository } from "../../../product-media/domain/repositories/index.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type { ShopifyThemeGateway } from "../gateways/index.js";
import { DisabledShopifyThemeGateway } from "../../infrastructure/gateways/index.js";
import type {
  CollectionPagePlan,
  HomepagePlan,
  NavigationPlan,
  ProductPagePlan,
  ShopifyThemeMapping,
  StorefrontArtifact,
  StorefrontBlock,
  StorefrontExecutionMode,
  StorefrontMetadataPlan,
  StorefrontMetafieldDefinition,
  StorefrontMetaobjectDefinition,
  StorefrontNavigationItem,
  StorefrontPlan,
  StorefrontPreview,
  StorefrontProfile,
  StorefrontProject,
  StorefrontProjectListQuery,
  StorefrontProjectListResult,
  StorefrontQualityReport,
  StorefrontSection,
  StorefrontTemplate,
  StorefrontThemeTarget,
  StorefrontValidationIssue,
  StorefrontValidationReport,
} from "../../domain/index.js";
import type { StorefrontRepository } from "../../domain/repositories/index.js";

type MaybePromise<T> = T | Promise<T>;

export interface StorefrontApprovalRepository {
  save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): MaybePromise<ApprovalRecord>;
}

export interface StorefrontAuditRepository {
  append(context: TenantContext, record: AuditRecord): MaybePromise<AuditRecord>;
}

export interface CreateStorefrontProjectInput {
  readonly productDraftIds: readonly string[];
  readonly profile?: Partial<StorefrontProfile>;
  readonly profileId?: string;
  readonly collectionDefinitions?: readonly StorefrontCollectionInput[];
  readonly locale?: string;
  readonly markets?: readonly string[];
  readonly mode?: StorefrontExecutionMode;
  readonly themeTarget?: StorefrontThemeTarget;
  readonly homepagePreferences?: readonly string[];
  readonly productPagePreferences?: readonly string[];
  readonly requestedTemplates?: readonly string[];
  readonly requestedBy?: string;
  readonly force?: boolean;
  readonly correlationId?: string;
}

export interface StorefrontCollectionInput {
  readonly title: string;
  readonly handle?: string;
  readonly description?: string;
  readonly productDraftIds?: readonly string[];
}

export interface StorefrontEngineDependencies {
  readonly repository: StorefrontRepository;
  readonly productDraftRepository: ProductDraftRepository;
  readonly productMediaRepository?: ProductMediaRepository;
  readonly approvalRepository?: StorefrontApprovalRepository;
  readonly auditRepository?: StorefrontAuditRepository;
  readonly shopifyThemeGateway?: ShopifyThemeGateway;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export class StorefrontEngineService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly gateway: ShopifyThemeGateway;

  public constructor(private readonly dependencies: StorefrontEngineDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? (() => crypto.randomUUID());
    this.gateway = dependencies.shopifyThemeGateway ?? new DisabledShopifyThemeGateway();
  }

  public async createProject(input: CreateStorefrontProjectInput, tenant: TenantContext): Promise<StorefrontProject> {
    const mode = input.mode ?? "PLAN_ONLY";
    const requestedBy = this.optionalText(input.requestedBy) ?? "merchant-api";
    const themeTarget = input.themeTarget ?? { type: "UNKNOWN", reference: "configuration-preview" };
    const productDraftIds = this.requireNonEmptyStrings(input.productDraftIds, "productDraftIds");
    const drafts = await this.loadApprovedDrafts(productDraftIds);
    const profile = await this.resolveProfile(input, tenant, drafts);
    const locale = this.optionalText(input.locale) ?? profile.defaultLocale;
    const markets = input.markets === undefined || input.markets.length === 0 ? profile.targetMarkets : this.requireNonEmptyStrings(input.markets, "markets");
    const idempotencyKey = this.idempotencyKey({
      tenant,
      profile,
      productDraftIds,
      locale,
      markets,
      mode,
      themeTarget,
      ...(input.requestedTemplates === undefined ? {} : { requestedTemplates: input.requestedTemplates }),
    });
    const existing = await this.dependencies.repository.findProjectByIdempotencyKey({ tenantId: tenant.tenantId, storeId: tenant.storeId, idempotencyKey });
    if (existing !== undefined && input.force !== true && existing.status !== "FAILED" && existing.status !== "VALIDATION_FAILED") {
      await this.audit(tenant, "storefront.idempotent_replay", existing.id, "Replayed existing storefront project.", input.correlationId, {
        projectId: existing.id,
        idempotencyKey,
      });
      return existing;
    }

    await this.dependencies.repository.saveProfile(profile);
    await this.audit(tenant, "storefront.planning.started", `storefront:${idempotencyKey}`, "Storefront planning started.", input.correlationId, {
      mode,
      productDraftCount: drafts.length,
    });

    const plan = await this.buildPlan({ profile, drafts, locale, markets, input });
    const validation = this.validatePlan(plan);
    const quality = this.evaluateQuality(plan, validation);
    const projectId = `storefront-project:${this.idGenerator()}`;
    const artifacts = this.buildArtifacts(projectId, plan, mode);
    const generatedArtifacts = mode === "GENERATE_ARTIFACTS"
      ? await this.gateway.generateArtifacts({ themeTarget, artifacts })
      : { ok: true, previewUrl: null, artifactReferences: artifacts.map((artifact) => artifact.path), warnings: [] };
    const savedArtifacts = await this.dependencies.repository.saveArtifacts(projectId, artifacts);
    const approvalId = validation.errors.length === 0 ? await this.createApproval(tenant, projectId, profile.brandName, requestedBy) : undefined;
    const timestamp = this.timestamp();
    const status = validation.errors.length > 0 ? "VALIDATION_FAILED" : "PENDING_REVIEW";
    const project: StorefrontProject = {
      id: projectId,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      status,
      mode,
      brandName: profile.brandName,
      themeTargetReference: themeTarget.reference,
      selectedProductDraftIds: productDraftIds,
      locale,
      markets,
      idempotencyKey,
      planSnapshot: plan,
      validationSnapshot: {
        ...validation,
        warnings: generatedArtifacts.warnings.map((warning) => this.warning("SHOPIFY_GATEWAY_WARNING", warning, "themeGateway")).concat(validation.warnings),
      },
      qualitySnapshot: generatedArtifacts.ok ? quality : this.withGatewayFailureQuality(quality, generatedArtifacts.failureMessage ?? "Shopify theme gateway failed."),
      ...(approvalId === undefined ? {} : { approvalId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(existing?.id === undefined || input.force !== true ? {} : { parentProjectId: existing.id }),
      ...(generatedArtifacts.ok ? {} : { failureStage: "THEME_ARTIFACT_GENERATION", failureCode: generatedArtifacts.failureCode ?? "SHOPIFY_GATEWAY_FAILED", failureMessage: generatedArtifacts.failureMessage ?? "Shopify theme gateway failed." }),
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    const savedProject = await this.dependencies.repository.createProject(project);
    const preview: StorefrontPreview = {
      id: `storefront-preview:${this.idGenerator()}`,
      storefrontProjectId: projectId,
      planSnapshot: plan,
      generatedArtifactReferences: savedArtifacts.map((artifact) => artifact.path),
      themeTarget,
      selectedProductDraftIds: productDraftIds,
      qualityReport: savedProject.qualitySnapshot,
      validationReport: savedProject.validationSnapshot,
      previewStatus: mode === "GENERATE_ARTIFACTS" ? "ARTIFACT_PREVIEW" : "CONFIGURATION_PREVIEW",
      previewUrl: generatedArtifacts.previewUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.dependencies.repository.savePreview(preview);
    await this.audit(tenant, status === "PENDING_REVIEW" ? "storefront.approval.requested" : "storefront.validation.blocked", projectId, status === "PENDING_REVIEW" ? "Storefront preview prepared and pending merchant review." : "Storefront validation blocked preview readiness.", input.correlationId, {
      projectId,
      status,
      approvalId: approvalId ?? null,
      validationErrors: validation.errors.length,
      qualityScore: savedProject.qualitySnapshot.overallScore,
    });
    return savedProject;
  }

  public listProjects(query: StorefrontProjectListQuery): Promise<StorefrontProjectListResult> {
    return this.dependencies.repository.listProjects(query);
  }

  public async getProject(projectId: string, tenant: TenantContext): Promise<StorefrontProject> {
    const project = await this.dependencies.repository.findProjectById(this.requiredText(projectId, "projectId"));
    if (project?.tenantId !== tenant.tenantId || project.storeId !== tenant.storeId) {
      throw AppError.notFound("Storefront project was not found.", { projectId }, "STOREFRONT_PROJECT_NOT_FOUND");
    }
    return project;
  }

  public async getPreview(projectId: string, tenant: TenantContext): Promise<StorefrontPreview> {
    await this.getProject(projectId, tenant);
    const preview = await this.dependencies.repository.findPreviewByProjectId(projectId);
    if (preview === undefined) {
      throw AppError.notFound("Storefront preview was not found.", { projectId }, "STOREFRONT_PREVIEW_NOT_FOUND");
    }
    return preview;
  }

  public async listArtifacts(projectId: string, tenant: TenantContext): Promise<readonly StorefrontArtifact[]> {
    await this.getProject(projectId, tenant);
    return this.dependencies.repository.listArtifacts(projectId);
  }

  private async loadApprovedDrafts(productDraftIds: readonly string[]): Promise<readonly ProductDraft[]> {
    const drafts = await Promise.all(productDraftIds.map((id) => this.dependencies.productDraftRepository.findById(id)));
    const missing = productDraftIds.filter((_id, index) => drafts[index] === null);
    if (missing.length > 0) {
      throw AppError.badRequest("Unknown product draft requested for storefront planning.", { productDraftIds: missing.join(",") }, "STOREFRONT_PRODUCT_DRAFT_NOT_FOUND");
    }
    const resolvedDrafts = drafts.filter((draft): draft is ProductDraft => draft !== null);
    const unapproved = resolvedDrafts.filter((draft) => draft.status !== "approved");
    if (unapproved.length > 0) {
      throw AppError.badRequest("Storefront planning requires approved product drafts.", { productDraftIds: unapproved.map((draft) => draft.id).join(",") }, "STOREFRONT_PRODUCT_DRAFT_NOT_APPROVED");
    }
    return resolvedDrafts;
  }

  private async resolveProfile(
    input: CreateStorefrontProjectInput,
    tenant: TenantContext,
    drafts: readonly ProductDraft[],
  ): Promise<StorefrontProfile> {
    const existing = input.profileId === undefined
      ? undefined
      : await this.dependencies.repository.findProfile({ tenantId: tenant.tenantId, storeId: tenant.storeId, profileId: input.profileId });
    const timestamp = this.timestamp();
    const brandName = this.optionalText(input.profile?.brandName) ?? existing?.brandName ?? drafts[0]?.brand ?? drafts[0]?.branding?.brandName ?? "Storefront Brand";
    return {
      id: existing?.id ?? input.profile?.id ?? `storefront-profile:${tenant.tenantId}:${tenant.storeId}:${this.handle(brandName)}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      version: input.profile?.version ?? existing?.version ?? 1,
      brandName,
      brandPositioning: input.profile?.brandPositioning ?? existing?.brandPositioning ?? drafts[0]?.branding?.positioning ?? "Commerce storefront profile",
      targetMarkets: input.profile?.targetMarkets ?? existing?.targetMarkets ?? drafts[0]?.targetMarkets ?? ["US"],
      defaultLocale: input.profile?.defaultLocale ?? existing?.defaultLocale ?? "en-US",
      supportedLocales: input.profile?.supportedLocales ?? existing?.supportedLocales ?? ["en-US"],
      currency: input.profile?.currency ?? existing?.currency ?? drafts[0]?.variants[0]?.sellingPrice.currency ?? "USD",
      industry: input.profile?.industry ?? existing?.industry ?? "commerce",
      visualIdentity: input.profile?.visualIdentity ?? existing?.visualIdentity ?? ["clean", "premium"],
      preferredColorPalette: input.profile?.preferredColorPalette ?? existing?.preferredColorPalette ?? ["white", "neutral"],
      typographyDirection: input.profile?.typographyDirection ?? existing?.typographyDirection ?? "Premium editorial hierarchy",
      toneOfVoice: input.profile?.toneOfVoice ?? existing?.toneOfVoice ?? ["clear", "trustworthy"],
      photographyDirection: input.profile?.photographyDirection ?? existing?.photographyDirection ?? "Product-first imagery with lifestyle context",
      trustStyle: input.profile?.trustStyle ?? existing?.trustStyle ?? ["clear policies", "secure checkout"],
      targetCustomer: input.profile?.targetCustomer ?? existing?.targetCustomer ?? ["online shoppers"],
      merchandisingPriorities: input.profile?.merchandisingPriorities ?? existing?.merchandisingPriorities ?? ["best sellers", "categories"],
      navigationPreferences: input.profile?.navigationPreferences ?? existing?.navigationPreferences ?? ["Shop", "About", "FAQ", "Contact"],
      homepagePriorities: input.profile?.homepagePriorities ?? existing?.homepagePriorities ?? ["hero", "featured collection", "newsletter"],
      productPagePriorities: input.profile?.productPagePriorities ?? existing?.productPagePriorities ?? ["gallery", "add to cart", "benefits", "shipping"],
      footerRequirements: input.profile?.footerRequirements ?? existing?.footerRequirements ?? ["Company", "Customer Care", "Shop", "Newsletter"],
      policyPageReferences: input.profile?.policyPageReferences ?? existing?.policyPageReferences ?? this.defaultPolicyLinks(),
      socialLinks: input.profile?.socialLinks ?? existing?.socialLinks ?? [],
      contactReferences: input.profile?.contactReferences ?? existing?.contactReferences ?? [this.navItem("contact", "Contact", "/pages/contact", 1)],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  private async buildPlan(input: {
    readonly profile: StorefrontProfile;
    readonly drafts: readonly ProductDraft[];
    readonly locale: string;
    readonly markets: readonly string[];
    readonly input: CreateStorefrontProjectInput;
  }): Promise<StorefrontPlan> {
    const mediaByDraft = await this.loadMediaByDraft(input.drafts);
    const homepage = this.homepagePlan(input.profile, input.drafts, input.locale, input.markets, input.input.homepagePreferences);
    const productPages = input.drafts.map((draft) => this.productPagePlan(input.profile, draft, mediaByDraft.get(draft.id) ?? [], input.locale, input.markets));
    const collections = this.collectionPlans(input.profile, input.drafts, input.input.collectionDefinitions, input.locale, input.markets);
    const navigation = this.navigationPlan(input.profile, collections);
    const metadata = this.metadataPlan(input.drafts);
    const themeMapping = this.themeMapping(homepage, productPages, collections, metadata);
    return { profile: input.profile, homepage, productPages, collections, navigation, metadata, themeMapping };
  }

  private async loadMediaByDraft(drafts: readonly ProductDraft[]): Promise<ReadonlyMap<string, readonly string[]>> {
    const media = new Map<string, readonly string[]>();
    if (this.dependencies.productMediaRepository === undefined) {
      return media;
    }
    for (const draft of drafts) {
      const jobs = await this.dependencies.productMediaRepository.listJobs({ tenantId: "", storeId: "", productDraftId: draft.id, status: "APPROVED" });
      media.set(draft.id, jobs.items.map((job) => job.id));
    }
    return media;
  }

  private homepagePlan(
    profile: StorefrontProfile,
    drafts: readonly ProductDraft[],
    locale: string,
    markets: readonly string[],
    preferences: readonly string[] | undefined,
  ): HomepagePlan {
    const sections: StorefrontSection[] = [
      this.section("announcement-bar", "announcement", 1, "Announcement bar", { text: "Free shipping and policy messaging require merchant confirmation." }, [], locale, markets),
      this.section("header", "header", 2, "Header navigation", { menu: "main-menu" }, [], locale, markets),
      this.section("hero-banner", "hero", 3, "Premium brand hero", { heading: profile.brandName, subheading: profile.brandPositioning, primaryCta: "Shop now", secondaryCta: "Explore collections" }, [], locale, markets),
      this.section("featured-collection", "featured-collection", 4, "Featured approved products", { heading: "Best Sellers", productCount: Math.min(4, drafts.length) }, [], locale, markets),
      this.section("featured-product", "featured-product", 5, "Featured product story", { productDraftId: drafts[0]?.id ?? "", heading: drafts[0]?.title ?? "Featured product" }, [], locale, markets),
      this.section("brand-promise", "brand-promise", 6, "Brand promise", { heading: "Why choose " + profile.brandName }, profile.trustStyle.map((trust, index) => this.block("trust", `trust-${index + 1}`, index + 1, { label: trust })), locale, markets),
      this.section("product-category-tiles", "categories", 7, "Shop by category", { heading: "Shop by Category" }, [...new Set(drafts.map((draft) => draft.productType ?? draft.category).filter((value): value is string => value !== undefined))].map((label, index) => this.block("category", this.handle(label), index + 1, { label })), locale, markets),
      this.section("newsletter", "newsletter", 8, "Newsletter signup", { heading: `Join the ${profile.brandName} Journal`, subheading: "Exclusive tips, early product releases, and members-only offers." }, [], locale, markets),
      this.section("footer", "footer", 9, "Footer navigation", { groups: profile.footerRequirements.join(", ") }, [], locale, markets),
    ];
    const verifiedSocialProof = preferences?.includes("verified-testimonials") === true;
    if (verifiedSocialProof) {
      sections.splice(7, 0, this.section("testimonials", "verified-testimonials", 8, "Verified testimonials", { requiresMerchantContent: true }, [], locale, markets));
    }
    return {
      templateId: "templates/index.json",
      title: `${profile.brandName} homepage`,
      seoTitle: `${profile.brandName} | ${profile.brandPositioning}`,
      metaDescription: `${profile.brandName} storefront preview for ${profile.industry}.`,
      sections: sections.map((section, index) => ({ ...section, position: index + 1 })),
    };
  }

  private productPagePlan(
    profile: StorefrontProfile,
    draft: ProductDraft,
    mediaReferences: readonly string[],
    locale: string,
    markets: readonly string[],
  ): ProductPagePlan {
    const blocks: StorefrontBlock[] = [
      this.block("title", "product-title", 1, { text: draft.title }),
      this.block("media-gallery", "media-gallery", 2, { selectedImages: draft.images.filter((image) => image.selected).length || draft.images.length }),
      this.block("price", "price", 3, { currency: draft.variants[0]?.sellingPrice.currency ?? profile.currency }),
      this.block("variant-selector", "variant-selector", 4, { variantCount: draft.variants.length }),
      this.block("quantity-selector", "quantity-selector", 5, { enabled: true }),
      this.block("add-to-cart", "add-to-cart", 6, { label: "Add to cart", stickyMobile: true }),
      this.block("description", "description", 7, { source: "productDraft.description" }),
      this.block("key-benefits", "key-benefits", 8, { benefitCount: this.benefits(draft).length }),
      this.block("shipping-returns", "shipping-returns", 9, { source: draft.shipping === undefined ? "policy-placeholder" : "productDraft.shipping" }),
      this.block("related-products", "related-products", 10, { strategy: "same-category" }),
      this.block("recently-viewed", "recently-viewed", 11, { support: "placeholder" }),
    ];
    if (draft.variants.some((variant) => variant.compareAtPrice !== undefined)) {
      blocks.splice(3, 0, this.block("compare-at-price", "compare-at-price", 4, { visible: true }));
    }
    const howToUse = this.extractVerifiedField(draft, "howToUse");
    if (howToUse !== undefined) {
      blocks.push(this.block("how-to-use", "how-to-use", blocks.length + 1, { source: "verifiedMetadata.howToUse" }));
    }
    const ingredients = this.extractVerifiedField(draft, "ingredients");
    if (ingredients !== undefined) {
      blocks.push(this.block("ingredients", "ingredients", blocks.length + 1, { source: "verifiedMetadata.ingredients" }));
    }
    const sections = [
      this.section("main-product", `product-${this.handle(draft.id)}`, 1, "Product purchase experience", { handle: this.productHandle(draft), mediaReferences: mediaReferences.join(",") }, blocks, locale, markets),
      this.section("collapsible-content", `accordions-${this.handle(draft.id)}`, 2, "Product accordions", { includesShippingReturns: draft.shipping !== undefined, includesFaq: false }, [], locale, markets),
    ];
    return {
      templateId: `templates/product.${this.productHandle(draft)}.json`,
      productDraftId: draft.id,
      handle: this.productHandle(draft),
      title: draft.title,
      blocks,
      sections,
      seoTitle: draft.seo?.title ?? `${draft.title} | ${profile.brandName}`,
      metaDescription: draft.seo?.description ?? draft.description.slice(0, 150),
      structuredDataIntent: "PRODUCT_WITHOUT_REVIEWS",
    };
  }

  private collectionPlans(
    profile: StorefrontProfile,
    drafts: readonly ProductDraft[],
    definitions: readonly StorefrontCollectionInput[] | undefined,
    locale: string,
    markets: readonly string[],
  ): readonly CollectionPagePlan[] {
    const inputs = definitions === undefined || definitions.length === 0
      ? this.defaultCollectionInputs(drafts)
      : definitions;
    return inputs.map((collection, index) => {
      const handle = this.handle(collection.handle ?? collection.title);
      const productIds = collection.productDraftIds ?? drafts
        .filter((draft) => (draft.productType ?? draft.category ?? "").toLowerCase() === collection.title.toLowerCase() || collection.title.toLowerCase() === "best sellers")
        .map((draft) => draft.id);
      return {
        templateId: `templates/collection.${handle}.json`,
        handle,
        title: collection.title,
        description: collection.description ?? `${collection.title} collection for ${profile.brandName}.`,
        productDraftIds: productIds,
        sections: [this.section("main-collection-product-grid", `collection-${handle}`, index + 1, "Collection product grid", { quickAdd: true, showCompareAtPrice: true, ratingSource: "verified-only" }, [], locale, markets)],
        sortControls: ["manual", "best-selling", "price-ascending", "price-descending"],
        filters: ["availability", "price", "product-type"],
        mobileGridBehavior: "2-column mobile grid with large tap targets",
        seoTitle: `${collection.title} | ${profile.brandName}`,
        metaDescription: collection.description ?? `Shop ${collection.title} from ${profile.brandName}.`,
      };
    });
  }

  private navigationPlan(profile: StorefrontProfile, collections: readonly CollectionPagePlan[]): NavigationPlan {
    const mainMenu = [
      this.navItem("shop", "Shop", "/collections/all", 1),
      ...collections.map((collection, index) => this.navItem(`collection-${collection.handle}`, collection.title, `/collections/${collection.handle}`, index + 2, "shop")),
      this.navItem("about", "About", "/pages/about", collections.length + 2),
      this.navItem("contact", "Contact", "/pages/contact", collections.length + 3),
      this.navItem("faq", "FAQ", "/pages/faq", collections.length + 4),
    ];
    const validationWarnings = this.validateNavigation(mainMenu.concat(profile.policyPageReferences));
    return {
      mainMenu,
      mobileMenu: mainMenu,
      footerMenus: profile.footerRequirements.map((label, index) => this.navItem(`footer-${this.handle(label)}`, label, `#${this.handle(label)}`, index + 1)),
      utilityNavigation: [this.navItem("search", "Search", "/search", 1)],
      legalLinks: profile.policyPageReferences,
      validationWarnings,
    };
  }

  private metadataPlan(drafts: readonly ProductDraft[]): StorefrontMetadataPlan {
    const productMetafields: StorefrontMetafieldDefinition[] = [
      this.metafield("custom", "product_benefits", "Product benefits", "Verified product benefit bullets.", "PRODUCT", "list.single_line_text_field", "productDraft.branding.valueProposition"),
      this.metafield("custom", "ingredients", "Ingredients", "Verified product ingredients.", "PRODUCT", "list.single_line_text_field", "verifiedMetadata.ingredients"),
      this.metafield("custom", "how_to_use", "How to use", "Verified usage instructions.", "PRODUCT", "multi_line_text_field", "verifiedMetadata.howToUse"),
      this.metafield("custom", "shipping_summary", "Shipping summary", "Approved shipping summary.", "PRODUCT", "single_line_text_field", "productDraft.shipping"),
      this.metafield("custom", "media_plan_reference", "Media plan reference", "Product media planning reference.", "PRODUCT", "single_line_text_field", "productMediaJob.id"),
    ];
    const metaobjects: StorefrontMetaobjectDefinition[] = [
      this.metaobject("faq_item", "FAQ item", "Reusable FAQ content for product and collection pages.", [this.metafield("custom", "question", "Question", "FAQ question.", "SHOP", "single_line_text_field", "merchantContent.faq.question")]),
      this.metaobject("benefit_item", "Benefit item", "Reusable benefit content.", [productMetafields[0]!]),
      this.metaobject("trust_statement", "Trust statement", "Reusable storefront trust statement.", [this.metafield("custom", "statement", "Statement", "Verified trust statement.", "SHOP", "single_line_text_field", "storefrontProfile.trustStyle")]),
    ];
    if (drafts.some((draft) => this.extractVerifiedField(draft, "ingredients") !== undefined)) {
      metaobjects.push(this.metaobject("ingredient_item", "Ingredient item", "Verified ingredient content.", [productMetafields[1]!]));
    }
    return { productMetafields, metaobjects };
  }

  private themeMapping(
    homepage: HomepagePlan,
    productPages: readonly ProductPagePlan[],
    collections: readonly CollectionPagePlan[],
    metadata: StorefrontMetadataPlan,
  ): ShopifyThemeMapping {
    const templates: StorefrontTemplate[] = [
      this.template("templates/index.json", "index", "homepage", homepage.sections),
      ...productPages.map((page) => this.template(page.templateId, "product", "product-page", page.sections)),
      ...collections.map((collection) => this.template(collection.templateId, "collection", "collection-page", collection.sections)),
    ];
    return {
      templates,
      sectionGroups: homepage.sections.concat(productPages.flatMap((page) => page.sections), collections.flatMap((collection) => collection.sections)),
      settingsFragments: [
        { key: "sections.header.type", value: "header", mergeStrategy: "MERGE_ONLY" },
        { key: "sections.footer.type", value: "footer", mergeStrategy: "MERGE_ONLY" },
      ],
      metafieldDynamicSources: metadata.productMetafields.map((field) => `${field.namespace}.${field.key}`),
    };
  }

  private validatePlan(plan: StorefrontPlan): StorefrontValidationReport {
    const errors: StorefrontValidationIssue[] = [];
    const warnings: StorefrontValidationIssue[] = [];
    const sectionIds = plan.homepage.sections.concat(plan.productPages.flatMap((page) => page.sections), plan.collections.flatMap((collection) => collection.sections)).map((section) => section.id);
    if (new Set(sectionIds).size !== sectionIds.length) {
      errors.push(this.error("DUPLICATE_SECTION_ID", "Duplicate section IDs are not allowed.", "sections"));
    }
    for (const page of plan.productPages) {
      if (page.blocks.some((block) => block.type === "media-gallery") && page.sections[0]?.settings.mediaReferences === "") {
        warnings.push(this.warning("MEDIA_REFERENCES_PENDING", "Product media references are pending or unavailable.", `productPages.${page.productDraftId}.media`));
      }
      if (/(cure|treat|heal|medical|eczema|psoriasis|acne)/iu.test(JSON.stringify(page))) {
        errors.push(this.error("UNVERIFIED_MEDICAL_CLAIM", "Unverified medical or health claims are blocked.", `productPages.${page.productDraftId}`));
      }
    }
    if (/(only today|last chance|limited stock|hurry|selling out)/iu.test(JSON.stringify(plan))) {
      errors.push(this.error("FAKE_URGENCY_BLOCKED", "Fake urgency or scarcity is blocked.", "plan"));
    }
    if (/(five star|5-star|customer reviews|1000 customers|certified|award-winning)/iu.test(JSON.stringify(plan))) {
      errors.push(this.error("UNVERIFIED_SOCIAL_PROOF_BLOCKED", "Unverified reviews, certifications, awards, or customer counts are blocked.", "plan"));
    }
    for (const item of plan.navigation.mainMenu.concat(plan.navigation.legalLinks)) {
      if (!/^\/(collections|pages|search|policies|products|cart|account|$)|^#/.test(item.url)) {
        errors.push(this.error("UNSAFE_EXTERNAL_URL", "Navigation URLs must be safe Shopify-relative URLs.", `navigation.${item.id}`));
      }
    }
    if (plan.navigation.legalLinks.length === 0) {
      warnings.push(this.warning("POLICY_LINKS_MISSING", "Policy links should be configured before deployment.", "navigation.legalLinks"));
    }
    const missingAlt = plan.productPages.filter((page) => page.sections.some((section) => section.requiredAssets.includes("missing-alt-text")));
    if (missingAlt.length > 0) {
      warnings.push(this.warning("IMAGE_ALT_TEXT_PENDING", "Some images need merchant-confirmed alt text.", "productPages.images"));
    }
    return {
      errors,
      warnings: warnings.concat(plan.navigation.validationWarnings.map((warning) => this.warning("NAVIGATION_WARNING", warning, "navigation"))),
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
  }

  private evaluateQuality(plan: StorefrontPlan, validation: StorefrontValidationReport): StorefrontQualityReport {
    const productCompleteness = Math.min(100, Math.round(plan.productPages.reduce((sum, page) => sum + page.blocks.length, 0) / Math.max(1, plan.productPages.length) * 8));
    const homepageCoverage = Math.min(100, plan.homepage.sections.length * 10);
    const navigationQuality = validation.warnings.some((warning) => warning.code === "NAVIGATION_WARNING") ? 70 : 95;
    const metadataCompleteness = Math.min(100, plan.metadata.productMetafields.length * 15 + plan.metadata.metaobjects.length * 10);
    const safety = validation.errors.length === 0 ? 95 : 30;
    const categoryScores = {
      productContentCompleteness: productCompleteness,
      mediaCoverage: plan.productPages.some((page) => page.sections[0]?.settings.mediaReferences !== "") ? 80 : 55,
      homepageCoverage,
      mobileReadiness: 85,
      accessibilityReadiness: validation.warnings.some((warning) => warning.code === "IMAGE_ALT_TEXT_PENDING") ? 70 : 90,
      navigationQuality,
      trustContentReadiness: plan.homepage.sections.some((section) => section.id.includes("brand-promise")) ? 85 : 60,
      seoReadiness: 85,
      metadataCompleteness,
      themeCompatibility: 80,
      safetyCompliance: safety,
    };
    const scores = Object.values(categoryScores);
    const overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    return {
      overallScore,
      categoryScores,
      errors: validation.errors.map((issue) => issue.message),
      warnings: validation.warnings.map((issue) => issue.message),
      recommendations: [
        "Review generated configuration before theme deployment.",
        "Confirm policy links and market-specific shipping content.",
        "Run a rendered storefront preview before claiming visual quality.",
      ],
      requiresHumanReview: true,
      renderedVisualQuality: "UNKNOWN",
    };
  }

  private buildArtifacts(projectId: string, plan: StorefrontPlan, mode: StorefrontExecutionMode): readonly StorefrontArtifact[] {
    const timestamp = this.timestamp();
    const payloads = [
      { type: "JSON_TEMPLATE" as const, path: "storefront-artifacts/generated/preview/templates/index.json", snapshot: plan.homepage },
      { type: "JSON_TEMPLATE" as const, path: "storefront-artifacts/generated/preview/templates/product.json", snapshot: { productPages: plan.productPages } },
      { type: "JSON_TEMPLATE" as const, path: "storefront-artifacts/generated/preview/templates/collection.json", snapshot: { collections: plan.collections } },
      { type: "NAVIGATION_PLAN" as const, path: "storefront-artifacts/generated/preview/navigation.json", snapshot: plan.navigation },
      { type: "METAFIELD_PLAN" as const, path: "storefront-artifacts/generated/preview/metafields.json", snapshot: { productMetafields: plan.metadata.productMetafields } },
      { type: "METAOBJECT_PLAN" as const, path: "storefront-artifacts/generated/preview/metaobjects.json", snapshot: { metaobjects: plan.metadata.metaobjects } },
      { type: "DEPLOYMENT_MANIFEST" as const, path: "storefront-artifacts/generated/preview/deployment-manifest.json", snapshot: { mode, deployable: false, activationRequired: true } },
      { type: "ROLLBACK_MANIFEST" as const, path: "storefront-artifacts/generated/preview/rollback-manifest.json", snapshot: { rollbackRequiredOnlyAfterFutureDeployment: true } },
    ];
    return payloads.map((item, index) => {
      const contentSnapshot = item.snapshot as unknown as Readonly<Record<string, unknown>>;
      return {
        id: `storefront-artifact:${projectId}:${index + 1}`,
        storefrontProjectId: projectId,
        artifactType: item.type,
        path: item.path,
        contentHash: this.hash(contentSnapshot),
        format: "json",
        status: "GENERATED",
        contentSnapshot,
        sourceReferences: plan.productPages.map((page) => page.productDraftId),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  }

  private async createApproval(tenant: TenantContext, projectId: string, brandName: string, requestedBy: string): Promise<string | undefined> {
    if (this.dependencies.approvalRepository === undefined) {
      return undefined;
    }
    const approvalId = `approval:${projectId}`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: projectId,
      title: `Review storefront plan for ${brandName}`,
      status: "pending",
      riskLevel: "LOW",
      requestedBy,
      createdAt: this.timestamp(),
      requestedAt: this.timestamp(),
      requiresHumanApproval: true,
      executionEnabled: false,
      source: "deterministic-preview",
      version: 1,
    });
    return approvalId;
  }

  private async audit(
    tenant: TenantContext,
    storefrontEventType: string,
    entityId: string,
    summary: string,
    correlationId: string | undefined,
    details: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (this.dependencies.auditRepository === undefined) {
      return;
    }
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: `audit:${entityId}:${this.sequence(storefrontEventType)}`,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId,
      actor: "storefront-engine",
      occurredAt: this.timestamp(),
      summary,
      details: { ...details, storefrontEventType },
      source: "deterministic-preview",
      sequence: this.sequence(entityId + storefrontEventType),
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "storefront.engine",
      status: storefrontEventType.includes("blocked") ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.timestamp(),
    });
  }

  private section(
    type: string,
    id: string,
    position: number,
    purpose: string,
    settings: Readonly<Record<string, string | number | boolean | null>>,
    blocks: readonly StorefrontBlock[],
    locale: string,
    markets: readonly string[],
  ): StorefrontSection {
    return {
      type,
      id: `sf-${this.handle(id)}`,
      purpose,
      enabled: true,
      position,
      settings,
      blocks,
      visibilityRules: ["merchant-review-required"],
      marketRules: markets,
      localeRules: [locale],
      mobileBehavior: "mobile-first stacked layout with clear tap targets",
      desktopBehavior: "responsive grid with constrained content width",
      requiredAssets: [],
      requiredContent: [],
      dynamicDataBindings: [],
      validationWarnings: [],
    };
  }

  private block(type: string, id: string, order: number, settings: Readonly<Record<string, string | number | boolean | null>>): StorefrontBlock {
    return {
      type,
      id: `sf-block-${this.handle(id)}`,
      settings,
      order,
      visible: true,
      validationState: "VALID",
    };
  }

  private navItem(id: string, label: string, url: string, order: number, parentId?: string): StorefrontNavigationItem {
    return {
      id,
      label,
      handle: this.handle(label),
      url,
      ...(parentId === undefined ? {} : { parentId }),
      order,
    };
  }

  private defaultPolicyLinks(): readonly StorefrontNavigationItem[] {
    return [
      this.navItem("shipping-policy", "Shipping Policy", "/policies/shipping-policy", 1),
      this.navItem("return-policy", "Return & Refund Policy", "/policies/refund-policy", 2),
      this.navItem("privacy-policy", "Privacy Policy", "/policies/privacy-policy", 3),
      this.navItem("terms", "Terms & Conditions", "/policies/terms-of-service", 4),
    ];
  }

  private defaultCollectionInputs(drafts: readonly ProductDraft[]): readonly StorefrontCollectionInput[] {
    const productTypes = [...new Set(drafts.map((draft) => draft.productType ?? draft.category).filter((value): value is string => value !== undefined))];
    return [
      { title: "Best Sellers", productDraftIds: drafts.map((draft) => draft.id) },
      ...productTypes.map((title): StorefrontCollectionInput => ({ title })),
    ];
  }

  private validateNavigation(items: readonly StorefrontNavigationItem[]): readonly string[] {
    const warnings: string[] = [];
    const handles = items.map((item) => item.handle);
    if (new Set(handles).size !== handles.length) {
      warnings.push("Navigation contains duplicate handles.");
    }
    for (const item of items) {
      let parent = item.parentId;
      const seen = new Set<string>([item.id]);
      while (parent !== undefined) {
        if (seen.has(parent)) {
          warnings.push("Navigation contains circular hierarchy.");
          break;
        }
        seen.add(parent);
        parent = items.find((candidate) => candidate.id === parent)?.parentId;
      }
    }
    if (items.some((item) => item.parentId !== undefined && item.parentId.split("/").length > 3)) {
      warnings.push("Navigation nesting should be reduced.");
    }
    return warnings;
  }

  private metafield(
    namespace: string,
    key: string,
    name: string,
    description: string,
    ownerType: StorefrontMetafieldDefinition["ownerType"],
    dataType: string,
    sourceFieldMapping: string,
  ): StorefrontMetafieldDefinition {
    return {
      namespace,
      key,
      name,
      description,
      ownerType,
      dataType,
      validation: ["merchant-review-required"],
      accessIntent: "STOREFRONT_READ",
      storefrontUsage: "Theme dynamic source planning only; no live definition is created.",
      sourceFieldMapping,
    };
  }

  private metaobject(
    type: string,
    name: string,
    description: string,
    fields: readonly StorefrontMetafieldDefinition[],
  ): StorefrontMetaobjectDefinition {
    return {
      type,
      name,
      description,
      fields,
      storefrontUsage: "Reusable storefront content planning only.",
      sourceFieldMapping: "merchantContent",
    };
  }

  private template(
    path: string,
    type: StorefrontTemplate["type"],
    templateRole: string,
    sections: readonly StorefrontSection[],
  ): StorefrontTemplate {
    return {
      path,
      type,
      templateRole,
      sections: sections.map((section) => section.id),
      payload: {
        sections: Object.fromEntries(sections.map((section) => [section.id, { type: section.type, settings: section.settings, blocks: section.blocks }])),
        order: sections.map((section) => section.id),
      },
    };
  }

  private benefits(draft: ProductDraft): readonly string[] {
    return [
      draft.branding?.valueProposition,
      ...draft.tags.filter((tag) => /benefit|soft|glow|hydrating|premium|natural/iu.test(tag)),
    ].filter((value): value is string => value !== undefined && value.trim().length > 0);
  }

  private extractVerifiedField(draft: ProductDraft, key: string): unknown {
    const payload = draft as unknown as { readonly verifiedMetadata?: Readonly<Record<string, unknown>> };
    return payload.verifiedMetadata?.[key];
  }

  private withGatewayFailureQuality(report: StorefrontQualityReport, message: string): StorefrontQualityReport {
    return {
      ...report,
      errors: report.errors.concat(message),
      requiresHumanReview: true,
    };
  }

  private error(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "ERROR", path };
  }

  private warning(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "WARNING", path };
  }

  private idempotencyKey(input: {
    readonly tenant: TenantContext;
    readonly profile: StorefrontProfile;
    readonly productDraftIds: readonly string[];
    readonly locale: string;
    readonly markets: readonly string[];
    readonly mode: StorefrontExecutionMode;
    readonly themeTarget: StorefrontThemeTarget;
    readonly requestedTemplates?: readonly string[];
  }): string {
    return this.hash({
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      profileVersion: input.profile.version,
      productDraftIds: [...input.productDraftIds].sort(),
      locale: input.locale,
      markets: [...input.markets].sort(),
      mode: input.mode,
      themeTargetReference: input.themeTarget.reference,
      requestedTemplates: [...(input.requestedTemplates ?? [])].sort(),
    });
  }

  private productHandle(draft: ProductDraft): string {
    return draft.seo?.handle ?? this.handle(draft.title);
  }

  private handle(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "item";
  }

  private hash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private requireNonEmptyStrings(values: readonly string[] | undefined, field: string): readonly string[] {
    const normalized = (values ?? []).map((value) => this.optionalText(value)).filter((value): value is string => value !== undefined);
    if (normalized.length === 0) {
      throw AppError.badRequest("Required list must contain at least one value.", { field }, "STOREFRONT_REQUIRED_LIST_EMPTY");
    }
    return normalized;
  }

  private requiredText(value: string | undefined, field: string): string {
    const text = this.optionalText(value);
    if (text === undefined) {
      throw AppError.badRequest("Required text field is missing.", { field }, "STOREFRONT_REQUIRED_FIELD_MISSING");
    }
    return text;
  }

  private optionalText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text === undefined || text.length === 0 ? undefined : text;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private sequence(value: string): number {
    return Math.abs([...value].reduce((sum, character) => sum + character.charCodeAt(0), 0));
  }
}
