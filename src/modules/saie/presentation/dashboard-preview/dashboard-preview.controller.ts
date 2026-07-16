import { Router, type Request, type Response } from "express";
import { dashboardPreviewService } from "./dashboard-preview.service.js";
import { renderDashboardPreviewHtml } from "./dashboard-preview.template.js";

const router = Router();

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

router.get("/", (_request: Request, response: Response): void => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Content-Security-Policy", DASHBOARD_CSP);
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).send(renderDashboardPreviewHtml(dashboardPreviewService.createViewModel()));
});

export const dashboardPreviewRouter = router;
