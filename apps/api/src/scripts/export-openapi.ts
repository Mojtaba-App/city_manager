import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';

/**
 * Exports OpenAPI JSON for packages/api-client.
 * Requires a reachable DATABASE_URL (same as API boot).
 *
 * Usage: pnpm --filter @city-manager/api openapi:export
 */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('City Manager API')
    .setDescription('API پلتفرم مدیریت بازآفرینی شهری')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const out = join(__dirname, '../../../../packages/api-client/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(document, null, 2), 'utf8');
  console.log(`OpenAPI written → ${out}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
