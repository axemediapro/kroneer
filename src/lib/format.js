const pad = (n) => String(n).padStart(2, '0');
const parse = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export const formatCurrency = (amount) =>
  '€' + (Number(amount) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (v) => {
  const d = parse(v);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '-';
};

export const formatDateTime = (v) => {
  const d = parse(v);
  return d ? `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '-';
};

export const timeAgo = (v) => {
  if (!v) return '';
  const seconds = Math.floor((Date.now() - new Date(v)) / 1000);
  if (seconds < 60) return 'sapo tani';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `para ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `para ${hours} orëve`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'dje';
  if (days < 30) return `para ${days} ditësh`;
  return `para ${Math.floor(days / 30)} muajsh`;
};