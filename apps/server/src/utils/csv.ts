const DEFAULT_EOL = '\r\n';

export const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  const escaped = text.replace(/"/g, '""');
  const needsQuotes = /[",\r\n]/.test(escaped);
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const toCsv = (
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined | Date>>,
  eol: string = DEFAULT_EOL,
): string => {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  return lines.join(eol);
};

export const csvEol = DEFAULT_EOL;
