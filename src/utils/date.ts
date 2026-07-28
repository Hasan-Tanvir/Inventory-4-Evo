export const getTodayISO = () => {
  // Use Bangladesh Time (GMT+6)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

export const getCurrentTimestamp = () => {
  // Use Bangladesh Time (GMT+6)
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  return bdTime.toISOString();
};

export const formatDisplayDate = (dateValue?: string) => {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  
  // Ensure we display based on local date components if it's just a YYYY-MM-DD string
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};