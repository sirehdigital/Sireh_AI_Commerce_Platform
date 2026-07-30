import type {
  StorefrontBlock,
  StorefrontNavigationItem,
  StorefrontSection,
} from "../../domain/index.js";

export function handleize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "item";
}

export function section(input: {
  readonly type: string;
  readonly id: string;
  readonly position: number;
  readonly purpose: string;
  readonly settings?: Readonly<Record<string, string | number | boolean | null>>;
  readonly blocks?: readonly StorefrontBlock[];
  readonly locale: string;
  readonly markets: readonly string[];
  readonly warnings?: readonly string[];
}): StorefrontSection {
  return {
    type: input.type,
    id: `sf-${handleize(input.id)}`,
    purpose: input.purpose,
    enabled: true,
    position: input.position,
    settings: input.settings ?? {},
    blocks: input.blocks ?? [],
    visibilityRules: ["merchant-review-required"],
    marketRules: input.markets,
    localeRules: [input.locale],
    mobileBehavior: "mobile-first stacked layout with touch-safe controls",
    desktopBehavior: "responsive editorial commerce layout",
    requiredAssets: [],
    requiredContent: [],
    dynamicDataBindings: [],
    validationWarnings: input.warnings ?? [],
  };
}

export function block(
  type: string,
  id: string,
  order: number,
  settings: Readonly<Record<string, string | number | boolean | null>>,
): StorefrontBlock {
  return {
    type,
    id: `sf-block-${handleize(id)}`,
    settings,
    order,
    visible: true,
    validationState: "VALID",
  };
}

export function navItem(
  id: string,
  label: string,
  url: string,
  order: number,
  parentId?: string,
): StorefrontNavigationItem {
  return {
    id: handleize(id),
    label,
    handle: handleize(label),
    url,
    ...(parentId === undefined ? {} : { parentId: handleize(parentId) }),
    order,
  };
}
