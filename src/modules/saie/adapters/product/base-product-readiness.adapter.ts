import type {
  ProductAdapterDependencyValidation,
  ProductAdapterReadinessItem,
  ProductReadinessAdapter,
} from "./product-adapter.types.js";

export abstract class BaseProductReadinessAdapter implements ProductReadinessAdapter {
  public readonly mode = "readiness-only";

  protected constructor(
    private readonly item: ProductAdapterReadinessItem,
    private readonly dependency: unknown,
  ) {}

  public getReadinessItem(): ProductAdapterReadinessItem {
    return {
      ...this.item,
      notes: [...this.item.notes],
    };
  }

  public validateDependency(): ProductAdapterDependencyValidation {
    return {
      dependencySupplied: this.dependency !== undefined && this.dependency !== null,
      notes:
        this.dependency === undefined || this.dependency === null
          ? ["No dependency instance was supplied. Readiness metadata remains deterministic."]
          : ["Dependency instance was supplied but not invoked in readiness-only mode."],
    };
  }
}
