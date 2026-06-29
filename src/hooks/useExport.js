export function useExport() {

  const exportCSV = (data, filename, columns) => {
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(item =>
      columns.map(c => {
        let val = c.accessor(item);
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportCSV, exportJSON };
}
