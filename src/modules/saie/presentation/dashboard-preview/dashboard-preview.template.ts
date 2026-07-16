import type { DashboardAgentStatus, DashboardIntegrationStatus, DashboardViewModel } from "./dashboard-preview.types.js";

export const renderDashboardPreviewHtml = (viewModel: DashboardViewModel): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(viewModel.engineName)} | ${escapeHtml(viewModel.version)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --panel: #0f1b2d;
        --panel-2: #13243a;
        --line: #243654;
        --text: #eef5ff;
        --muted: #9fb0c7;
        --accent: #39d0c8;
        --ok: #7ee787;
        --planned: #f2cc60;
        --disabled: #f87171;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.5;
      }
      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 260px 1fr;
      }
      .sidebar {
        border-right: 1px solid var(--line);
        background: #0a1526;
        padding: 28px 22px;
      }
      .brand {
        display: grid;
        gap: 6px;
        margin-bottom: 32px;
      }
      .brand h1 {
        margin: 0;
        font-size: 24px;
        letter-spacing: 0;
      }
      .brand p, .meta {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }
      .nav {
        display: grid;
        gap: 10px;
      }
      .nav span {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.02);
      }
      main {
        padding: 28px;
        max-width: 1240px;
        width: 100%;
      }
      .hero {
        display: grid;
        gap: 14px;
        margin-bottom: 24px;
      }
      .hero h2 {
        margin: 0;
        font-size: 34px;
        letter-spacing: 0;
      }
      .badges, .grid, .workflow, .safety-list, .footer-line {
        display: grid;
        gap: 12px;
      }
      .badges {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .badge, .card, .step, .safety-item {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      .badge {
        padding: 14px;
      }
      .label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }
      .value {
        display: block;
        margin-top: 4px;
        font-weight: 700;
      }
      section {
        margin-top: 24px;
      }
      section h3 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .card {
        padding: 16px;
      }
      .card strong {
        display: block;
        margin-bottom: 8px;
      }
      .status {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .status.ready, .status.operational { color: var(--ok); border-color: rgba(126, 231, 135, 0.45); }
      .status.planned { color: var(--planned); border-color: rgba(242, 204, 96, 0.45); }
      .status.disabled { color: var(--disabled); border-color: rgba(248, 113, 113, 0.45); }
      .workflow {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        align-items: stretch;
      }
      .step {
        min-height: 84px;
        display: grid;
        place-items: center;
        padding: 12px;
        text-align: center;
        position: relative;
      }
      .step:not(:last-child)::after {
        content: "↓";
        position: absolute;
        right: -14px;
        top: 50%;
        transform: translateY(-50%) rotate(-90deg);
        color: var(--accent);
      }
      .safety-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .safety-item {
        padding: 14px;
        color: var(--text);
      }
      footer {
        margin-top: 32px;
        border-top: 1px solid var(--line);
        padding-top: 18px;
        color: var(--muted);
      }
      .footer-line {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      @media (max-width: 900px) {
        .shell { grid-template-columns: 1fr; }
        .sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
        .badges, .grid, .workflow, .safety-list, .footer-line { grid-template-columns: 1fr; }
        .step:not(:last-child)::after {
          right: 50%;
          top: auto;
          bottom: -20px;
          transform: translateX(50%);
        }
        .step { margin-bottom: 12px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar" aria-label="Dashboard navigation">
        <div class="brand">
          <h1>${escapeHtml(viewModel.engineName)}</h1>
          <p>${escapeHtml(viewModel.subtitle)}</p>
          <p class="meta">${escapeHtml(viewModel.version)}</p>
        </div>
        <nav class="nav" aria-label="Preview sections">
          <span>System Overview</span>
          <span>Agent Status</span>
          <span>Workflow Preview</span>
          <span>Safety Summary</span>
          <span>Integrations</span>
        </nav>
      </aside>
      <main>
        <header class="hero">
          <h2>${escapeHtml(viewModel.subtitle)}</h2>
          <div class="badges">
            ${renderBadge("Version", viewModel.version)}
            ${renderBadge("Build", viewModel.build)}
            ${renderBadge("Environment", viewModel.environmentLabel)}
            ${renderBadge("Release", viewModel.systemOverview.releaseChannel)}
          </div>
        </header>
        <section aria-labelledby="system-overview">
          <h3 id="system-overview">System Overview</h3>
          <div class="grid">
            ${renderBadge("Engine Status", viewModel.systemOverview.engineStatus)}
            ${renderBadge("Safety Mode", viewModel.systemOverview.safetyMode)}
            ${renderBadge("Execution Mode", viewModel.systemOverview.executionMode)}
            ${renderBadge("Shopify Integration", viewModel.systemOverview.shopifyIntegration)}
            ${renderBadge("Release Channel", viewModel.systemOverview.releaseChannel)}
          </div>
        </section>
        <section aria-labelledby="agent-status">
          <h3 id="agent-status">Agent Status Cards</h3>
          <div class="grid">${viewModel.agents.map(renderAgent).join("")}</div>
        </section>
        <section aria-labelledby="workflow-preview">
          <h3 id="workflow-preview">Executive Workflow Preview</h3>
          <div class="workflow">${viewModel.workflowSteps.map(renderStep).join("")}</div>
        </section>
        <section aria-labelledby="safety-summary">
          <h3 id="safety-summary">Safety Summary</h3>
          <div class="safety-list">${viewModel.safetyControls.map(renderSafetyControl).join("")}</div>
        </section>
        <section aria-labelledby="integration-status">
          <h3 id="integration-status">Integration Status Preview</h3>
          <div class="grid">${viewModel.integrations.map(renderIntegration).join("")}</div>
        </section>
        <footer>
          <div class="footer-line">
            <span>${escapeHtml(viewModel.footer.company)}</span>
            <span>${escapeHtml(viewModel.footer.tagline)}</span>
            <span>${escapeHtml(viewModel.footer.poweredBy)}</span>
            <span>${escapeHtml(viewModel.footer.version)}</span>
          </div>
        </footer>
      </main>
    </div>
  </body>
</html>`;

const renderBadge = (label: string, value: string): string => `
  <div class="badge">
    <span class="label">${escapeHtml(label)}</span>
    <span class="value">${escapeHtml(value)}</span>
  </div>`;

const renderAgent = (agent: DashboardAgentStatus): string => `
  <article class="card">
    <strong>${escapeHtml(agent.name)}</strong>
    <span class="status ${agent.tone}">${escapeHtml(agent.status)}</span>
  </article>`;

const renderIntegration = (integration: DashboardIntegrationStatus): string => `
  <article class="card">
    <strong>${escapeHtml(integration.name)}</strong>
    <span class="status ${integration.tone}">${escapeHtml(integration.status)}</span>
  </article>`;

const renderStep = (step: string): string => `<div class="step">${escapeHtml(step)}</div>`;

const renderSafetyControl = (control: string): string => `<div class="safety-item">${escapeHtml(control)}</div>`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
