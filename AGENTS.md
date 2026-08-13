# SACP — AGENTS.md
Sireh AI Commerce Platform
Shared Engineering Context for Founder / Seri / Suri-Codex

## 1. Project Identity

Project:
Sireh AI Commerce Platform (SACP)

Repository:
Sireh_AI_Commerce_Platform

Purpose:
AI-powered commerce execution platform integrating Shopify,
product intelligence, marketing intelligence, automation,
reporting and controlled execution.

SACP is part of the Sireh Digital AI ecosystem.

---

## 2. Sireh Digital AI Ecosystem

SIREH DIGITAL

SAIL
Sireh AI Innovation Lab
→ Research & Development

SACReS
Sireh AI Commerce Research Series
→ Market / product / competitor research

SACHI
Sireh AI Commerce Intelligence
→ Analytics, insights and decision intelligence

SAIE
Sireh AI Engine
→ Intelligence / reasoning layer

SACP
Sireh AI Commerce Platform
→ Commerce execution layer

---

## 3. Agent Operating Model

Founder
→ Business authority and final approval

Seri / ChatGPT
→ Strategy
→ Architecture
→ Product planning
→ Workflow design
→ Requirement definition
→ Governance
→ Cross-project coordination

Suri / Codex
→ Repository inspection
→ Engineering implementation
→ Refactoring
→ Testing
→ Validation
→ Git operations
→ Deployment only when approved

Hermes
→ Automation / operations layer
→ Scheduled workflows
→ Telegram / operational agents
→ Monitoring and execution coordination

Other coding/review models
→ Independent review / research only unless explicitly approved

IMPORTANT:
Codex remains the primary coding agent for the project.
Do not introduce competing architecture without Founder approval.

---

## 4. Engineering Principles

1. Preserve existing architecture.
2. Prefer ports/adapters and clear module boundaries.
3. Keep business logic deterministic where possible.
4. Separate intelligence from execution.
5. Production mutations require explicit approval.
6. Secrets must never be committed or logged.
7. Avoid broad refactors during scoped feature work.
8. Every major feature requires tests.
9. Existing passing behavior must not regress.
10. Read repository state before implementation.

---

## 5. Current Platform Architecture

Business Layer
Founder + Seri

Engineering Layer
Suri / Codex

Automation Layer
Hermes

Commerce Layer
Shopify + SACP services

AI / Intelligence Layer
SAIE + campaign / creative / product intelligence modules

Current backend infrastructure
Node.js 22+
TypeScript
Express
Prisma
SQLite development datastore
Shopify Admin GraphQL API integrations

Cloudflare or other production deployment infrastructure is not established by the current repository and must be treated as future or environment-specific until approved and documented.

---

## 6. Current Commerce Capabilities

Implemented foundations include:

- Shopify OAuth / HMAC validation
- Session hardening
- Product Draft Creation
- AI Product Hunter
- WinningHunter Product Discovery
- AI Marketing Engine
- Draft Publisher
- Inventory & Pricing Sync
- Order Sync
- Commerce Orchestrator
- Commerce Reconciliation
- AI Creative Intelligence
- AI Campaign Strategy
- Marketing Execution Foundation
- AI Marketing Team governance and specialist services

These are repository capabilities and foundations; they do not imply that production execution or external platform deployment is enabled.

Do not duplicate existing capabilities.
Inspect implementation before adding new modules.

---

## 7. Product Intelligence Scoring

The AI Product Hunter candidate model uses these weights:

Profit margin             30
Sales demand              20
Supplier rating           15
Delivery speed            15
Trend strength            10
Competition opportunity   10

WinningHunter Product Discovery has a separate opportunity-scoring model:

Advertising demand        25
Market breadth            15
Longevity                 15
Momentum                  15
Advertiser scaling        10
Creative validation       10
Evidence quality          10

Do not change either scoring model or its weights unless explicitly approved.

---

## 8. Marketing Architecture

Current specialist roles:

MISS HERMES
AI Marketing Director

MAYA
Market Intelligence Agent

ARIA
Campaign Strategy Agent

LUNA
Content & Copy Agent

LYLA
Creative Strategy Agent

DIANA
Paid Media Agent

SUZI
Marketing Performance Analyst

MIRA
Brand, Quality & Compliance Agent

The marketing-team implementation is proposal-only. Its registered agents cannot execute production actions, use production credentials, publish or schedule, mutate campaigns, or mutate Shopify.

