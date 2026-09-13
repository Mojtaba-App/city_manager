/**
 * Contract-style check: committed OpenAPI artifact must stay a non-empty OpenAPI 3 document.
 */
import * as fs from 'fs';
import * as path from 'path';

function loadOpenApi(file: string): { openapi?: string; paths?: Record<string, unknown> } {
  const raw = fs.readFileSync(file, 'utf8');
  const json = raw.replace(/^\/\*[\s\S]*?\*\//, '').trim();
  return JSON.parse(json) as { openapi?: string; paths?: Record<string, unknown> };
}

describe('OpenAPI contract artifact', () => {
  it('keeps packages/api-client/openapi.json as OpenAPI 3', () => {
    const candidates = [
      path.resolve(__dirname, '../../../../packages/api-client/openapi.json'),
      path.resolve(process.cwd(), '../packages/api-client/openapi.json'),
      path.resolve(process.cwd(), '../../packages/api-client/openapi.json'),
      path.resolve(process.cwd(), 'packages/api-client/openapi.json'),
    ];
    const file = candidates.find((p) => fs.existsSync(p));
    expect(file).toBeTruthy();
    const doc = loadOpenApi(file!);
    expect(String(doc.openapi || '')).toMatch(/^3\./);
    expect(doc.paths && Object.keys(doc.paths).length).toBeGreaterThan(0);
  });
});
