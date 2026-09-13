import './polyfills';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { freeDevPort } = require('../scripts/free-dev-port.cjs') as {
  freeDevPort: (port: number) => boolean;
};

async function closeHttpServer(app: NestExpressApplication): Promise<void> {
  const server = app.getHttpServer();
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((err?: Error) => (err ? reject(err) : resolve()));
  });
}

async function listenWithRetry(app: NestExpressApplication, port: number): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAttempts = isProd ? 1 : 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!isProd && attempt === 1) {
      freeDevPort(port);
    }

    try {
      // Must use app.listen — raw server.listen() skips Nest route registration.
      await app.listen(port);
      return;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'EADDRINUSE' || attempt >= maxAttempts) throw err;

      if (!isProd) {
        freeDevPort(port);
      }

      await closeHttpServer(app);

      const waitMs = Math.min(350 * attempt, 2500);
      console.warn(`Port ${port} is busy (attempt ${attempt}/${maxAttempts}); retrying in ${waitMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3001);
  const prefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  app.enableShutdownHooks();

  const isProd = (configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production';
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') === '1'
    || (!isProd && configService.get<string>('SWAGGER_ENABLED') !== '0');

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled
        ? false
        : {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              scriptSrc: ["'self'"],
              connectSrc: ["'self'", ...corsOrigin.split(',').map((o) => o.trim())],
            },
          },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix(prefix);
  app.useBodyParser('json', {
    limit: '2mb',
    verify: (req: { rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
      if (Buffer.isBuffer(buf) && buf.length > 0) {
        req.rawBody = Buffer.from(buf);
      }
    },
  });
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('City Manager API')
      .setDescription('API پلتفرم مدیریت بازآفرینی شهری')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down API...`);
    try {
      await closeHttpServer(app);
      await app.close();
    } catch (err) {
      console.error('Shutdown error', err);
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await listenWithRetry(app, port);
  console.log(`API running on http://localhost:${port}/${prefix}`);
}

bootstrap().catch((err) => {
  console.error('API bootstrap failed', err);
  process.exit(1);
});