Keep responsibilities and governance separated.

---

## 9. Campaign Safety Model

AI may:

- analyze
- recommend
- prepare
- simulate
- score
- generate drafts

AI must stop for Founder approval before:

- publishing campaigns
- changing production budgets
- pausing/resuming campaigns
- deleting campaigns
- modifying targeting
- replacing production creative
- changing production tracking
- rotating credentials

---

## 10. Current Roadmap Status

Current roadmap phase:
Phase 04 — Marketing Intelligence

Latest completed SACP-numbered milestone:
SACP-04.05A — Marketing Execution Foundation
Commit `d651c97`, tag `sacp-04.05a`

Latest completed repository milestone:
MARKETING-TEAM-01G — Mira Brand Quality & Compliance Agent
Commit `7b74d70`, tag `marketing-team-01g`

MARKETING-TEAM-01A through MARKETING-TEAM-01G are complete in repository history but are not yet incorporated into the dated canonical Phase 04–10 roadmap.

The next SACP-numbered milestone is not established as active by current repository evidence. SACP-04.06 is planned in the canonical roadmap, but work must not be described as active or approved without Founder confirmation.

---

## 11. Current Engineering Baseline

Before starting any task:

1. git status
2. current branch
3. latest commits
4. roadmap / active phase
5. test baseline
6. relevant module architecture
7. uncommitted changes

Never assume README is authoritative if repository history
or roadmap documents show a newer state. The README sprint statement is currently stale and must not be used as the active SACP milestone.

---

## 12. Git Rules

Default branch:
main

Before coding:

- confirm working-tree state and preserve unrelated user changes
- inspect remote tracking status; fetch or pull only when the task and authorization require it
- inspect recent commits
- identify active milestone

Do not:

- force push
- reset
- rebase
- merge
- delete branches
- rewrite history

unless explicitly instructed.

Feature work should remain logically scoped.

---

## 13. Testing Requirements

Minimum validation before handoff:

- focused tests
- full test suite where environment permits
- TypeScript typecheck
- lint
- build
- format check where applicable

If a validation cannot run because of environment limitations,
report it explicitly.

Never report environment failure as a passing test.

---

## 14. Production Safety

Do not deploy automatically.

Before production deployment:

1. Founder approval
2. clean working tree
3. committed changes
4. tests validated
5. build validated
6. production configuration reviewed
7. secrets confirmed external to Git
8. migration impact reviewed

---

## 15. Database / Migration Rules

Never:

- reset production database
- delete production data
- apply migration blindly
- seed production without approval

For every migration:

1. inspect current schema
2. create additive migration where possible
3. test locally
4. report migration impact
5. wait for Founder approval
6. backup production when appropriate

---

## 16. Shopify Safety

Default behavior:

READ
ANALYZE
PREPARE
DRAFT

Publishing / mutations require explicit Founder approval.

Never expose Shopify access tokens.

---

## 17. Secrets

Secrets must live outside Git.

Examples:

- Shopify credentials
- Meta tokens
- Threads tokens
- WhatsApp credentials
- API keys
- Cloudflare credentials

Never:

- print secrets
- commit secrets
- place secrets in reports
- place secrets in test fixtures

---

## 18. Task Execution Protocol

For every engineering task:

DISCOVER
→ inspect repository

UNDERSTAND
→ identify current architecture

PLAN
→ define smallest safe change

IMPLEMENT
→ scoped code change

VALIDATE
→ tests / typecheck / lint / build

REPORT
→ files, tests, risks, next step

STOP
→ wait for Founder approval where required

---

## 19. Handoff Format

Every Codex handoff should return:

1. Summary
2. Files created
3. Files changed
4. Architecture impact
5. Tests
6. Typecheck
7. Lint
8. Build
9. Git status
10. Risks / blockers
11. Deployment status
12. Recommended next task

---

## 20. Cross-Agent Context Rule

Seri designs strategy and requirements.

Suri reads:

- this AGENTS.md
- current repository
- roadmap
- latest Git history

Repository state remains the technical source of truth.

If Seri's planning context conflicts with repository reality:
STOP and report the conflict before modifying code.

---

## 21. Founder Authority

The Founder has final authority over:

- architecture changes
- production deployment
- database migration
- campaign execution
- budget changes
- external integrations
- credential changes
- project priorities

When uncertain:
STOP and ask for Founder decision.
