export class MarketingEngineValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketingEngineValidationError";
  }
}
