export type StorefrontExecutionMode = "PLAN_ONLY" | "GENERATE_ARTIFACTS";

export type StorefrontProjectStatus =
  | "DRAFT"
  | "PLANNING"
  | "PLANNED"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "PREVIEW_READY"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "READY_FOR_DEPLOYMENT"
  | "DEPLOYING"
  | "DEPLOYED"
  | "FAILED"
  | "CANCELLED";

export type StorefrontPreviewStatus = "CONFIGURATION_PREVIEW" | "ARTIFACT_PREVIEW" | "FAILED";
export type StorefrontArtifactType = "JSON_TEMPLATE" | "SECTION_CONFIG" | "METAFIELD_PLAN" | "METAOBJECT_PLAN" | "NAVIGATION_PLAN" | "DEPLOYMENT_MANIFEST" | "ROLLBACK_MANIFEST";
export type StorefrontArtifactStatus = "PLANNED" | "GENERATED" | "FAILED";
export type StorefrontThemeTargetType = "EXISTING_THEME_REFERENCE" | "DRAFT_THEME_REFERENCE" | "UNKNOWN";
export type StorefrontVisualQuality = "UNKNOWN" | "PASSED" | "FAILED";

export interface StorefrontThemeTarget {
  readonly type: StorefrontThemeTargetType;
  readonly reference: string;
  readonly themeName?: string;
}

export interface StorefrontProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly version: number;
  readonly brandName: string;
  readonly brandPositioning: string;
  readonly targetMarkets: readonly string[];
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly currency: string;
  readonly industry: string;
  readonly visualIdentity: readonly string[];
  readonly preferredColorPalette: readonly string[];
  readonly typographyDirection: string;
  readonly toneOfVoice: readonly string[];
  readonly photographyDirection: string;
  readonly trustStyle: readonly string[];
  readonly targetCustomer: readonly string[];
  readonly merchandisingPriorities: readonly string[];
  readonly navigationPreferences: readonly string[];
  readonly homepagePriorities: readonly string[];
  readonly productPagePriorities: readonly string[];
  readonly footerRequirements: readonly string[];
  readonly policyPageReferences: readonly StorefrontNavigationItem[];
  readonly socialLinks: readonly StorefrontNavigationItem[];
  readonly contactReferences: readonly StorefrontNavigationItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorefrontBlock {
  readonly type: string;
  readonly id: string;
  readonly settings: Readonly<Record<string, string | number | boolean | null>>;
  readonly order: number;
  readonly dataSource?: string;
  readonly visible: boolean;
  readonly validationState: "VALID" | "WARNING" | "BLOCKED";
}

export interface StorefrontSection {
  readonly type: string;
  readonly id: string;
  readonly purpose: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly settings: Readonly<Record<string, string | number | boolean | null>>;
  readonly blocks: readonly StorefrontBlock[];
  readonly visibilityRules: readonly string[];
  readonly marketRules: readonly string[];
  readonly localeRules: readonly string[];
  readonly mobileBehavior: string;
  readonly desktopBehavior: string;
  readonly requiredAssets: readonly string[];
  readonly requiredContent: readonly string[];
  readonly dynamicDataBindings: readonly string[];
  readonly validationWarnings: readonly string[];
}

export interface HomepagePlan {
  readonly templateId: string;
  readonly title: string;
  readonly seoTitle: string;
  readonly metaDescription: string;
  readonly sections: readonly StorefrontSection[];
}

export interface ProductPagePlan {
  readonly templateId: string;
  readonly productDraftId: string;
  readonly handle: string;
  readonly title: string;
  readonly blocks: readonly StorefrontBlock[];
  readonly sections: readonly StorefrontSection[];
  readonly seoTitle: string;
  readonly metaDescription: string;
  readonly structuredDataIntent: "PRODUCT_WITHOUT_REVIEWS";
}

export interface CollectionPagePlan {
  readonly templateId: string;
  readonly handle: string;
  readonly title: string;
  readonly description: string;
  readonly productDraftIds: readonly string[];
  readonly sections: readonly StorefrontSection[];
  readonly sortControls: readonly string[];
  readonly filters: readonly string[];
  readonly mobileGridBehavior: string;
  readonly seoTitle: string;
  readonly metaDescription: string;
}

export interface StorefrontNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly handle: string;
  readonly url: string;
  readonly parentId?: string;
  readonly order: number;
}

