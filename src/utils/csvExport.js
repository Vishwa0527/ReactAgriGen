/**
 * CSV export utility.
 * Builds a UTF-8 BOM-prefixed CSV and triggers a browser download.
 *
 * @param {string}   filename — e.g. 'fleet-register.csv'
 * @param {string[]} headers  — column header row
 * @param {any[][]}  rows     — data rows (values are stringified)
 */
export function exportToCsv(filename, headers, rows) {
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ];
  const csv  = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
