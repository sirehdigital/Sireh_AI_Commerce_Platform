/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Product Writer Controller
 * Sprint: SAI-03A.05
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import type { Request, Response, NextFunction } from "express";
import { productWriterService } from "./product-writer.service.js";
import type { ProductWriterInput } from "./product-writer.types.js";

export class ProductWriterController {
  async generate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as Partial<ProductWriterInput>;

      if (!body.productName || body.productName.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: "PRODUCT_NAME_REQUIRED",
            message: "productName is required.",
          },
        });
        return;
      }

      const input: ProductWriterInput = {
        productName: body.productName,
      };

      if (body.productType !== undefined) input.productType = body.productType;
      if (body.targetMarket !== undefined) input.targetMarket = body.targetMarket;
      if (body.tone !== undefined) input.tone = body.tone;
      if (body.language !== undefined) input.language = body.language;
      if (body.keywords !== undefined) input.keywords = body.keywords;

      const result = await productWriterService.generateProductCopy(input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productWriterController = new ProductWriterController();

