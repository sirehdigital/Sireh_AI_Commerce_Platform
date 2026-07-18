export class AutoDsError extends Error {
  public override readonly name: string;
  public override readonly cause?: Error;

  public constructor(message: string, cause?: Error) {
    super(message);
    this.name = new.target.name;
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AutoDsAuthenticationError extends AutoDsError {}

export class AutoDsAuthorizationError extends AutoDsError {}

export class AutoDsProductNotFoundError extends AutoDsError {}

export class AutoDsSynchronizationError extends AutoDsError {}

export class AutoDsRepositoryError extends AutoDsError {}

export class AutoDsValidationError extends AutoDsError {}

export class AutoDsRateLimitError extends AutoDsError {}

export class AutoDsConfigurationError extends AutoDsError {}