export interface NavigationPlan {
  readonly mainMenu: readonly StorefrontNavigationItem[];
  readonly mobileMenu: readonly StorefrontNavigationItem[];
  readonly footerMenus: readonly StorefrontNavigationItem[];
  readonly utilityNavigation: readonly StorefrontNavigationItem[];
  readonly legalLinks: readonly StorefrontNavigationItem[];
  readonly validationWarnings: readonly string[];
}

export interface StorefrontMetafieldDefinition {
  readonly namespace: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly ownerType: "PRODUCT" | "COLLECTION" | "SHOP";
  readonly dataType: string;
  readonly validation: readonly string[];
  readonly accessIntent: "STOREFRONT_READ";
  readonly storefrontUsage: string;
  readonly sourceFieldMapping: string;
}

export interface StorefrontMetaobjectDefinition {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly fields: readonly StorefrontMetafieldDefinition[];
  readonly storefrontUsage: string;
  readonly sourceFieldMapping: string;
}

export interface StorefrontMetadataPlan {
  readonly productMetafields: readonly StorefrontMetafieldDefinition[];
  readonly metaobjects: readonly StorefrontMetaobjectDefinition[];
}

export interface ShopifyThemeMapping {
  readonly templates: readonly StorefrontTemplate[];
  readonly sectionGroups: readonly StorefrontSection[];
  readonly settingsFragments: readonly StorefrontThemeSettingsFragment[];
  readonly metafieldDynamicSources: readonly string[];
}

export interface StorefrontTemplate {
  readonly path: string;
  readonly type: "index" | "product" | "collection";
  readonly templateRole: string;
  readonly sections: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface StorefrontThemeSettingsFragment {
  readonly key: string;
  readonly value: string | number | boolean | null;
  readonly mergeStrategy: "MERGE_ONLY";
}

export interface StorefrontArtifact {
  readonly id: string;
  readonly storefrontProjectId: string;
  readonly artifactType: StorefrontArtifactType;
  readonly path: string;
  readonly contentHash: string;
  readonly format: "json" | "md" | "liquid-plan";
  readonly status: StorefrontArtifactStatus;
  readonly contentSnapshot: Readonly<Record<string, unknown>>;
  readonly sourceReferences: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorefrontValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "ERROR" | "WARNING";
  readonly path: string;
}

export interface StorefrontValidationReport {
  readonly errors: readonly StorefrontValidationIssue[];
  readonly warnings: readonly StorefrontValidationIssue[];
  readonly blockedReasons: readonly string[];
  readonly requiresHumanReview: boolean;
}

export interface StorefrontQualityReport {
  readonly overallScore: number;
  readonly categoryScores: Readonly<Record<string, number>>;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly string[];
  readonly requiresHumanReview: boolean;
  readonly renderedVisualQuality: StorefrontVisualQuality;
}

export interface StorefrontPlan {
  readonly profile: StorefrontProfile;
  readonly homepage: HomepagePlan;
  readonly productPages: readonly ProductPagePlan[];
  readonly collections: readonly CollectionPagePlan[];
  readonly navigation: NavigationPlan;
  readonly metadata: StorefrontMetadataPlan;
  readonly themeMapping: ShopifyThemeMapping;
}

export interface StorefrontPreview {
  readonly id: string;
  readonly storefrontProjectId: string;
  readonly planSnapshot: StorefrontPlan;
  readonly generatedArtifactReferences: readonly string[];
  readonly themeTarget: StorefrontThemeTarget;
  readonly selectedProductDraftIds: readonly string[];
  readonly qualityReport: StorefrontQualityReport;
  readonly validationReport: StorefrontValidationReport;
  readonly previewStatus: StorefrontPreviewStatus;
  readonly previewUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorefrontProject {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly status: StorefrontProjectStatus;
  readonly mode: StorefrontExecutionMode;
  readonly brandName: string;
  readonly themeTargetReference: string;
  readonly selectedProductDraftIds: readonly string[];
  readonly locale: string;
  readonly markets: readonly string[];
  readonly idempotencyKey: string;
  readonly planSnapshot: StorefrontPlan;
  readonly validationSnapshot: StorefrontValidationReport;
  readonly qualitySnapshot: StorefrontQualityReport;
  readonly approvalId?: string;
  readonly correlationId?: string;
  readonly parentProjectId?: string;
  readonly failureStage?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface StorefrontProjectListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly status?: StorefrontProjectStatus;
  readonly locale?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface StorefrontProfileListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface StorefrontProfileListResult {
  readonly items: readonly StorefrontProfile[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

export interface StorefrontProjectListResult {
  readonly items: readonly StorefrontProject[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}
