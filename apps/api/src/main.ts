import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

// BIGINT ids -> JSON numbers (ids stay far below 2^53).
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const log = new Logger('bootstrap');

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.set('trust proxy', 1); // correct client IPs behind a load balancer (rate limiting)
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }),
  );
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Ink & Cotton Commerce API')
    .setDescription('Customer, seller, delivery and admin APIs.')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  log.log(`API on http://localhost:${port}/api/v1  ·  docs http://localhost:${port}/docs`);
}
bootstrap();
