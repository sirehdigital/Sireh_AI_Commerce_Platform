# Storefront Module

SACP-03.03A activates the Shopify Storefront Foundation.

SACP-03.03B activates deterministic storefront planning only.

SACP-03.03C activates deterministic Shopify theme mapping and preview models only.

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

The module intentionally does not deploy, activate, or mutate Shopify storefront assets. It does not publish products, upload media, create live metafields, create metaobjects, overwrite theme files, or claim Shopify preview URLs.

Homepage planners, product page planners, collection planners, navigation planners, validation, planning score, theme mapping, preview artifact persistence, approval, and audit integration are active through SACP-03.03C. Theme gateways, production artifact generators, Shopify uploads, metafield/metaobject creation, deployment helpers, theme activation, and rollback execution remain reserved for SACP-03.03D through SACP-03.03F. They remain in source control as internal future implementation unless explicitly wired by a later approved sprint.
