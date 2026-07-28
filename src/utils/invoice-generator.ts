import { Order, Customization } from '@/types';
import { numberToWords } from '@/lib/utils';

export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function fmtDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export function generateInvoiceHtml(order: Order, isQuoteDoc: boolean, settings: Customization | null) {
  const items = order.items || [];
  const regards = settings?.regards || 'Best Regards,';
  const showSerials = order.showSerialsOnInvoice || false;
  const netTotal = order.netTotal || 0;
  const customDetailText = (settings?.customDetailText || '').replace(/\n/g, '<br/>');
  const customDetailHtml = (settings?.customDetailHtml || '').trim();
  const customStyle = [
    settings?.customDetailBold ? 'font-weight:700;' : '',
    settings?.customDetailItalic ? 'font-style:italic;' : ''
  ].join('');
  const showExecName = !!settings?.execName && settings.execName.trim().toLowerCase() !== 'administrator';
  const showExecDetails = !!settings?.execDetails && settings.execDetails.trim().toLowerCase() !== 'head of operations';

  const itemRows = items.map((item, i) => {
    const serialLine = showSerials && item.serialNumbers && item.serialNumbers.length > 0 
      ? `<br/><span style="font-size:14px;color:#444;font-style:italic;">S/N: ${item.serialNumbers.join(', ')}</span>` 
      : '';
    return `
      <tr>
        <td style="border:1px solid #777;padding:5px 7px;text-align:center;">${i + 1}.</td>
        <td style="border:1px solid #777;padding:5px 7px;">${item.productName || ''}${serialLine}</td>
        <td style="border:1px solid #777;padding:5px 7px;text-align:right;">${formatNumber(item.price)}</td>
        <td style="border:1px solid #777;padding:5px 7px;text-align:right;">${item.quantity}</td>
        <td style="border:1px solid #777;padding:5px 7px;text-align:right;">${formatNumber(item.total)}</td>
      </tr>
    `;
  }).join('');

  const discountRow = (order.discount > 0) ? `
    <tr>
      <td colspan="3" style="border:1px solid #777;padding:5px 7px;"></td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;font-size:15px;">Discount</td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;">-${formatNumber(order.discount)}</td>
    </tr>` : '';

  const extraRow = (order.extra > 0) ? `
    <tr>
      <td colspan="3" style="border:1px solid #777;padding:5px 7px;"></td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;font-size:15px;">Extra</td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;">+${formatNumber(order.extra)}</td>
    </tr>` : '';

  const paymentStatus = order.retailPaymentStatus || 'paid';
  const isPartialPayment = paymentStatus === 'partial';
  const isUnpaid = paymentStatus === 'unpaid';
  const paidAmount = isPartialPayment ? (order.partialAmount || 0) : (paymentStatus === 'paid' ? netTotal : 0);
  const dueAmount = Math.max(netTotal - paidAmount, 0);

  const paidRow = (isPartialPayment || isUnpaid) ? `
    <tr>
      <td colspan="3" style="border:1px solid #777;padding:5px 7px;"></td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;font-size:15px;">Paid</td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;">${formatNumber(paidAmount)}</td>
    </tr>` : '';

  const dueRow = (isPartialPayment || isUnpaid) ? `
    <tr>
      <td colspan="3" style="border:1px solid #777;padding:5px 7px;"></td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;font-size:15px;font-weight:bold;">Due</td>
      <td style="border:1px solid #777;padding:5px 7px;text-align:right;font-weight:bold;">${formatNumber(dueAmount)}</td>
    </tr>` : '';

  const totalLabel = 'Total';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-size:16px; }
  html, body { height:auto; }
  body, div, p, span, td, th, table, tr, strong, em { font-size:16px; }
  .page { font-family: 'Times New Roman', Times, serif; font-size:16px; background:#fff; color:#000; margin:0; }
  .page { width:190mm; min-height:auto; padding:42mm 16mm 16mm 16mm; margin:0 auto; background:white; position:relative; page-break-inside:avoid; }
  @page { size: A4 portrait; margin: 10mm; }
  @media print { body { margin:0; } .page { padding:30mm 10mm 10mm 10mm; } }
</style>
</head>
<body>
<div class="page">
  <h2 style="font-size:24px;font-weight:bold;margin-bottom:16px;">${isQuoteDoc ? 'QUOTATION' : 'INVOICE'}</h2>

  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tr>
      <td style="font-size:16px;padding:0;">Order ID: <strong>${order.id || '-'}</strong></td>
      <td style="font-size:16px;padding:0;text-align:right;">Date: &nbsp; <strong>${fmtDate(order.date)}</strong></td>
    </tr>
  </table>

  <div style="margin-bottom:18px;font-size:16px;line-height:1.8;">
    <div>Customer's Name: &nbsp;&nbsp; ${order.customerName || '-'}</div>
    ${order.customerAddress ? `<div>Customer's Address: &nbsp; ${order.customerAddress}</div>` : ''}
    ${order.customerPhone ? `<div>Contact Number: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${order.customerPhone}</div>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:16px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #777;padding:6px 7px;text-align:center;width:44px;">SI</th>
        <th style="border:1px solid #777;padding:6px 7px;text-align:center;">Description</th>
        <th style="border:1px solid #777;padding:6px 7px;text-align:right;width:85px;">Unit Price</th>
        <th style="border:1px solid #777;padding:6px 7px;text-align:right;width:72px;">Quantity</th>
        <th style="border:1px solid #777;padding:6px 7px;text-align:right;width:95px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${discountRow}
      ${extraRow}
      <tr>
        <td colspan="3" style="border:1px solid #777;padding:6px 7px;"></td>
        <td style="border:1px solid #777;padding:6px 7px;text-align:right;font-weight:bold;">${totalLabel}</td>
        <td style="border:1px solid #777;padding:6px 7px;text-align:right;font-weight:bold;">${formatNumber(netTotal)}</td>
      </tr>
      ${paidRow}
      ${dueRow}
    </tbody>
  </table>

  <div style="font-size:12px;margin-bottom:28px;">
    <em>In Word: &nbsp; ${numberToWords(Math.round(dueAmount || netTotal))} Taka Only</em>
  </div>

  <div style="font-size:12px;margin-top:8px;">
    <div style="margin-bottom:8px;">${regards}</div>
    ${showExecName ? `<div style="margin-top:36px;"><strong>${settings.execName}</strong></div>` : ''}
    ${showExecDetails ? `<div style="font-size:11px;">${settings.execDetails}</div>` : ''}
    ${(customDetailHtml || customDetailText) ? `
      <div style="margin-top:12px; ${settings.customDetailBoxed === false ? '' : 'border:1px solid #777;padding:8px;'} ${customStyle}">
        ${customDetailHtml || customDetailText}
      </div>
    ` : ''}
  </div>
</div>
</body>
</html>`;
}

export function printDoc(html: string) {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }
}