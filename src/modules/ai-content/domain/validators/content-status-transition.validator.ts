import { InvalidContentStateTransitionError } from "../errors/content-domain.errors.js";
import type { ContentStatus } from "../types/content.types.js";

const ALLOWED_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["generated", "archived"],
  generated: ["reviewed", "rejected", "archived"],
  reviewed: ["approved", "rejected", "archived"],
  approved: ["published", "archived"],
  published: ["archived"],
  rejected: ["draft", "archived"],
  archived: [],
};

export class ContentStatusTransitionValidator {
  public canTransition(from: ContentStatus, to: ContentStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  }

  public assertCanTransition(from: ContentStatus, to: ContentStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidContentStateTransitionError(from, to);
    }
  }

  public allowedTransitionsFrom(status: ContentStatus): readonly ContentStatus[] {
    return ALLOWED_TRANSITIONS[status];
  }
}
