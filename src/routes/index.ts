/**
 * Project: Sireh AI Commerce Platform
 * Module: Root Routes
 * Sprint: SAI-03.13
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import { Router } from "express";
import { productWriterRouter } from "../ai/product-writer/product-writer.routes.js";
import { autoDSRouter } from "../modules/autods/api/index.js";
import { productImportRouter } from "../modules/product-import/api/index.js";
import { productMediaRouter } from "../modules/product-media/api/index.js";
import { saieApiRouter } from "../modules/saie/api/index.js";

export const appRouter = Router();

appRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "sireh-ai-engine-backend",
    message: "Sireh AI Engine Backend is running.",
  });
});

appRouter.use("/api/v1/product", productWriterRouter);
appRouter.use("/api/autods", autoDSRouter);
appRouter.use("/api/product-imports", productImportRouter);
appRouter.use("/api/product-media", productMediaRouter);
appRouter.use("/api/saie", saieApiRouter);
