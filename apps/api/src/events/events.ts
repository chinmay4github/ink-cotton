/**
 * Domain events. Services emit these; listeners (notifications today; analytics,
 * search indexing, webhooks later) react asynchronously. To scale out, swap the
 * in-process EventEmitter for a queue (BullMQ / SQS) without touching emitters.
 */
export const Events = {
  UserRegistered: 'user.registered',
  OrderPlaced: 'order.placed',
  OrderConfirmed: 'order.confirmed',
  OrderCancelled: 'order.cancelled',
  PaymentFailed: 'payment.failed',
  ShipmentUpdated: 'shipment.updated',
  StockLow: 'stock.low',
} as const;

export interface OrderEvent {
  orderId: bigint;
  orderNumber: string;
  userId: bigint;
  total?: number;
}

export interface ShipmentEvent {
  shipmentId: bigint;
  orderId: bigint;
  orderNumber: string;
  userId: bigint;
  status: string;
  trackingNumber: string;
  otp?: string | null;
  agentName?: string | null;
}
