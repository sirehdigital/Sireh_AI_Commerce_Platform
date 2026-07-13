import { describe, expect, it } from "vitest";
import { ProductContentClaimSafetyService } from "./product-content-claim-safety.service.js";

describe("ProductContentClaimSafetyService", () => {
  const service = new ProductContentClaimSafetyService();

  it("allows restrained product copy", () => {
    expect(service.inspectText("A clear product description based on available product details.")).toEqual([]);
  });

  it("detects unsupported claim categories", () => {
    const unsafeClaims = [
      "100% guaranteed results",
      "cure skin disease",
      "guaranteed income",
      "Rated 5 stars by 10,000 reviews",
      "FDA approved and certified",
      "Only 3 left with limited stock",
      "Act now before it is gone",
      "The best and perfect choice",
    ];

    for (const claim of unsafeClaims) {
      expect(service.inspectText(claim).length).toBeGreaterThan(0);
    }
  });
});
