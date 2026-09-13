/**
 * Minimal PDF 1.4 generator for tabular report exports (no native deps).
 * Produces a valid binary PDF with Helvetica text lines.
 */
export function buildSimplePdf(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}): Buffer {
  const lines: string[] = [];
  lines.push(sanitize(opts.title));
  if (opts.subtitle) lines.push(sanitize(opts.subtitle));
  lines.push('');
  lines.push(opts.headers.map(sanitize).join(' | '));
  lines.push('-'.repeat(Math.min(90, opts.headers.join(' | ').length + 8)));
  for (const row of opts.rows.slice(0, 2000)) {
    lines.push(row.map(sanitize).join(' | '));
  }
  if (opts.rows.length > 2000) {
    lines.push(`… ${opts.rows.length - 2000} more rows`);
  }

  const contentLines = lines.map((line, i) => {
    const y = 800 - i * 14;
    return `BT /F1 10 Tf 40 ${y} Td (${escapePdf(line)}) Tj ET`;
  });
  const stream = contentLines.join('\n');
  const streamLen = Buffer.byteLength(stream, 'utf8');

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
  );
  objects.push(`4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream\nendobj\n`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function sanitize(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 120);
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
