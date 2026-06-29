export function parseCsv(text, { hasHeader = true, delimiter = ',' } = {}) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        if (char === '\r') i++;
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  if (!hasHeader || rows.length === 0) return rows;

  const headers = rows[0];
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = rows[i][j] || '';
    });
    result.push(obj);
  }
  return result;
}

export function sanitizeCsvField(value) {
  const str = String(value ?? '');
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function toCsvRow(fields) {
  return fields
    .map((f) => {
      const str = String(f ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return sanitizeCsvField(str);
    })
    .join(',');
}
