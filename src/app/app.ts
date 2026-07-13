/**
 * Project: Sireh AI Commerce Platform
 * Module: App Factory
 * Sprint: SAI-02.02
 * Author: OpenAI + Codex
 * Status: Production Ready
 */

import express, { type Express } from "express";

import { errorHandler } from "../middleware/error-handler.js";
import { notFoundHandler } from "../middleware/not-found-handler.js";
import { appRouter } from "../routes/index.js";
import { shopifyRoutes } from "../routes/shopify.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "sireh-ai-engine-backend",
    });
  });

  app.use("/", appRouter);
  app.use("/api/shopify", shopifyRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
