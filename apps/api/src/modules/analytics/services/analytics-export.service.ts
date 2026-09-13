import { Injectable } from '@nestjs/common';
import { AnalyticsOverview, DistributionBucket, describeAnalyticsFilter } from '@city-manager/shared';
import { buildSimplePdf } from '../../../common/simple-pdf';

@Injectable()
export class AnalyticsExportService {
  buildCsv(overview: AnalyticsOverview): string {
    const lines: string[] = [];
    lines.push('\uFEFFگزارش تحلیلی City Manager');
    lines.push(`زمان تولید,${overview.generatedAt}`);
    lines.push(`فیلتر,${describeAnalyticsFilter(overview.filters ?? {})}`);
    lines.push('');
    lines.push('KPIها');
    lines.push('کد,عنوان,مقدار,واحد');
    for (const k of overview.kpis) {
      lines.push([k.code, k.title, String(k.value), k.unit ?? ''].map(this.esc).join(','));
    }
    lines.push('');
    lines.push(...this.distSection('توزیع درآمد', overview.distributions.income));
    lines.push(...this.distSection('توزیع تحصیلات', overview.distributions.education));
    lines.push(...this.distSection('توزیع شغل', overview.distributions.employment));
    lines.push(...this.distSection('توزیع مالکیت', overview.distributions.ownership));
    lines.push('');
    lines.push('سری زمانی ثبت خانوار');
    lines.push('دوره,تعداد');
    for (const p of overview.timeSeries.householdsRegistered) {
      lines.push([p.period, String(p.value)].map(this.esc).join(','));
    }
    lines.push('');
    lines.push('سری زمانی رویداد خط سیر');
    lines.push('دوره,تعداد');
    for (const p of overview.timeSeries.trajectoryEvents) {
      lines.push([p.period, String(p.value)].map(this.esc).join(','));
    }
    return lines.join('\n');
  }

  /** Excel-compatible workbook as SpreadsheetML (opens in Excel) */
  buildExcelXml(overview: AnalyticsOverview, title = 'گزارش تحلیلی'): string {
    const rows: string[] = [];
    const addRow = (cells: string[]) => {
      rows.push(`<Row>${cells.map((c) => `<Cell><Data ss:Type="String">${this.xmlEsc(c)}</Data></Cell>`).join('')}</Row>`);
    };
    const addNumRow = (label: string, value: number | string) => {
      rows.push(
        `<Row><Cell><Data ss:Type="String">${this.xmlEsc(label)}</Data></Cell>`
        + `<Cell><Data ss:Type="String">${this.xmlEsc(String(value))}</Data></Cell></Row>`,
      );
    };

    addRow([title]);
    addRow([`تولید: ${overview.generatedAt}`]);
    addRow([`فیلتر: ${describeAnalyticsFilter(overview.filters ?? {})}`]);
    addRow([]);
    addRow(['KPI', 'مقدار']);
    for (const k of overview.kpis) addNumRow(k.title, k.value);

    const pushDist = (name: string, buckets: DistributionBucket[]) => {
      addRow([]);
      addRow([name, 'تعداد', 'درصد']);
      for (const b of buckets) {
        rows.push(
          `<Row>`
          + `<Cell><Data ss:Type="String">${this.xmlEsc(b.label)}</Data></Cell>`
          + `<Cell><Data ss:Type="Number">${b.count}</Data></Cell>`
          + `<Cell><Data ss:Type="Number">${b.percent}</Data></Cell>`
          + `</Row>`,
        );
      }
    };
    pushDist('درآمد', overview.distributions.income);
    pushDist('تحصیلات', overview.distributions.education);
    pushDist('شغل', overview.distributions.employment);
    pushDist('مالکیت', overview.distributions.ownership);

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Analytics">
  <Table>
   ${rows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;
  }

  buildPdfHtml(overview: AnalyticsOverview, title = 'گزارش تحلیلی مدیران شهری'): string {
    const kpiRows = overview.kpis.map((k) =>
      `<tr><td>${k.title}</td><td>${k.value}${k.unit ? ' ' + k.unit : ''}</td></tr>`).join('');

    const distTable = (name: string, buckets: DistributionBucket[]) => `
      <h3>${name}</h3>
      <table><thead><tr><th>دسته</th><th>تعداد</th><th>درصد</th></tr></thead>
      <tbody>${buckets.map((b) =>
        `<tr><td>${b.label}</td><td>${b.count}</td><td>${b.percent}%</td></tr>`).join('')}</tbody></table>`;

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  body { font-family: Tahoma, Vazirmatn, sans-serif; padding: 24px; color: #15202b; }
  h1 { color: #0f4c5c; font-size: 20px; }
  h3 { color: #0f4c5c; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
  th, td { border: 1px solid #d7e0e7; padding: 8px; text-align: right; }
  th { background: #e6f1f4; }
  .meta { color: #5b6b7a; font-size: 12px; margin-bottom: 20px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">زمان تولید: ${new Date(overview.generatedAt).toLocaleString('fa-IR')}</div>
  <div class="meta">فیلتر: ${describeAnalyticsFilter(overview.filters ?? {})}</div>
  <h3>شاخص‌های کلیدی</h3>
  <table><thead><tr><th>شاخص</th><th>مقدار</th></tr></thead><tbody>${kpiRows}</tbody></table>
  ${distTable('توزیع درآمد', overview.distributions.income)}
  ${distTable('توزیع تحصیلات', overview.distributions.education)}
  ${distTable('توزیع شغل', overview.distributions.employment)}
  ${distTable('توزیع مالکیت', overview.distributions.ownership)}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
</body>
</html>`;
  }

  /** Binary PDF (application/pdf) for download — ASCII-safe tabular export. */
  buildPdf(overview: AnalyticsOverview, title = 'Analytics report'): Buffer {
    const headers = ['KPI', 'Value'];
    const rows = overview.kpis.map((k) => [k.title, `${k.value}${k.unit ? ` ${k.unit}` : ''}`]);
    for (const [name, buckets] of [
      ['Income', overview.distributions.income],
      ['Education', overview.distributions.education],
      ['Employment', overview.distributions.employment],
      ['Ownership', overview.distributions.ownership],
    ] as Array<[string, DistributionBucket[]]>) {
      rows.push([`--- ${name} ---`, '']);
      for (const b of buckets) rows.push([b.label, `${b.count} (${b.percent}%)`]);
    }
    return buildSimplePdf({
      title,
      subtitle: `Generated: ${overview.generatedAt} | ${describeAnalyticsFilter(overview.filters ?? {})}`,
      headers,
      rows,
    });
  }

  private distSection(title: string, buckets: DistributionBucket[]): string[] {
    const lines = ['', title, 'دسته,تعداد,درصد'];
    for (const b of buckets) {
      lines.push([b.label, String(b.count), String(b.percent)].map(this.esc).join(','));
    }
    return lines;
  }

  private esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  private xmlEsc = (v: string) =>
    String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
