import { UnsafeHashtagError } from "../errors/product-content.errors.js";

export class SocialHashtagSafetyService {
  public validate(hashtags: readonly string[], maxCount: number): void {
    const unsafe = hashtags.filter((hashtag) => this.isUnsafe(hashtag));

    if (hashtags.length > maxCount) {
      throw new UnsafeHashtagError("Social hashtag count exceeds platform limits.", {
        count: hashtags.length,
        maxCount,
      });
    }

    if (unsafe.length > 0) {
      throw new UnsafeHashtagError("Social hashtags contain unsupported or unsafe terms.", { hashtags: unsafe });
    }
  }

  private isUnsafe(hashtag: string): boolean {
    return !/^#[a-zA-Z0-9]+$/u.test(hashtag) || /guaranteed|cure|treat|nearme|discount|coupon|limited|best/iu.test(hashtag);
  }
}
