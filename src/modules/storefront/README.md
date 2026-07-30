# Storefront Module

SACP-03.03A activates the Shopify Storefront Foundation.

SACP-03.03B activates deterministic storefront planning only.

SACP-03.03C activates deterministic Shopify theme mapping and preview models only.

SACP-03.03D activates deterministic theme artifact preview bundle generation only.

SACP-03.03E activates safe Shopify deployment planning, compatibility validation, package metadata, draft upload abstraction, rollback preparation, deployment health, and release readiness only.

SACP-03.03F activates the controlled production launch orchestration boundary.

The active public boundary is limited to:

- `StorefrontProfile`
- `StorefrontProject`
- `StorefrontFoundationService`
- repository persistence
- REST endpoints for profiles, projects, project status, and lifecycle transitions
- approval records
- audit records
- `PLAN_ONLY` execution
- deterministic homepage, product page, collection, and navigation planning
- planning validation
- deterministic planning score
- REST endpoints for storing and reading a complete storefront plan
- Shopify theme mapping models for homepage, product, collection, navigation, sections, blocks, dynamic sources, theme settings, metafields, and metaobjects
- REST endpoints for creating and reading theme mapping previews
- repository-backed preview artifact persistence
- deterministic preview artifact generation for `theme-preview/*.json`
- manifest and bundle metadata generation
- artifact validation score
- REST endpoints for artifact preview bundles and validation
- safe deployment planning and compatibility checks
- deployment package metadata without ZIP generation
- injectable draft theme upload gateway with NoOp default behavior
- rollback preparation metadata
- deployment health reporting
- `READY_FOR_RELEASE` status before production launch
- REST endpoints for deployment plan, deployment, deployment history, and deployment health
- production readiness validation
- injected theme activation boundary
- release metadata, release history, release summary, and rollback metadata
- REST endpoints for release, release history, and rollback

The module intentionally does not publish products, upload media, create live metafields, create metaobjects, generate Liquid, export ZIP files, overwrite theme files, activate themes, or claim Shopify preview URLs during safe deployment. Production activation is disabled by default and requires an injected deployment verifier plus activation gateway that confirms the previous deployment safety gates.

Homepage planners, product page planners, collection planners, navigation planners, validation, planning score, theme mapping, preview artifact persistence, preview bundle generation, safe deployment orchestration, deployment health, production launch orchestration, release metadata, rollback metadata, approval, and audit integration are active through SACP-03.03F. Live Shopify uploads, metafield/metaobject creation, ZIP export, Liquid generation, direct product/media publishing, and theme activation outside the production launch gateway remain reserved for later approved sprints. They remain in source control as internal future implementation unless explicitly wired by a later approved sprint.
