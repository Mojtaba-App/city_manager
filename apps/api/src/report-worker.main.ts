import './polyfills';
import { NestFactory } from '@nestjs/core';
import { ReportWorkerModule } from './report-worker.module';
import { ReportScheduleWorkerService } from './modules/admin/services/report-schedule-worker.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ReportWorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  const worker = app.get(ReportScheduleWorkerService);
  const interval = Number(process.env.REPORT_SCHEDULE_INTERVAL_MS ?? 60_000);

  console.log(`Report schedule worker started — interval ${interval}ms`);

  const run = () => void worker.tick();
  run();
  setInterval(run, Number.isFinite(interval) && interval > 0 ? interval : 60_000);

  process.on('SIGINT', () => void app.close().then(() => process.exit(0)));
  process.on('SIGTERM', () => void app.close().then(() => process.exit(0)));
}

bootstrap().catch((err) => {
  console.error('Report schedule worker failed to start', err);
  process.exit(1);
});
