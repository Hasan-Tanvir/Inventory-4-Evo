import { Customization } from '@/types';
import { formatNumber } from './invoice-generator';

function getOrdinalSuffix(d: number) {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

function formatOrdinalDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  
  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

export function generateReportHtml(
  type: string,
  entityName: string,
  data: { 
    rows?: any[], 
    grouped?: Record<string, { rows: any[], subQty: number, subAmount: number, subCommission: number }>,
    totalQty: number, 
    totalAmount: number, 
    totalCommission?: number,
    isSplitted?: boolean
  }, 
  fromDate: string, 
  toDate: string, 
  settings: Customization,
  showCommission: boolean = false,
  comment?: string,
  descriptionLabel: string = "Product Description"
) {
  const logoHtml = settings.logo ? `<img src="${settings.logo}" style="max-height: 60px; margin-bottom: 10px;" />` : '';

  let contentHtml = '';

  if (data.isSplitted && data.grouped) {
    contentHtml = Object.entries(data.grouped).map(([catName, group]) => `
      <div style="margin-bottom: 35px;">
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #000; border-bottom: none;">
          <span style="font-weight: bold; font-size: 11px; text-transform: uppercase;">Category: ${catName}</span>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="width:40px; border:1px solid #000; padding:8px; background:#eee; font-size:10px;">SI</th>
              <th style="border:1px solid #000; padding:8px; background:#eee; font-size:10px; text-align:left;">${descriptionLabel}</th>
              <th style="width:80px; border:1px solid #000; padding:8px; background:#eee; font-size:10px; text-align:center;">Qty</th>
              <th style="width:120px; border:1px solid #000; padding:8px; background:#eee; font-size:10px; text-align:right;">Total Amount</th>
              ${showCommission ? `<th style="width:100px; border:1px solid #000; padding:8px; background:#eee; font-size:10px; text-align:right;">Commission</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${group.rows.map((r, i) => `
              <tr>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:6px; font-weight: normal;">${r.name}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${r.qty}</td>
                <td style="border:1px solid #000; padding:6px; text-align:right;">${formatNumber(r.amount)}</td>
                ${showCommission ? `<td style="border:1px solid #000; padding:6px; text-align:right;">${formatNumber(r.commission || 0)}</td>` : ''}
              </tr>
            `).join('')}
            <tr style="background:#f1f5f9;">
              <td colspan="2" style="border:1px solid #000; padding:10px; text-align:right; font-size:12px; font-weight:bold;">SUBTOTAL</td>
              <td style="border:1px solid #000; padding:10px; text-align:center; font-size:12px; font-weight:bold;">${group.subQty}</td>
              <td style="border:1px solid #000; padding:10px; text-align:right; font-size:12px; font-weight:bold;">${formatNumber(group.subAmount)}</td>
              ${showCommission ? `<td style="border:1px solid #000; padding:10px; text-align:right; font-size:12px; font-weight:bold;">${formatNumber(group.subCommission)}</td>` : ''}
            </tr>
          </tbody>
        </table>
      </div>
    `).join('');
  } else if (data.rows) {
    contentHtml = `
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <thead>
          <tr>
            <th style="width:40px; border:1px solid #000; padding:10px; background:#eee; font-weight:bold; text-transform:uppercase; font-size:10px;">SI</th>
            <th style="border:1px solid #000; padding:10px; background:#eee; font-weight:bold; text-transform:uppercase; font-size:10px; text-align:left;">${descriptionLabel}</th>
            <th style="width:80px; border:1px solid #000; padding:10px; background:#eee; font-weight:bold; text-transform:uppercase; font-size:10px; text-align:center;">Qty</th>
            <th style="width:120px; border:1px solid #000; padding:10px; background:#eee; font-weight:bold; text-transform:uppercase; font-size:10px; text-align:right;">Total Amount</th>
            ${showCommission ? `<th style="width:100px; border:1px solid #000; padding:10px; background:#eee; font-weight:bold; text-transform:uppercase; font-size:10px; text-align:right;">Commission</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${data.rows.map((r, i) => `
            <tr>
              <td style="border:1px solid #000; padding:8px; text-align:center;">${i + 1}</td>
              <td style="border:1px solid #000; padding:8px; font-weight: normal;">${r.name}</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">${r.qty}</td>
              <td style="border:1px solid #000; padding:8px; text-align:right;">${formatNumber(r.amount)}</td>
              ${showCommission ? `<td style="border:1px solid #000; padding:8px; text-align:right;">${formatNumber(r.commission || 0)}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size:12px; color:#000; }
  .page { width:210mm; min-height:297mm; padding:20mm 20mm 1.5in 20mm; margin:0 auto; background:white; position:relative; }
  .header { text-align:center; margin-bottom:30px; border-bottom:2px solid #000; padding-bottom:15px; }
  .company-name { font-size:22px; font-weight:bold; margin-bottom:8px; }
  .report-type { font-size:14px; font-weight:bold; color: #666; margin-bottom: 2px; }
  .entity-name { font-size:20px; font-weight:bold; color: #000; margin-bottom:8px; }
  .period { font-size:13px; font-style:italic; color: #333; margin-top: 5px; }
  
  .grand-total-row { font-weight:bold; background:#f1f5f9; color:#000; }
  .grand-total-row td { border:1px solid #000; padding:10px; }

  .comment-section {
    margin-top: 30px;
    font-size: 12pt;
    line-height: 1.5;
  }

  .footer { position: absolute; bottom: 20mm; right: 20mm; font-size:10px; text-align:right; font-style:italic; color: #000; }
  @media print { .page { padding:10mm 10mm 1.5in 10mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoHtml}
    <div class="company-name">${settings.title}</div>
    <div class="report-type">${type}</div>
    <div class="entity-name">${entityName === 'all' ? 'All ' + type : entityName}</div>
    <div class="period">Reporting Period: ${formatOrdinalDate(fromDate)} to ${formatOrdinalDate(toDate)}</div>
  </div>

  ${contentHtml}

  <table style="width:100%; border-collapse:collapse; margin-top:10px;">
    <tr class="grand-total-row">
      <td colspan="2" style="text-align:right; font-size:11px;">GRAND TOTAL</td>
      <td style="width:80px; text-align:center;">${data.totalQty}</td>
      <td style="width:120px; text-align:right;">${formatNumber(data.totalAmount)}</td>
      ${showCommission ? `<td style="width:100px; text-align:right;">${formatNumber(data.totalCommission || 0)}</td>` : ''}
    </tr>
  </table>

  ${comment ? `
    <div class="comment-section">
      <strong>Comment:</strong> ${comment}
    </div>
  ` : ''}

  <div class="footer">
    Generated on: ${new Date().toLocaleString()}
  </div>
</div>
</body>
</html>`;
}