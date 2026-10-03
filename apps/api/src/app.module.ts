import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { DevModule } from './dev/dev.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReturnsModule } from './returns/returns.module';
import { SellerModule } from './seller/seller.module';
import { RiderModule } from './rider/rider.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per-IP rate limit. For multiple API instances, back this with Redis
    // (@nest-lab/throttler-storage-redis) so limits are shared.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    CartModule,
    WishlistModule,
    AddressesModule,
    OrdersModule,
    ReviewsModule,
    NotificationsModule,
    ReturnsModule,
    SellerModule, // sell.inkandcotton.com
    RiderModule, // deliver.inkandcotton.com
    AdminModule, // admin.inkandcotton.com
    DevModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
