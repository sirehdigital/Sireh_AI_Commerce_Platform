import "dotenv/config";
import { fileURLToPath } from "node:url";
import { ShopifyClient } from "../../../integrations/shopify/shopify.client.js";
import type { ShopifyShopDomain } from "../../../integrations/shopify/shopify.types.js";
import { ShopifyProductReadAdapter } from "../adapters/shopify-read/index.js";
import {
  ProductPreparationWorkflow,
  ShopifyDraftPreparationWorkflow,
} from "../workflows/index.js";
import {
  parseCommerceConsoleArguments,
  toShopifyDraftPreparationInput,
} from "./commerce-console.arguments.js";
import { presentCommerceConsoleResult } from "./commerce-console.presenter.js";
import type {
  CommerceConsoleIo,
  CommerceConsoleRunResult,
  CommerceConsoleWorkflowRunner,
} from "./commerce-console.types.js";

export const createCommerceConsoleWorkflowRunner = async (
  shop: ShopifyShopDomain,
): Promise<CommerceConsoleWorkflowRunner> => {
  const client = await ShopifyClient.forShop(shop);
  const shopifyReader = new ShopifyProductReadAdapter(client);
  const workflow = new ShopifyDraftPreparationWorkflow({
    shopifyReader,
    productPreparationWorkflow: new ProductPreparationWorkflow(),
  });

  return {
    prepareDraft: (input, generatedAt, workflowId) => workflow.prepareDraft(input, generatedAt, workflowId),
  };
};

export const runCommerceConsole = async (
  argv: readonly string[],
  io: CommerceConsoleIo = { stdout: process.stdout, stderr: process.stderr },
  runnerFactory: (shop: ShopifyShopDomain) => Promise<CommerceConsoleWorkflowRunner> = createCommerceConsoleWorkflowRunner,
): Promise<CommerceConsoleRunResult> => {
  try {
    const args = parseCommerceConsoleArguments(argv);
    const input = toShopifyDraftPreparationInput(args);
    const runner = await runnerFactory(args.shop);
    const result = await runner.prepareDraft(input);

    io.stdout.write(presentCommerceConsoleResult(result, args.format));

    return { exitCode: 0, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Commerce Console failure.";
    io.stderr.write(`SAIE Commerce Console failed safely: ${message}\n`);

    return { exitCode: 1 };
  }
};

const isDirectExecution = (): boolean => {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && fileURLToPath(import.meta.url) === entrypoint;
};

if (isDirectExecution()) {
  const runResult = await runCommerceConsole(process.argv.slice(2));
  process.exitCode = runResult.exitCode;
}
