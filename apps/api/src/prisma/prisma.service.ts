import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { pgConfig } from '../common/db-url';

// Serialise Postgres NUMERIC as JSON numbers (money values are well within double precision
// at 2 decimal places); BIGINT ids are serialised as numbers too (see main.ts).
(Prisma.Decimal.prototype as any).toJSON = function () {
  return this.toNumber();
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg(
      {
        ...pgConfig(url),
        max: Number(config.get('DB_POOL_MAX') ?? 20),
        idleTimeoutMillis: 30_000,
      },
      { schema: 'shop' },
    );
    super({ adapter, log: config.get('NODE_ENV') === 'development' ? ['warn', 'error'] : ['error'] });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type Tx = Prisma.TransactionClient;
