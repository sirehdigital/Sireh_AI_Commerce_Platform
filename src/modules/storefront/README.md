# Storefront Module

SACP-03.03A activates the Shopify Storefront Foundation.

SACP-03.03B activates deterministic storefront planning only.

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

The module intentionally does not deploy, activate, or mutate Shopify storefront assets. It does not publish products, upload media, create live metafields, create metaobjects, overwrite theme files, or claim Shopify preview URLs.

Homepage planners, product page planners, collection planners, navigation planners, validation, and planning score are active in SACP-03.03B. Theme gateways, artifact generators, preview models, metafield/metaobject planning, and deployment helpers remain reserved for SACP-03.03C through SACP-03.03F. They remain in source control as internal future implementation, but they are not wired into REST execution and are not required by SACP-03.03B tests.
