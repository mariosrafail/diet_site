(function (root) {
  'use strict';

  const WIDTH = 1240;
  const HEIGHT = 1754;
  const MARGIN = 72;
  const BOTTOM = HEIGHT - 130;
  const INK = '#162d35';
  const MUTED = '#64787d';
  const ACCENT = '#137c70';
  const number = value => new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 }).format(value);
  const font = (ctx, size, weight = 400) => { ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`; };

  function wrap(ctx, text, width) {
    const lines = [];
    let line = '';
    for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= width) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (ctx.measureText(line + char).width > width && line) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function box(ctx, x, y, width, height, color, radius = 16) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function write(ctx, text, x, y, size = 22, color = INK, weight = 400, align = 'left') {
    font(ctx, size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(String(text), x, y);
    ctx.textAlign = 'left';
  }

  function renderPages(data) {
    const pages = [];
    let canvas, ctx, y;
    const name = data.name || 'Ημερήσιο πλάνο';
    const date = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }).format(data.date || new Date());

    function newPage(first = false) {
      canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      pages.push(canvas);
      box(ctx, MARGIN, 64, 8, 48, ACCENT, 4);
      write(ctx, 'ANABOL DIET', MARGIN + 24, 96, 26, ACCENT, 700);
      write(ctx, date, WIDTH - MARGIN, 96, 19, MUTED, 400, 'right');
      if (!first) {
        font(ctx, 21, 600);
        write(ctx, wrap(ctx, name, WIDTH - MARGIN * 2)[0], MARGIN, 148, 21, INK, 600);
        y = 188;
        return;
      }
      write(ctx, 'Η διατροφή σου', MARGIN, 173, 48, INK, 700);
      font(ctx, 25, 600);
      const nameLines = wrap(ctx, name, WIDTH - MARGIN * 2);
      nameLines.forEach((line, index) => write(ctx, line, MARGIN, 220 + index * 32, 25, MUTED, 600));
      y = 246 + (nameLines.length - 1) * 32;
      const metrics = [
        ['Θερμίδες', `${number(data.totals.calories)} kcal`],
        ['Πρωτεΐνη', `${number(data.totals.protein)} g`],
        ['Υδατάνθρακες', `${number(data.totals.carbs)} g`],
        ['Λιπαρά', `${number(data.totals.fat)} g`]
      ];
      const gap = 14;
      const width = (WIDTH - MARGIN * 2 - gap * 3) / 4;
      metrics.forEach(([label, value], index) => {
        const x = MARGIN + index * (width + gap);
        box(ctx, x, y, width, 98, index === 0 ? '#e4f3ee' : '#f2f5f4');
        write(ctx, label, x + 18, y + 33, 19, MUTED);
        write(ctx, value, x + 18, y + 72, 28, INK, 700);
      });
      y += 132;
      write(ctx, 'ΗΜΕΡΗΣΙΟΙ ΣΤΟΧΟΙ', MARGIN, y, 18, ACCENT, 700);
      y += 34;
      write(ctx, `${number(data.targets.calories)} kcal  /  Πρωτεΐνη ${number(data.targets.protein)} g`, MARGIN, y, 22, INK, 600);
      y += 32;
      write(ctx, `Λιπαρά ${number(data.targets.calories * 0.25 / 9)}-${number(data.targets.calories * 0.30 / 9)} g  /  Υδατάνθρακες ${number(data.targets.calories * 0.35 / 4)}-${number(data.targets.calories * 0.45 / 4)} g`, MARGIN, y, 20, MUTED);
      y += 42;
    }

    function mealHeader(meal, index, continued = false) {
      font(ctx, 27, 700);
      const title = wrap(ctx, `${String(index + 1).padStart(2, '0')}  ${meal.title}${continued ? ' (συνέχεια)' : ''}`, WIDTH - MARGIN * 2 - 32);
      const titleHeight = title.length * 34 + 20;
      font(ctx, 18);
      const description = continued ? [] : wrap(ctx, meal.description, WIDTH - MARGIN * 2 - 32);
      if (y + titleHeight + description.length * 25 + 135 > BOTTOM) newPage();
      box(ctx, MARGIN, y, WIDTH - MARGIN * 2, titleHeight, '#eaf3f0', 10);
      title.forEach((line, lineIndex) => write(ctx, line, MARGIN + 16, y + 35 + lineIndex * 34, 27, INK, 700));
      y += titleHeight;
      description.forEach(line => { write(ctx, line, MARGIN + 16, y + 25, 18, MUTED); y += 25; });
      y += 29;
      write(ctx, 'ΤΡΟΦΙΜΟ', MARGIN + 16, y, 15, MUTED, 700);
      for (const [label, x] of [['ΠΟΣΟΤΗΤΑ', 762], ['kcal', 870], ['Π (g)', 970], ['Υ (g)', 1060], ['Λ (g)', 1150]]) {
        write(ctx, label, x, y, 15, MUTED, 700, 'right');
      }
      y += 16;
    }

    newPage(true);
    data.meals.forEach((meal, index) => {
      mealHeader(meal, index);
      meal.rows.forEach((row, rowIndex) => {
        font(ctx, 22, 600);
        const foodLines = wrap(ctx, row.name, 530);
        font(ctx, 17);
        const noteLines = wrap(ctx, row.note, 530);
        let segments = foodLines.map(text => ({ text, note: false })).concat(noteLines.map(text => ({ text, note: true })));
        let firstSegment = true;
        while (segments.length) {
          if (y + 60 > BOTTOM) { newPage(); mealHeader(meal, index, true); }
          const maxLines = Math.max(1, Math.floor((BOTTOM - y - 20) / 28));
          const part = segments.splice(0, maxLines);
          const height = Math.max(58, part.length * 28 + 20);
          if (rowIndex % 2 === 0) box(ctx, MARGIN, y, WIDTH - MARGIN * 2, height, '#f7f9f8', 6);
          part.forEach((line, lineIndex) => write(ctx, line.text, MARGIN + 16, y + 32 + lineIndex * 28, line.note ? 17 : 22, line.note ? MUTED : INK, line.note ? 400 : 600));
          if (firstSegment) {
            write(ctx, `${number(row.qty)} ${row.unit}`, 762, y + 32, 20, INK, 600, 'right');
            for (const [key, x] of [['calories', 870], ['protein', 970], ['carbs', 1060], ['fat', 1150]]) {
              write(ctx, number(row[key]), x, y + 32, 20, MUTED, 400, 'right');
            }
          }
          y += height;
          firstSegment = false;
        }
      });
      if (y + 48 > BOTTOM) { newPage(); mealHeader(meal, index, true); }
      write(ctx, 'Σύνολο γεύματος', MARGIN + 16, y + 28, 19, ACCENT, 700);
      for (const [key, x] of [['calories', 870], ['protein', 970], ['carbs', 1060], ['fat', 1150]]) {
        write(ctx, number(meal.totals[key]), x, y + 28, 20, ACCENT, 700, 'right');
      }
      y += 74;
    });
    pages.forEach((page, index) => {
      const footer = page.getContext('2d');
      footer.fillStyle = '#dce6e2';
      footer.fillRect(MARGIN, HEIGHT - 100, WIDTH - MARGIN * 2, 1);
      write(footer, 'Π: Πρωτεΐνη  /  Υ: Υδατάνθρακες  /  Λ: Λιπαρά', MARGIN, HEIGHT - 66, 16, MUTED);
      write(footer, `${index + 1} / ${pages.length}`, WIDTH - MARGIN, HEIGHT - 66, 17, MUTED, 600, 'right');
      write(footer, 'Εξαγωγή των επιλεγμένων γευμάτων και των τρεχουσών ποσοτήτων.', MARGIN, HEIGHT - 38, 15, MUTED);
    });
    return pages;
  }

  // A4 PDF with a high-resolution JPEG per page; no external service or font dependency.
  function createPdf(pages) {
    const encode = text => new TextEncoder().encode(text);
    const chunks = [encode('%PDF-1.4\n')];
    let length = chunks[0].length;
    const offsets = [0];
    const append = bytes => { chunks.push(bytes); length += bytes.length; };
    const object = (id, parts) => {
      offsets[id] = length;
      append(encode(`${id} 0 obj\n`));
      parts.forEach(part => append(typeof part === 'string' ? encode(part) : part));
      append(encode('\nendobj\n'));
    };
    object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    object(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`]);
    pages.forEach((canvas, index) => {
      const id = 3 + index * 3;
      const binary = atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]);
      const jpeg = Uint8Array.from(binary, char => char.charCodeAt(0));
      const commands = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
      object(id, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`]);
      object(id + 1, [`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
      object(id + 2, [`<< /Length ${encode(commands).length} >>\nstream\n${commands}endstream`]);
    });
    const xrefOffset = length;
    append(encode(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`));
    for (let id = 1; id < offsets.length; id += 1) append(encode(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`));
    append(encode(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportPlan(data, format) {
    if (!data.meals.length) throw new Error('Δεν υπάρχουν γεύματα με ποσότητες για εξαγωγή.');
    if (document.fonts) await document.fonts.ready;
    const pages = renderPages(data);
    const date = data.date || new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const filename = `diet-${String(data.slug || 'plan').replace(/[^a-z0-9_-]/gi, '-')}-${stamp}`;
    if (format === 'pdf') {
      download(createPdf(pages), `${filename}.pdf`);
      return 1;
    }
    // Keep each PNG within common browser canvas limits, even for long plans.
    const pagesPerImage = 4;
    let files = 0;
    for (let start = 0; start < pages.length; start += pagesPerImage) {
      const group = pages.slice(start, start + pagesPerImage);
      const image = document.createElement('canvas');
      image.width = WIDTH;
      image.height = HEIGHT * group.length;
      const ctx = image.getContext('2d');
      group.forEach((page, index) => ctx.drawImage(page, 0, index * HEIGHT));
      const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Δεν δημιουργήθηκε η εικόνα. Δοκίμασε την εξαγωγή PDF.');
      files += 1;
      download(blob, `${filename}${pages.length > pagesPerImage ? `-${files}` : ''}.png`);
    }
    return files;
  }

  const api = { renderPages, createPdf, exportPlan, wrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DietExport = api;
})(typeof window === 'undefined' ? globalThis : window);
