# Product Media Engine

`product-media` is an SACP commerce module for creating reviewable, Shopify-ready product media plans and generated-media records from approved or reviewable Product Draft data.

## Lifecycle

Jobs support `DRAFT`, `PLANNED`, `VALIDATING`, `READY_FOR_GENERATION`, `GENERATING`, `PARTIALLY_GENERATED`, `GENERATED`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `FAILED`, and `CANCELLED`.

Successful plan-only and generated jobs end at `PENDING_REVIEW` or `PARTIALLY_GENERATED`; generated media is never auto-approved.

## Asset Types

The planner supports `PRODUCT_HERO`, `PRODUCT_GALLERY`, `LIFESTYLE`, `BENEFIT_CARD`, `INGREDIENT_CARD`, `HOW_TO_USE`, `FEATURE_HIGHLIGHT`, `COLLECTION_TILE`, `SOCIAL_SQUARE`, `SOCIAL_VERTICAL`, `AD_CREATIVE`, and `THUMBNAIL`.

Centralized specifications define aspect ratio, dimensions, format, channel, safe area, text-overlay policy, and source-reference guidance.

## Planning and Safety

The deterministic planner consumes Product Draft title, description, tags, branding, images, target markets, and optional brand-media overrides. It skips ingredient or how-to assets when verified data is missing.

Prompt generation includes product identity, brand direction, composition, lighting, background, aspect ratio, target channel, and strict anti-hallucination constraints. The safety validator blocks unsupported medical claims, before/after imagery, unsafe URLs, malformed dimensions, excessive asset requests, and trademark-risk language.

Visual quality remains `UNKNOWN` unless a real vision-capable evaluator is configured in a future sprint.

## Provider and Storage Boundaries

Generation uses a provider-neutral `ProductMediaGenerationProvider`. This sprint includes a deterministic fake provider for tests and a disabled provider that fails safely when generation is requested without configuration.

Storage is provider-neutral metadata only. Binary image data is not stored in Prisma, and no Shopify Files upload exists in this sprint.

## Persistence

Prisma models:

- `ProductMediaJob`
- `ProductMediaAsset`

Jobs persist tenant/store context, product draft ID, mode, status, provider ID, brand/profile snapshot, plan snapshot, quality report, warnings, failure details, approval ID, audit reference, correlation ID, and history linkage.

Assets persist media job ID, type, purpose, status, dimensions, prompt snapshot, source references, provider reference, safe output URL/storage key, alt text, and review metadata.

## API

Mounted at `/api/product-media`:

- `POST /jobs`
- `GET /jobs`
- `GET /jobs/:jobId`
- `GET /jobs/:jobId/status`

`POST /jobs` defaults to `PLAN_ONLY` unless `mode: "GENERATE"` is explicitly supplied. `GENERATE` requires a configured provider and otherwise fails safely.

## Approval and Audit

Every successful job requests a pending human approval with execution disabled. Audit events cover plan creation, generation success/partial failure, validation blocking, provider failure, and idempotent replay.

## Known Limitations

No external image provider, Shopify upload, binary asset storage, scraping, or actual visual inspection is implemented. Real provider adapters should be added only with official API documentation, secret-safe configuration, and tests that do not call live networks.
