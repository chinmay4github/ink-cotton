import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface GatewayOrder {
  gateway: string;
  gatewayOrderId: string;
  /** Anything the client SDK needs to open the checkout sheet (key id, amount in paise, etc.) */
  clientParams: Record<string, unknown>;
}

export interface GatewayVerification {
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  signature?: string;
  /** Mock gateway only: lets the demo simulate success/failure. */
  simulate?: 'success' | 'failure';
}

/**
 * Payment gateway port. Implement this for Razorpay / Stripe / PhonePe and bind it in PaymentsModule:
 *  - createOrder -> razorpay.orders.create({ amount: paise, currency, receipt })
 *  - verify      -> HMAC-SHA256(orderId|paymentId, key_secret) === signature
 * Webhooks (payment.captured / payment.failed) should call PaymentsService.settle() too, so
 * payment state converges even if the customer closes the browser mid-payment.
 */
export abstract class PaymentGateway {
  abstract createOrder(amount: number, currency: string, receipt: string): Promise<GatewayOrder>;
  abstract verify(v: GatewayVerification): Promise<{ ok: boolean; paymentId?: string; reason?: string; raw?: unknown }>;
}

@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  async createOrder(amount: number, currency: string, receipt: string): Promise<GatewayOrder> {
    return {
      gateway: 'mock',
      gatewayOrderId: `mock_order_${randomUUID().slice(0, 12)}`,
      clientParams: { amount: Math.round(amount * 100), currency, receipt, mode: 'test' },
    };
  }

  async verify(v: GatewayVerification) {
    if (v.simulate === 'failure') return { ok: false, reason: 'Payment declined by bank (simulated)', raw: v };
    return { ok: true, paymentId: v.gatewayPaymentId ?? `mock_pay_${randomUUID().slice(0, 12)}`, raw: v };
  }
}
