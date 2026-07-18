export class ApplicationNotFoundError extends Error {
  public constructor(
    public readonly resourceName: string,
    public readonly resourceId: string,
  ) {
    super(`${resourceName} was not found.`);
    this.name = "ApplicationNotFoundError";
  }
}
