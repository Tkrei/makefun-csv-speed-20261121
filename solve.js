// Parse one input independently. Keep fast slices for runs without delimiters.
export function run(input) {
  const text = String(input.text), header = input.header === true;
  const rows = [], errors = [];
  let columns = null, width = -1;
  let p = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  let line = 1, recordLine = 1, row = [];
  let value = '', recordPresent = false;
  const sep = /[,\r\n]/g;
  const qSep = /["\r\n]/g;

  function error(code, details) {
    errors.push({ code, line: recordLine,
      row: header && width < 0 ? null : rows.length, ...details });
  }

  function record() {
    if (recordPresent) {
      row.push(value);
      if (width < 0) {
        width = row.length;
        if (header) columns = row;
        else rows.push(row);
      } else {
        const len = row.length;
        if (len < width) {
          error('short_row', { fields: len });
          for (let j = len; j < width; ++j) row.push('');
        } else if (len > width) {
          error('long_row', { extra: row.slice(width) });
          row.length = width;
        }
        rows.push(row);
      }
      row = [];
    }
    value = '';
    recordPresent = false;
  }

  while (p < n) {
    let junk = false, quoted = false;
    if (text.charCodeAt(p) === 34) {
      let at = p + 1, start = at, qLine = line, parts = '';
      qSep.lastIndex = at;
      let m;
      while ((m = qSep.exec(text)) !== null) {
        at = m.index;
        const ch = text.charCodeAt(at);
        if (ch === 34) {
          if (text.charCodeAt(at + 1) === 34) {
            parts += text.slice(start, at + 1);
            start = at + 2;
            qSep.lastIndex = start;
            continue;
          }
          value = parts + text.slice(start, at);
          p = at + 1;
          line = qLine;
          quoted = true;
          recordPresent = true;
          break;
        }
        ++qLine;
        if (ch === 13) {
          parts += text.slice(start, at) + '\n';
          start = at + (text.charCodeAt(at + 1) === 10 ? 2 : 1);
          qSep.lastIndex = start;
        }
      }
      if (!quoted) error('unterminated_quote');
    }

    for (;;) {
      sep.lastIndex = p;
      const hit = sep.exec(text);
      const end = hit === null ? n : hit.index;
      if (p < end) {
        value += text.slice(p, end);
        recordPresent = true;
        if (quoted) junk = true;
      }
      p = end;
      if (p === n) {
        if (junk) error('quote_junk');
        break;
      }
      const ch = text.charCodeAt(p++);
      if (ch === 13 && text.charCodeAt(p) !== 10) {
        error('stray_cr');
        continue;
      }
      if (junk) error('quote_junk');
      if (ch === 44) {
        row.push(value);
        value = '';
        recordPresent = true;
      } else {
        if (ch === 13) ++p;
        record();
        recordLine = ++line;
      }
      break;
    }
  }
  record();
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
