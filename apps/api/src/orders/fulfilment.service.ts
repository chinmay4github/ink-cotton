import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { shipment_status } from '../generated/prisma/enums';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { otp, trackingNumber } from '../common/codes';
import { Events, ShipmentEvent } from '../events/events';

/** Allowed shipment transitions. The delivery-agent and admin apps (later phases) go through this too. */
const NEXT: Record<shipment_status, shipment_status[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'out_for_delivery'],
  in_transit: ['out_for_delivery', 'returned_to_vendor'],
  out_for_delivery: ['delivered', 'failed_attempt'],
  failed_attempt: ['out_for_delivery', 'returned_to_vendor'],
  delivered: [],
  returned_to_vendor: [],
  cancelled: [],
};

const LABEL: Record<shipment_status, string> = {
  created: 'Order packed and ready to ship',
  assigned: 'Delivery partner assigned',
  picked_up: 'Picked up from seller',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed_attempt: 'Delivery attempt failed',
  returned_to_vendor: 'Returned to seller',
  cancelled: 'Shipment cancelled',
};

export interface StatusUpdate {
  actorId?: bigint;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  deliveryAgentId?: bigint;
  otp?: string;
  proofUrl?: string;
}

@Injectable()
export class FulfilmentService {
  constructor(private prisma: PrismaService, private events: EventEmitter2) {}

  /** One shipment per vendor in the order. Called when an order becomes confirmed. */
  async createShipments(tx: Tx, orderId: bigint) {
    const order = await tx.orders.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        order_items: { where: { status: { not: 'cancelled' } } },
      },
    });
    const byVendor = new Map<bigint, typeof order.order_items>();
    for (const it of order.order_items) byVendor.set(it.vendor_id, [...(byVendor.get(it.vendor_id) ?? []), it]);

    const eta = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    for (const [vendorId, items] of byVendor) {
      const vendor = await tx.vendors.findUniqueOrThrow({ where: { id: vendorId }, include: { pickup_address: true } });
      const pa = vendor.pickup_address;
      const shipment = await tx.shipments.create({
        data: {
          order_id: order.id,
          vendor_id: vendorId,
          tracking_number: trackingNumber(),
          pickup_address: pa
            ? { name: vendor.display_name, line1: pa.line1, line2: pa.line2, city: pa.city, state: pa.state, postalCode: pa.postal_code, phone: pa.contact_phone, lat: pa.latitude, lng: pa.longitude }
            : { name: vendor.display_name },
          delivery_address: order.shipping_address as object,
          cod_amount:
            order.payment_method === 'cod'
              ? items.reduce((s, i) => s + Number(i.line_total), 0) +
                (byVendor.size === 1 ? Number(order.shipping_fee) : 0)
              : 0,
          estimated_delivery: eta,
          shipment_items: { create: items.map((i) => ({ order_item_id: i.id, quantity: i.quantity })) },
        },
      });
      await tx.shipment_tracking_events.create({
        data: { shipment_id: shipment.id, status: 'created', description: LABEL.created, location_name: pa?.city },
      });
      await tx.order_items.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { status: 'confirmed' } });
    }
  }

  /**
   * Move a shipment to a new status: validates the transition, writes a tracking event (the DB trigger
   * updates shipments.status/timestamps), then rolls item and order statuses forward.
   */
  async applyStatus(shipmentId: bigint, status: shipment_status, u: StatusUpdate = {}) {
    const result = await this.prisma.$transaction(async (tx) => {
      const s = await tx.shipments.findUnique({
        where: { id: shipmentId },
        include: { order: { select: { id: true, order_number: true, user_id: true, payment_method: true } } },
      });
      if (!s) throw new NotFoundException('Shipment not found');
      if (!NEXT[s.status].includes(status)) throw new BadRequestException(`Cannot move shipment from ${s.status} to ${status}`);

      const data: Record<string, unknown> = {};
      if (status === 'assigned') {
        if (!u.deliveryAgentId) throw new BadRequestException('deliveryAgentId required');
        data.delivery_agent_id = u.deliveryAgentId;
        data.assigned_at = new Date();
      }
      if (status === 'out_for_delivery') data.delivery_otp = otp();
      if (status === 'delivered') {
        if (s.delivery_otp && u.otp !== undefined && u.otp !== s.delivery_otp) throw new BadRequestException('Invalid delivery OTP');
        data.proof_of_delivery_url = u.proofUrl;
        data.delivery_otp = null;
      }
      if (Object.keys(data).length) await tx.shipments.update({ where: { id: s.id }, data });

      await tx.shipment_tracking_events.create({
        data: {
          shipment_id: s.id,
          status,
          description: u.note ?? LABEL[status],
          location_name: u.locationName,
          latitude: u.latitude,
          longitude: u.longitude,
          updated_by: u.actorId,
        },
      });

      // ---- roll item statuses forward
      const itemIds = (await tx.shipment_items.findMany({ where: { shipment_id: s.id }, select: { order_item_id: true } })).map(
        (x) => x.order_item_id,
      );
      const itemStatus =
        status === 'picked_up' ? 'shipped' : status === 'delivered' ? 'delivered' : status === 'cancelled' ? 'cancelled' : null;
      if (itemStatus) await tx.order_items.updateMany({ where: { id: { in: itemIds } }, data: { status: itemStatus } });
      if (status === 'assigned') await tx.order_items.updateMany({ where: { id: { in: itemIds } }, data: { status: 'packed' } });

      // ---- roll order status forward
      const all = await tx.shipments.findMany({ where: { order_id: s.order_id }, select: { status: true } });
      const live = all.filter((x) => x.status !== 'cancelled');
      const delivered = live.every((x) => x.status === 'delivered');
      const shipped = live.filter((x) => ['picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt', 'delivered'].includes(x.status));
      let orderStatus: 'processing' | 'shipped' | 'partially_shipped' | 'delivered' | null = null;
      if (live.length && delivered) orderStatus = 'delivered';
      else if (shipped.length === live.length && live.length) orderStatus = 'shipped';
      else if (shipped.length) orderStatus = 'partially_shipped';
      else if (status === 'assigned') orderStatus = 'processing';
      if (orderStatus) {
        await tx.orders.updateMany({ where: { id: s.order_id, status: { not: orderStatus } }, data: { status: orderStatus } });
      }

      // COD collected on delivery
      if (status === 'delivered' && s.order.payment_method === 'cod' && delivered) {
        await tx.payments.updateMany({
          where: { order_id: s.order_id, method: 'cod', status: 'initiated' },
          data: { status: 'success', paid_at: new Date() },
        });
      }

      const fresh = await tx.shipments.findUniqueOrThrow({
        where: { id: s.id },
        include: { delivery_agent: { include: { user: { select: { full_name: true } } } } },
      });
      return { s, fresh };
    });

    const evt: ShipmentEvent = {
      shipmentId: result.s.id,
      orderId: result.s.order_id,
      orderNumber: result.s.order.order_number,
      userId: result.s.order.user_id,
      status,
      trackingNumber: result.s.tracking_number,
      otp: result.fresh.delivery_otp,
      agentName: result.fresh.delivery_agent?.user.full_name,
    };
    this.events.emit(Events.ShipmentUpdated, evt);
    return result.fresh;
  }

  nextStatuses(status: shipment_status) {
    return NEXT[status];
  }
}
