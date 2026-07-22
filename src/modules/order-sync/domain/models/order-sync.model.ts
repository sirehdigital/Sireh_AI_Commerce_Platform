export type OrderFinancialStatus =
  | "authorized"
  | "paid"
  | "partially_paid"
  | "partially_refunded"
  | "pending"
  | "refunded"
  | "voided";

export type OrderFulfillmentStatus =
  | "fulfilled"
  | "in_progress"
  | "on_hold"
  | "open"
  | "partially_fulfilled"
  | "pending_fulfillment"
  | "request_declined"
  | "restocked"
  | "scheduled"
  | "unfulfilled";

export interface OrderSyncInput {
  readonly shop: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly financialStatus?: OrderFinancialStatus;
  readonly fulfillmentStatus?: OrderFulfillmentStatus;
}

export interface OrderSyncLineItem {
  readonly lineItemId: string;
  readonly title: string;
  readonly sku?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
}

export interface SyncedOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly createdAt: Date;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly currency: string;
  readonly subtotal: number;
  readonly total: number;
  readonly financialStatus: string;
  readonly fulfillmentStatus: string;
  readonly lineItems: readonly OrderSyncLineItem[];
  readonly itemCount: number;
}

export interface OrderSyncResult {
  readonly orders: readonly SyncedOrder[];
  readonly nextCursor?: string;
  readonly hasNextPage: boolean;
  readonly syncedAt: Date;
}
