// Single-task state lives on the stack. Allocate only output rows/errors and slices.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const rows = [], errors = [];
  const n = text.length;
  const unquotedToken = /[,\r\n]/g;
  const quotedToken = /["\r\n]/g;
  let p = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1, columns = null, width = -1;
  let lastQuote = -2;

  while (p < n) {
    // Completely empty physical lines are not records.
    const initial = text.charCodeAt(p);
    if (initial === 10) { ++p; ++line; continue; }
    if (initial === 13 && text.charCodeAt(p + 1) === 10) {
      p += 2; ++line; continue;
    }
    const recordLine = line;
    const rowIndex = header && width < 0 ? null : rows.length;
    const fields = width < 0 ? [] : new Array(width);
    let length = 0;
    let terminator = 44;
    let opened = false;
    do {
      let start = p;
      let value = '';
      let quotedClosed = false;
      opened = text.charCodeAt(p) === 34;
      if (opened) {
        const quoteStart = ++p;
        if (lastQuote === -2) lastQuote = text.lastIndexOf('"');
        let qLine = line;
        start = p;
        quotedToken.lastIndex = p;
        while (quotedToken.lastIndex <= lastQuote && quotedToken.test(text)) {
          p = quotedToken.lastIndex - 1;
          const ch = text.charCodeAt(p);
          if (ch === 34) {
            if (text.charCodeAt(p + 1) === 34) {
              value += text.slice(start, p + 1);
              p += 2;
              start = p;
              quotedToken.lastIndex = p;
              continue;
            }
            value += text.slice(start, p);
            ++p;
            line = qLine;
            quotedClosed = true;
            break;
          }
          if (ch === 13) {
            value += text.slice(start, p) + '\n';
            p += text.charCodeAt(p + 1) === 10 ? 2 : 1;
            start = p;
            quotedToken.lastIndex = p;
            ++qLine;
            continue;
          }
          if (ch === 10) ++qLine;
        }
        if (!quotedClosed) {
          value = '"';
          p = quoteStart;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: rowIndex });
        }
        start = p;
      }
      let ch = -1, junk = false;
      // Every token is one UTF-16 code unit, so .test gives its
      // offset via lastIndex without creating match-array objects.
      unquotedToken.lastIndex = p;
      for (;;) {
        if (!unquotedToken.test(text)) { p = n; break; }
        p = unquotedToken.lastIndex - 1;
        ch = text.charCodeAt(p);
        if (ch !== 13 || text.charCodeAt(p + 1) === 10) break;
        if (p !== start) {
          value += text.slice(start, p);
          if (quotedClosed) junk = true;
        }
        start = p + 1;
        errors.push({ code: 'stray_cr', line: recordLine, row: rowIndex });
      }
      if (p !== start) {
        value += text.slice(start, p);
        if (quotedClosed) junk = true;
      }
      if (junk) errors.push({ code: 'quote_junk', line: recordLine, row: rowIndex });
      fields[length++] = value;
      terminator = p === n ? -1 : ch;
      if (terminator === 44) ++p;
      else if (terminator === 10) { ++p; ++line; }
      else if (terminator === 13) { p += 2; ++line; }
    } while (terminator === 44);

    const size = length;
    if (size === 1 && fields[0] === '' && !opened) continue;
    if (width < 0) {
      width = size;
      if (header) { columns = fields; continue; }
    } else if (size < width) {
      errors.push({ code: 'short_row', line: recordLine, row: rowIndex, fields: size });
      for (let i = size; i < width; ++i) fields[i] = '';
    } else if (size > width) {
      const extra = fields.slice(width);
      fields.length = width;
      errors.push({ code: 'long_row', line: recordLine, row: rowIndex, extra });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
