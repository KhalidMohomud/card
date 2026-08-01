// Spreadsheet applications execute cells beginning with these characters as
// formulas. Prefixing with an apostrophe preserves the visible value as text.
const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

export function escapeCsvCell(value: string | number) {
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
