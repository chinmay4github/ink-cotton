import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { MockPaymentGateway, PaymentGateway } from '../payments/payment-gateway';
import { FulfilmentService } from './fulfilment.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    FulfilmentService,
    // Swap for RazorpayGateway / StripeGateway in production.
    { provide: PaymentGateway, useClass: MockPaymentGateway },
  ],
  exports: [OrdersService, FulfilmentService],
})
export class OrdersModule {}
