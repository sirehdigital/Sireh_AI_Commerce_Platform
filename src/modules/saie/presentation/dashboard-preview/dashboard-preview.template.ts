import type {
  DashboardAgentCapability,
  DashboardAgentStatus,
  DashboardIntegrationGroup,
  DashboardIntegrationStatus,
  DashboardKpiCard,
  DashboardReleaseTimelineItem,
  DashboardViewModel,
} from "./dashboard-preview.types.js";

export const renderDashboardPreviewHtml = (viewModel: DashboardViewModel): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(viewModel.engineName)} | ${escapeHtml(viewModel.build)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07101d;
        --bg-soft: #0b1627;
        --panel: rgba(18, 31, 52, 0.88);
        --panel-strong: rgba(24, 40, 66, 0.96);
        --line: rgba(138, 160, 190, 0.22);
        --text: #edf5ff;
        --muted: #a8b6c9;
        --accent: #4dd8cf;
        --accent-2: #8fb7ff;
        --ok: #7ee787;
        --planned: #f1c95f;
        --danger: #ff8b8b;
        --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        min-width: 320px;
        background:
          radial-gradient(circle at top left, rgba(77, 216, 207, 0.16), transparent 34rem),
          radial-gradient(circle at 80% 0%, rgba(143, 183, 255, 0.14), transparent 30rem),
          var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        line-height: 1.5;
      }
      a { color: inherit; }
      .layout {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
      }
      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 28px 22px;
        border-right: 1px solid var(--line);
        background: rgba(7, 16, 29, 0.82);
      }
      .brand {
        display: grid;
        gap: 8px;
        margin-bottom: 30px;
      }
      .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #06101d;
        font-weight: 800;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 {
        margin-bottom: 0;
        font-size: 24px;
        letter-spacing: 0;
      }
      .muted, .brand p, .nav span, .eyebrow {
        color: var(--muted);
      }
      .nav {
        display: grid;
        gap: 10px;
      }
      .nav span {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.025);
      }
      main {
        width: 100%;
        max-width: 1320px;
        padding: 32px;
      }
      .hero {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 34px;
        background: linear-gradient(135deg, rgba(18, 31, 52, 0.94), rgba(14, 25, 43, 0.82));
        box-shadow: var(--shadow);
      }
      .hero::after {
        content: "";
        position: absolute;
        inset: auto -80px -120px auto;
        width: 340px;
        height: 340px;
        border: 1px solid rgba(77, 216, 207, 0.22);
        border-radius: 999px;
      }
      .hero-content {
        position: relative;
        display: grid;
        gap: 18px;
        max-width: 820px;
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .hero h2 {
        margin-bottom: 0;
        font-size: clamp(34px, 6vw, 64px);
        line-height: 1.02;
        letter-spacing: 0;
      }
      .hero p {
        max-width: 720px;
        margin-bottom: 0;
        color: var(--muted);
        font-size: 17px;
      }
      .badge-row, .kpi-grid, .card-grid, .integration-grid, .footer-grid {
        display: grid;
        gap: 14px;
      }
      .badge-row {
        grid-template-columns: repeat(3, max-content);
      }
      .badge, .card, .kpi, .panel, .timeline-item {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
      }
      .badge {
        padding: 8px 11px;
        color: var(--text);
        font-size: 13px;
      }
      section {
        margin-top: 28px;
      }
      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 14px;
      }
      .section-head h3 {
        margin-bottom: 0;
        font-size: 22px;
      }
      .section-head p {
        margin-bottom: 0;
        color: var(--muted);
      }
      .kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .kpi {
        padding: 18px;
      }
      .label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }
      .value {
        display: block;
        margin-top: 8px;
        font-size: 26px;
        font-weight: 800;
      }
      .detail {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
      }
      .card-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .card {
        padding: 18px;
      }
      .card strong {
        display: block;
        margin-bottom: 10px;
      }
      .status {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        color: var(--muted);
      }
      .status.ready, .status.operational { color: var(--ok); border-color: rgba(126, 231, 135, 0.46); }
      .status.planned { color: var(--planned); border-color: rgba(241, 201, 95, 0.46); }
      .status.disabled { color: var(--danger); border-color: rgba(255, 139, 139, 0.46); }
      .matrix {
        width: 100%;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
      }
      tr:last-child td { border-bottom: 0; }
      .flow {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 10px;
      }
      .flow-step {
        position: relative;
        min-height: 92px;
        display: grid;
        place-items: center;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel-strong);
        text-align: center;
        font-weight: 700;
      }
      .flow-step:not(:last-child)::after {
        content: ">";
        position: absolute;
        right: -10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--accent);
      }
      .split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .panel {
        padding: 18px;
      }
      .panel ul {
        margin: 0;
        padding-left: 19px;
      }
      .panel li + li {
        margin-top: 8px;
      }
      .integration-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .timeline {
        display: grid;
        gap: 10px;
      }
      .timeline-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 16px;
      }
      footer {
        margin-top: 34px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
        color: var(--muted);
      }
      .footer-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      @media (max-width: 1080px) {
        .layout { grid-template-columns: 1fr; }
        .sidebar {
          position: static;
          height: auto;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }
        .nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .flow-step:not(:last-child)::after { content: ""; }
      }
      @media (max-width: 760px) {
        main, .hero { padding: 20px; }
        .badge-row, .kpi-grid, .card-grid, .integration-grid, .split, .footer-grid, .nav {
          grid-template-columns: 1fr;
        }
        .matrix { overflow-x: auto; }
        table { min-width: 720px; }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar" aria-label="Dashboard navigation">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">SA</div>
          <h1>${escapeHtml(viewModel.engineName)}</h1>
          <p>${escapeHtml(viewModel.subtitle)}</p>
          <p class="muted">${escapeHtml(viewModel.version)} | ${escapeHtml(viewModel.build)}</p>
        </div>
        <nav class="nav" aria-label="Landing dashboard sections">
          <span>Executive Overview</span>
          <span>Capability Matrix</span>
          <span>Architecture</span>
          <span>Approval Center</span>
          <span>Integrations</span>
          <span>Release Timeline</span>
        </nav>
      </aside>
      <main>
        <header class="hero">
          <div class="hero-content">
            <span class="eyebrow">${escapeHtml(viewModel.build)} | ${escapeHtml(viewModel.environmentLabel)}</span>
            <h2>${escapeHtml(viewModel.engineName)}</h2>
            <p>${escapeHtml(viewModel.subtitle)}. ${escapeHtml(viewModel.tagline)}.</p>
            <div class="badge-row">${viewModel.heroBadges.map(renderHeroBadge).join("")}</div>
          </div>
        </header>

        <section aria-labelledby="kpi-title">
          <div class="section-head">
            <h3 id="kpi-title">Executive KPI Cards</h3>
            <p>Deterministic preview values only.</p>
          </div>
          <div class="kpi-grid">${viewModel.kpis.map(renderKpi).join("")}</div>
        </section>

        <section aria-labelledby="agents-title">
          <div class="section-head">
            <h3 id="agents-title">Agent Status Cards</h3>
            <p>Alpha capability snapshot.</p>
          </div>
          <div class="card-grid">${viewModel.agents.map(renderAgent).join("")}</div>
        </section>

        <section aria-labelledby="matrix-title">
          <div class="section-head">
            <h3 id="matrix-title">Agent Capability Matrix</h3>
            <p>Status, capability, mode, and readiness.</p>
          </div>
          <div class="matrix">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Capability</th>
                  <th>Current Mode</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>${viewModel.agentCapabilities.map(renderCapabilityRow).join("")}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="architecture-title">
          <div class="section-head">
            <h3 id="architecture-title">Architecture Overview</h3>
            <p>Read-only planning path.</p>
          </div>
          <div class="flow">${viewModel.architectureSteps.map(renderFlowStep).join("")}</div>
        </section>

        <section aria-labelledby="approval-title">
          <div class="section-head">
            <h3 id="approval-title">Approval Center Preview</h3>
            <p>No action buttons.</p>
          </div>
          <div class="split">
            <article class="panel">
              <h4>${escapeHtml(viewModel.approvalCenter.title)}</h4>
              <ul>${viewModel.approvalCenter.items.map(renderListItem).join("")}</ul>
            </article>
            <article class="panel">
              <h4>Safety Summary</h4>
              <ul>${viewModel.safetyControls.map(renderListItem).join("")}</ul>
            </article>
          </div>
        </section>

        <section aria-labelledby="integration-title">
          <div class="section-head">
            <h3 id="integration-title">Integration Landscape</h3>
            <p>Planned integrations are not connected.</p>
          </div>
          <div class="integration-grid">${viewModel.integrationGroups.map(renderIntegrationGroup).join("")}</div>
        </section>

        <section aria-labelledby="timeline-title">
          <div class="section-head">
            <h3 id="timeline-title">Release Timeline</h3>
            <p>SAIE Alpha delivery path.</p>
          </div>
          <div class="timeline">${viewModel.releaseTimeline.map(renderTimelineItem).join("")}</div>
        </section>

        <footer>
          <div class="footer-grid">
            <span>${escapeHtml(viewModel.footer.company)}</span>
            <span>${escapeHtml(viewModel.footer.poweredBy)}</span>
            <span>${escapeHtml(viewModel.footer.version)}</span>
            <span>${escapeHtml(viewModel.footer.build)}</span>
          </div>
        </footer>
      </main>
    </div>
  </body>
</html>`;

const renderHeroBadge = (value: string): string => `<span class="badge">${escapeHtml(value)}</span>`;

const renderKpi = (kpi: DashboardKpiCard): string => `
  <article class="kpi">
    <span class="label">${escapeHtml(kpi.label)}</span>
    <span class="value">${escapeHtml(kpi.value)}</span>
    <span class="detail">${escapeHtml(kpi.detail)}</span>
  </article>`;

const renderAgent = (agent: DashboardAgentStatus): string => `
  <article class="card">
    <strong>${escapeHtml(agent.name)}</strong>
    <span class="status ${agent.tone}">${escapeHtml(agent.status)}</span>
  </article>`;

const renderCapabilityRow = (agent: DashboardAgentCapability): string => `
  <tr>
    <td><strong>${escapeHtml(agent.name)}</strong></td>
    <td><span class="status ${agent.tone}">${escapeHtml(agent.status)}</span></td>
    <td>${escapeHtml(agent.capability)}</td>
    <td>${escapeHtml(agent.currentMode)}</td>
    <td>${escapeHtml(agent.readiness)}</td>
  </tr>`;

const renderFlowStep = (step: string): string => `<div class="flow-step">${escapeHtml(step)}</div>`;

const renderListItem = (item: string): string => `<li>${escapeHtml(item)}</li>`;

const renderIntegrationGroup = (group: DashboardIntegrationGroup): string => `
  <article class="panel">
    <h4>${escapeHtml(group.name)}</h4>
    ${
      group.integrations.length === 0
        ? '<p class="muted">No additional integrations available in Alpha.</p>'
        : `<div class="card-grid">${group.integrations.map(renderIntegration).join("")}</div>`
    }
  </article>`;

const renderIntegration = (integration: DashboardIntegrationStatus): string => `
  <div class="card">
    <strong>${escapeHtml(integration.name)}</strong>
    <span class="status ${integration.tone}">${escapeHtml(integration.status)}</span>
  </div>`;

const renderTimelineItem = (item: DashboardReleaseTimelineItem): string => `
  <div class="timeline-item">
    <strong>${escapeHtml(item.label)}</strong>
    <span class="status ${item.status === "Current" ? "ready" : "operational"}">${escapeHtml(item.status)}</span>
  </div>`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
