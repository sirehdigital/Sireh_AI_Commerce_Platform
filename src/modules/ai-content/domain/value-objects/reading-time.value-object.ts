import { InvalidContentValueError } from "../errors/content-domain.errors.js";

export class ReadingTime {
  public readonly minutes: number;

  private constructor(minutes: number) {
    this.minutes = minutes;
  }

  public static create(minutes: number): ReadingTime {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new InvalidContentValueError("Reading time must be a positive finite number.");
    }

    return new ReadingTime(Math.ceil(minutes));
  }

  public equals(other: ReadingTime): boolean {
    return this.minutes === other.minutes;
  }
}
