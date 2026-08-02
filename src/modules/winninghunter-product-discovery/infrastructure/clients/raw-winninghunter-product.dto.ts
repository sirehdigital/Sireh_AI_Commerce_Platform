export type RawWinningHunterScalar =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly unknown[]
  | Readonly<Record<string, unknown>>;

export interface RawWinningHunterProductRow {
  readonly productid?: RawWinningHunterScalar;
  readonly shopify_productid?: RawWinningHunterScalar;
  readonly page_id?: RawWinningHunterScalar;
  readonly pageName?: RawWinningHunterScalar;
  readonly countries?: RawWinningHunterScalar;
  readonly started?: RawWinningHunterScalar;
  readonly updated_at?: RawWinningHunterScalar;
  readonly lastSeen?: RawWinningHunterScalar;
  readonly created_at?: RawWinningHunterScalar;
  readonly urlStore?: RawWinningHunterScalar;
  readonly product_url?: RawWinningHunterScalar;
  readonly display_format?: RawWinningHunterScalar;
  readonly caption?: RawWinningHunterScalar;
  readonly copy?: RawWinningHunterScalar;
  readonly description?: RawWinningHunterScalar;
  readonly total_eu_adspend?: RawWinningHunterScalar;
  readonly total_eu_views?: RawWinningHunterScalar;
  readonly countActive?: RawWinningHunterScalar;
  readonly activeSeen?: RawWinningHunterScalar;
  readonly total_active_ads_on_page?: RawWinningHunterScalar;
  readonly total_active_ads_on_page_growth_1w?: RawWinningHunterScalar;
  readonly total_active_ads_on_page_growth_1m?: RawWinningHunterScalar;
  readonly total_active_ads_on_page_growth_3m?: RawWinningHunterScalar;
  readonly ad_rank?: RawWinningHunterScalar;
  readonly rank_history?: RawWinningHunterScalar;
  readonly shopify_productprice?: RawWinningHunterScalar;
  readonly shopify_shopifydomain?: RawWinningHunterScalar;
  readonly shopify_currency?: RawWinningHunterScalar;
  readonly id?: RawWinningHunterScalar;
  readonly title?: RawWinningHunterScalar;
}

export interface RawWinningHunterDiscoveryPage {
  readonly rows: readonly RawWinningHunterProductRow[];
  readonly nextScroll?: unknown;
  readonly hasMore?: unknown;
  readonly sourceResultCount?: unknown;
}
