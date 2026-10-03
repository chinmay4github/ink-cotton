import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /** Liveness: process is up. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable - use for load balancer / k8s readiness probes. */
  @Get()
  async ready() {
    const t = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: { latencyMs: Date.now() - t }, uptimeSec: Math.round(process.uptime()) };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
