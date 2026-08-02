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

export class WinningHunterInvalidNormalizationInputError extends Error {
  public constructor(message = "WinningHunter normalization input is invalid") {
    super(message);
    this.name = "WinningHunterInvalidNormalizationInputError";
  }
}

export class WinningHunterMissingCanonicalIdentityError extends Error {
  public constructor(message = "WinningHunter candidate has no usable canonical identity") {
    super(message);
    this.name = "WinningHunterMissingCanonicalIdentityError";
  }
}

export class WinningHunterUnusableDiscoveryContextError extends Error {
  public constructor(message = "WinningHunter discovery context is unusable") {
    super(message);
    this.name = "WinningHunterUnusableDiscoveryContextError";
  }
}

export class WinningHunterInvalidNormalizationTimestampError extends Error {
  public constructor(message = "WinningHunter normalization timestamp is invalid") {
    super(message);
    this.name = "WinningHunterInvalidNormalizationTimestampError";
  }
}

export class WinningHunterMalformedCandidateEvidenceError extends Error {
  public constructor(message = "WinningHunter candidate evidence is malformed") {
    super(message);
    this.name = "WinningHunterMalformedCandidateEvidenceError";
  }
}

export class WinningHunterInvalidScoringInputError extends Error {
  public constructor(message = "WinningHunter scoring input is invalid") {
    super(message);
    this.name = "WinningHunterInvalidScoringInputError";
  }
}

export class WinningHunterInvalidScoringTimestampError extends Error {
  public constructor(message = "WinningHunter scoring timestamp is invalid") {
    super(message);
    this.name = "WinningHunterInvalidScoringTimestampError";
  }
}

export class WinningHunterInvalidScoringConfigurationError extends Error {
  public constructor(message = "WinningHunter scoring configuration is invalid") {
    super(message);
    this.name = "WinningHunterInvalidScoringConfigurationError";
  }
}

export class WinningHunterInvalidScoringWeightTotalError extends Error {
  public constructor(message = "WinningHunter scoring component weights must total 100") {
    super(message);
    this.name = "WinningHunterInvalidScoringWeightTotalError";
  }
}

export class WinningHunterMalformedNormalizedProductError extends Error {
  public constructor(message = "WinningHunter normalized product is malformed") {
    super(message);
    this.name = "WinningHunterMalformedNormalizedProductError";
  }
}

export class WinningHunterMissingScoringProductIdentityError extends Error {
  public constructor(message = "WinningHunter normalized product has no usable identity") {
    super(message);
    this.name = "WinningHunterMissingScoringProductIdentityError";
  }
}

export class WinningHunterUnsupportedScoringVersionError extends Error {
  public constructor(message = "WinningHunter scoring version is unsupported") {
    super(message);
    this.name = "WinningHunterUnsupportedScoringVersionError";
  }
}
