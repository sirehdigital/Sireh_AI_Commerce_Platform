export class ProductHunterValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProductHunterValidationError";
  }
}
