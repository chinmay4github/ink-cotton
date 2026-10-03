import { BadRequestException, Controller, ForbiddenException, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { shipment_status } from '../generated/prisma/enums';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersModule } from '../orders/orders.module';
import { FulfilmentService } from '../orders/fulfilment.service';

const HAPPY_PATH: Partial<Record<shipment_status, shipment_status>> = {
  created: 'assigned',
  assigned: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
  failed_attempt: 'out_for_delivery',
};
const HUBS = ['Seller warehouse', 'Bengaluru Sort Centre', 'Local delivery hub', 'Near your location', 'Doorstep'];

/**
 * DEMO ONLY - disabled when NODE_ENV=production.
 * Lets a customer push their own shipment through the delivery lifecycle until the
 * delivery-agent app (phase 4) exists, so tracking + notifications can be exercised end to end.
 */
@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private prisma: PrismaService, private fulfilment: FulfilmentService) {}

  @HttpCode(200)
  @Post('shipments/:trackingNumber/advance')
  async advance(@CurrentUser() u: AuthUser, @Param('trackingNumber') tn: string) {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_TOOLS !== 'true') throw new ForbiddenException();
    const s = await this.prisma.shipments.findFirst({ where: { tracking_number: tn, order: { user_id: u.id } } });
    if (!s) throw new BadRequestException('Shipment not found');
    const next = HAPPY_PATH[s.status];
    if (!next) throw new BadRequestException(`Shipment is ${s.status}`);

    let agentId: bigint | undefined;
    if (next === 'assigned') {
      const agent = await this.prisma.delivery_agents.findFirst({ orderBy: { id: 'asc' } });
      if (!agent) throw new BadRequestException('No delivery agents seeded');
      agentId = agent.id;
    }
    const idx = Object.keys(HAPPY_PATH).indexOf(s.status);
    return this.fulfilment.applyStatus(s.id, next, {
      deliveryAgentId: agentId,
      locationName: HUBS[Math.min(idx, HUBS.length - 1)],
      otp: next === 'delivered' ? (s.delivery_otp ?? undefined) : undefined,
    });
  }
}

@Module({ imports: [OrdersModule], controllers: [DevController] })
export class DevModule {}
