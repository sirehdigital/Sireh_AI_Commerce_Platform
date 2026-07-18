export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export const createDeterministicPaginationMeta = (totalItems: number): PaginationMeta => ({
  page: 1,
  pageSize: totalItems,
  totalItems,
  totalPages: totalItems > 0 ? 1 : 0,
});
