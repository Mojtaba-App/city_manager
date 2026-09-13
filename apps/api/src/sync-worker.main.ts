import './polyfills';
import { NestFactory } from '@nestjs/core';
import { SyncWorkerModule } from './sync-worker.module';
import { SyncQueueService } from './modules/integration/services/sync-queue.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SyncWorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  const queue = app.get(SyncQueueService);
  const interval = Number(process.env.SYNC_WORKER_INTERVAL_MS ?? 30_000);

  console.log(`Sync worker started — interval ${interval}ms`);

  const run = () => void queue.tick();
  run();
  setInterval(run, interval);

  process.on('SIGINT', () => void app.close().then(() => process.exit(0)));
  process.on('SIGTERM', () => void app.close().then(() => process.exit(0)));
}

bootstrap().catch((err) => {
  console.error('Sync worker failed to start', err);
  process.exit(1);
});
