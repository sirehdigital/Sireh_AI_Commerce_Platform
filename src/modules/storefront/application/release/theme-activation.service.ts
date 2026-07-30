import type { ShopifyThemeGateway, ShopifyThemeGatewayResult } from "../gateways/index.js";

export class ThemeActivationService {
  public constructor(private readonly gateway: ShopifyThemeGateway) {}

  public activate(): Promise<ShopifyThemeGatewayResult> {
    return this.gateway.activateTheme();
  }
}
