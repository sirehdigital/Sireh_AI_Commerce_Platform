import type { RequestHandler } from "express";

import type { GetDashboardQuery } from "../../application/index.js";
import { renderDashboardPreviewHtml } from "../../presentation/index.js";
import { getSaieTenantContext } from "../middleware/index.js";

const DASHBOARD_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors https://admin.shopify.com https://*.myshopify.com",
].join("; ");

export interface DashboardControllerDependencies {
  readonly getDashboard: GetDashboardQuery;
}

export interface DashboardController {
  readonly getDashboard: RequestHandler;
}

export const createDashboardController = (
  dependencies: DashboardControllerDependencies,
): DashboardController => ({
  getDashboard: (request, response): void => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Content-Security-Policy", DASHBOARD_CSP);
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.status(200).send(renderDashboardPreviewHtml(dependencies.getDashboard.execute({
      tenant: getSaieTenantContext(request),
    })));
  },
});
