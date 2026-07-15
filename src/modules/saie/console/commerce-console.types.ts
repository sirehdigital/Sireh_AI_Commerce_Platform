import type {
  ShopifyDraftPreparationInput,
  ShopifyDraftPreparationResult,
} from "../workflows/shopify-draft-preparation/index.js";

export type CommerceConsoleFormat = "summary" | "json";
export type CommerceConsoleBrandConfigName = "lumora";

export interface CommerceConsoleArguments {
  readonly shop: `${string}.myshopify.com`;
  readonly productLocator:
    | {
        readonly kind: "product-id";
        readonly productId: string;
      }
    | {
        readonly kind: "handle";
        readonly handle: string;
      };
  readonly brandConfig: CommerceConsoleBrandConfigName;
  readonly format: CommerceConsoleFormat;
}

export interface CommerceConsoleIo {
  readonly stdout: Pick<NodeJS.WriteStream, "write">;
  readonly stderr: Pick<NodeJS.WriteStream, "write">;
}

export interface CommerceConsoleWorkflowRunner {
  readonly prepareDraft: (
    input: ShopifyDraftPreparationInput,
    generatedAt?: Date,
    workflowId?: string,
  ) => Promise<ShopifyDraftPreparationResult>;
}

export interface CommerceConsoleRunResult {
  readonly exitCode: 0 | 1;
  readonly result?: ShopifyDraftPreparationResult;
}
