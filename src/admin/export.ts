import type { StudentRow } from './admin.types';

/**
 * Spreadsheet programs run text that starts with = + - or @ as a formula. A student could type
 * a name like "=HYPERLINK(...)", so such cells are prefixed with an apostrophe to stay plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string): string {
  let text = value ?? '';
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function studentsToCsv(rows: StudentRow[]): string {
  const header = ['Nickname', 'Name', 'Email', 'WhatsApp', 'Joined', 'Last sign-in', 'Role', 'Suspended'];
  const lines = rows.map((row) =>
    [row.username, row.fullName, row.email, row.phone, row.joinedAt, row.lastSignInAt ?? '', row.role, row.suspended ? 'yes' : ''].map(csvCell).join(','),
  );
  return [header.join(','), ...lines].join('\r\n');
}

/** One email per line, ready to copy and paste. */
export function studentsToText(rows: StudentRow[]): string {
  return rows.map((row) => row.email).join('\n');
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadFile(filename: string, content: string, mimeType: string, excelFriendly = false): void {
  // For CSV, a byte-order mark makes Excel read accents and non-English names correctly.
  const blob = new Blob(excelFriendly ? ['\uFEFF', content] : [content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
