# SACP-04.04 — AI Marketing Intelligence Engine

**Organization:** Sireh Digital  
**Platform:** SACP — Sireh AI Commerce Platform  
**Intelligence Layer:** SAIE — Sireh AI Engine  
**Automation Layer:** Hermes  
**Status:** Planned / Ready for implementation  
**Recorded:** 6 August 2026

## Purpose

Build a unified AI marketing intelligence layer that connects content creation, social publishing, Meta Ads analytics, audience intelligence, campaign recommendations, reporting, and approval-controlled execution.

This sprint continues the completed marketing foundation:

- SACP-04.01 — Marketing Intelligence Foundation
- SACP-04.02 — AI Content Generation Engine
- SACP-04.03 — AI Creative Intelligence Engine

## Core Architecture

```text
SAIE
  ↓
AI Marketing Intelligence Engine
  ├── Social Media Intelligence
  ├── Meta Ads Intelligence
  ├── Content Intelligence
  ├── Customer Intelligence
  ├── Marketing Analytics
  └── Founder Approval Layer
  ↓
Hermes Automation
  ├── Facebook
  ├── Instagram
  ├── Threads
  ├── WhatsApp
  ├── Telegram
  └── Meta Ads
```

## Modules

### 1. Social Media Intelligence

- Facebook Page publishing and monitoring
- Instagram publishing and content access
- Threads publishing and monitoring
- WhatsApp communication workflows
- Telegram reporting and approval workflows
- Scheduling, status checks, retry policy, and audit logging

### 2. Meta Ads Intelligence

Hermes reads Marketing API data and SAIE analyses:

- Campaign, ad set, and ad status
- Spend
- Reach and impressions
- CTR
- CPM
- CPC
- Frequency
- Conversions and purchases
- ROAS
- Budget pacing
- Creative fatigue

Initial access must be **read-only**. Any write action requires Founder approval.

### 3. AI Optimization Recommendations

Examples:

- Increase budget when ROAS is strong and frequency remains healthy
- Hold budget when data is insufficient
- Refresh creative when frequency and fatigue increase
- Pause recommendation when cost rises beyond approved thresholds
- Flag tracking, delivery, policy, or attribution issues

Recommendations are advisory until explicitly approved.

### 4. Creative Intelligence

Analyse and score:

- Hook
- Headline
- Primary text
- Description
- CTA
- Image or video concept
- Brand consistency
- Policy risk
- Platform suitability

Output includes a creative score, findings, and recommended revision.

### 5. Customer and Audience Intelligence

- Audience segmentation
- Persona matching
- Behaviour analysis
- Geography and language alignment
- Funnel-stage classification
- Retargeting opportunity detection
- Audience overlap and fatigue indicators

### 6. Marketing Reporting

Daily Founder report through Telegram may include:

- Active campaigns
- Spend yesterday and month-to-date
- Revenue and ROAS
- Best and worst campaigns
- Budget pacing
- Platform health
- Recommended actions
- Founder approvals required

### 7. AI Campaign Builder

Founder provides:

- Product
- Country
- Target audience
- Budget
- Objective
- Creative assets
- Schedule

Hermes prepares campaign, ad set, ads, targeting, placements, tracking, and preview. It must stop at the approval gate before publishing.

## Safety and Governance

Hermes must not perform any of the following without explicit Founder approval:

- Publish a campaign
- Increase or reduce budget
- Pause or resume campaigns
- Delete campaigns, ad sets, or ads
- Change targeting
- Replace production creative
- Rotate tokens or credentials
- Modify tracking or production settings

All secrets must remain outside Git and must never appear in logs or reports.

## Current Integration Baseline

As of 6 August 2026:

- Threads API connection: verified
- Threads controlled test publish: successful
- Instagram API read-only connection: verified
- Facebook Page API read-only connection: verified
- Credentials separated by platform in local `.env` files
- Hermes controlled publishing foundation: initiated
- Meta Ads Marketing API: pending setup

## Delivery Phases

### Phase A — Read-only Intelligence

- Connect Meta Marketing API
- Verify ad account, Page, Instagram, Pixel, and Business Portfolio
- Read campaigns, ad sets, ads, and insights
- Generate daily reports
- No campaign mutation

### Phase B — Recommendation Engine

- SAIE scoring and anomaly detection
- Budget, creative, and audience recommendations
- Founder approval queue
- Recommendation audit trail

### Phase C — Controlled Execution

- Draft campaign creation
- Preview and validation
- Explicit approval gate
- Controlled publish and rollback procedure

### Phase D — SACP Integration

```text
Product Discovery
  ↓
SACP Product Scoring
  ↓
SAIE Marketing Analysis
  ↓
AI Content and Creative Generation
  ↓
Hermes Social Publishing and Meta Ads Draft
  ↓
Founder Approval
  ↓
Controlled Execution
  ↓
Performance Feedback to SAIE
```

## Success Criteria

- Accurate read-only reporting across connected Meta assets
- No credentials committed to Git
- No production action without approval
- Repeatable campaign and content workflow
- Traceable audit logs
- Daily executive summary through Telegram
- Closed feedback loop between campaign performance, SAIE, Hermes, and SACP

## Next Action

Start **SACP-04.04A — Meta Ads Read-Only Intelligence Foundation** after the Meta social publishing foundation is stable.
