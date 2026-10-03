import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events, OrderEvent, ShipmentEvent } from '../events/events';
import { NotificationsService } from './notifications.service';

const inr = (v?: number) => (v == null ? '' : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

/** Maps domain events to customer notifications. `async: true` keeps them off the request path. */
@Injectable()
export class NotificationListeners {
  private log = new Logger(NotificationListeners.name);
  constructor(private n: NotificationsService) {}

  private safe(fn: () => Promise<unknown>) {
    return fn().catch((e) => this.log.error(e));
  }

  @OnEvent(Events.UserRegistered, { async: true })
  welcome(e: { userId: bigint; name: string }) {
    return this.safe(() => this.n.notifyTemplate(e.userId, 'WELCOME', { name: e.name.split(' ')[0] }, { deepLink: '/' }));
  }

  @OnEvent(Events.OrderPlaced, { async: true })
  placed(e: OrderEvent) {
    return this.safe(() =>
      this.n.notifyTemplate(e.userId, 'ORDER_PLACED', { order_number: e.orderNumber, total: inr(e.total) }, {
        deepLink: `/orders/${e.orderNumber}`, data: { orderNumber: e.orderNumber },
      }),
    );
  }

  @OnEvent(Events.OrderConfirmed, { async: true })
  confirmed(e: OrderEvent) {
    return this.safe(() =>
      this.n.notifyTemplate(e.userId, 'ORDER_CONFIRMED', { order_number: e.orderNumber, total: inr(e.total) }, {
        deepLink: `/orders/${e.orderNumber}`, data: { orderNumber: e.orderNumber },
      }),
    );
  }

  @OnEvent(Events.OrderCancelled, { async: true })
  cancelled(e: OrderEvent) {
    return this.safe(() =>
      this.n.notifyTemplate(e.userId, 'ORDER_CANCELLED', { order_number: e.orderNumber }, { deepLink: `/orders/${e.orderNumber}` }),
    );
  }

  @OnEvent(Events.PaymentFailed, { async: true })
  paymentFailed(e: OrderEvent) {
    return this.safe(() =>
      this.n.notifyTemplate(e.userId, 'PAYMENT_FAILED', { order_number: e.orderNumber }, { deepLink: `/orders/${e.orderNumber}` }),
    );
  }

  @OnEvent(Events.ShipmentUpdated, { async: true })
  shipment(e: ShipmentEvent) {
    const code: Record<string, string> = {
      picked_up: 'ORDER_SHIPPED',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      delivered: 'ORDER_DELIVERED',
      failed_attempt: 'DELIVERY_FAILED',
    };
    if (!code[e.status]) return;
    return this.safe(() =>
      this.n.notifyTemplate(
        e.userId,
        code[e.status],
        { order_number: e.orderNumber, tracking_number: e.trackingNumber, otp: e.otp, agent_name: e.agentName ?? 'Our delivery partner', product_name: 'Your order' },
        { deepLink: `/orders/${e.orderNumber}`, data: { orderNumber: e.orderNumber, trackingNumber: e.trackingNumber } },
      ),
    );
  }

  @OnEvent(Events.StockLow, { async: true })
  lowStock(e: { sku: string; qty: number; vendorUserId: bigint }) {
    return this.safe(() => this.n.notifyTemplate(e.vendorUserId, 'LOW_STOCK', { sku: e.sku, qty: e.qty }, { deepLink: '/vendor/inventory' }));
  }
}
