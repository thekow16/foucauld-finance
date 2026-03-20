/**
 * Export financial table data to CSV and trigger download.
 *
 * @param {Object[]} data - Array of period objects (e.g. FMP balance sheet rows)
 * @param {Array} rows - Row definitions: [label, key, highlight?, formatter?]
 * @param {Function} valueFormatter - Default formatter (receives raw value, returns string)
 * @param {string} filename - Download filename (without extension)
 */
export function exportTableToCsv(data, rows, valueFormatter, filename) {
  if (!data || data.length === 0) return;

  const years = data.map(d => d.calendarYear || d.date?.substring(0, 4) || "—");

  const csvRows = [];
  // Header
  csvRows.push(["Poste", ...years].join(";"));

  // Data rows
  for (const [label, key, , customFmt] of rows) {
    const isComputed = typeof key === "function";
    const fmt = customFmt || valueFormatter;
    const cells = data.map(d => {
      const v = isComputed ? key(d) : d[key];
      return fmt(v);
    });
    csvRows.push([label.replace(/;/g, ","), ...cells].join(";"));
  }

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
