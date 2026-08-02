export class WinningHunterInvalidDiscoveryQueryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WinningHunterInvalidDiscoveryQueryError";
  }
}

export class WinningHunterMalformedExternalResponseError extends Error {
  public constructor(message = "WinningHunter returned a malformed response") {
    super(message);
    this.name = "WinningHunterMalformedExternalResponseError";
  }
}

export class WinningHunterInvalidProductIdentityError extends Error {
  public constructor(message = "WinningHunter product row has no usable product identity") {
    super(message);
    this.name = "WinningHunterInvalidProductIdentityError";
  }
}

export class WinningHunterUnsupportedUrlError extends Error {
  public constructor(message = "WinningHunter product URL is unsupported or malformed") {
    super(message);
    this.name = "WinningHunterUnsupportedUrlError";
  }
}

export class WinningHunterClientUnavailableError extends Error {
  public constructor(message = "WinningHunter client is unavailable") {
    super(message);
    this.name = "WinningHunterClientUnavailableError";
  }
}

export class WinningHunterRateLimitedError extends Error {
  public constructor(message = "WinningHunter request was rate limited") {
    super(message);
    this.name = "WinningHunterRateLimitedError";
  }
}

export class WinningHunterRequestTimeoutError extends Error {
  public constructor(message = "WinningHunter request timed out") {
    super(message);
    this.name = "WinningHunterRequestTimeoutError";
  }
}
