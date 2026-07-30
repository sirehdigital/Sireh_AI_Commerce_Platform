# Storefront Module

SACP-03.03A activates the Shopify Storefront Foundation.

SACP-03.03B activates deterministic storefront planning only.

SACP-03.03C activates deterministic Shopify theme mapping and preview models only.

SACP-03.03D activates deterministic theme artifact preview bundle generation only.

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

The module intentionally does not deploy, activate, or mutate Shopify storefront assets. It does not publish products, upload media, create live metafields, create metaobjects, generate Liquid, export ZIP files, overwrite theme files, or claim Shopify preview URLs.

Homepage planners, product page planners, collection planners, navigation planners, validation, planning score, theme mapping, preview artifact persistence, preview bundle generation, approval, and audit integration are active through SACP-03.03D. Theme gateways, Shopify uploads, metafield/metaobject creation, deployment helpers, theme activation, ZIP export, Liquid generation, and rollback execution remain reserved for later approved sprints. They remain in source control as internal future implementation unless explicitly wired by a later approved sprint.
