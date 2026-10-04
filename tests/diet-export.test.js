const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { renderPages, createPdf, exportPlan, wrap } = require('../diet-export');

test('export uses current selected meals, quantities, units and preparation notes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const makeRow = (name, qty, unit, macros, note = '') => ({
    dataset: { cal: macros[0], protein: macros[1], carbs: macros[2], fat: macros[3] },
    querySelector(selector) {
      return {
        '.food-main label': { textContent: name },
        '.food-main small': { textContent: unit === 'τεμ' ? 'ανά τεμάχιο' : 'ανά 100 g' },
        '.prep-note': { textContent: note },
        '.qty-box input': { value: String(qty) },
        '.qty-box span': { textContent: unit }
      }[selector];
    }
  });
  const rows = [
    makeRow('Ρύζι', 150, 'g', [350, 7, 76, 1], '150 g ωμό ≈ 450 g βρασμένο'),
    makeRow('Αυγά', 2, 'τεμ', [80, 7, 1, 5]),
    makeRow('Δεν έχει επιλεγεί ποσότητα', 0, 'g', [900, 0, 0, 100])
  ];
  const card = {
    querySelectorAll: () => rows,
    querySelector: selector => ({ textContent: selector.endsWith('h3') ? 'Επιλεγμένο γεύμα' : 'Περιγραφή' })
  };
  const context = {
    syncMealSelectionControls() {}, updatePrepNotes() {},
    getActiveMealCardsForTotals: () => [card],
    normalizeUnit: value => value,
    getRowFactor: (row, qty) => row.querySelector('.qty-box span').textContent === 'τεμ' ? qty : qty / 100,
    currentUserFullName: 'Marios', currentUserSlug: 'marios',
    targets: { calories: 2800, protein: 156 }
  };
  vm.createContext(context);
  vm.runInContext(source.match(/function collectDietExportData\(\) \{[\s\S]*?\n\}/)[0], context);
  const data = context.collectDietExportData();
  assert.equal(data.name, 'Marios');
  assert.equal(data.meals.length, 1);
  assert.equal(data.meals[0].rows.length, 2);
  assert.equal(data.meals[0].description, 'Περιγραφή');
  assert.equal(data.meals[0].rows[0].calories, 525);
  assert.equal(data.meals[0].rows[1].calories, 160);
  assert.equal(data.meals[0].rows[1].unit, 'τεμ');
  assert.match(data.meals[0].rows[0].note, /ωμό.*βρασμένο/);
  assert.equal(data.totals.calories, 685);
  assert.equal(data.totals.protein, 24.5);
  assert.equal(data.targets.protein, 156);
  context.targets.protein = 133;
  assert.equal(data.targets.protein, 156, 'export is a snapshot of the chosen targets');
});

test('PDF page tree and cross-reference offsets include every page', async () => {
  const canvas = { width: 1240, height: 1754, toDataURL: () => 'data:image/jpeg;base64,/9j/2Q==' };
  const blob = createPdf([canvas, canvas]);
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  assert.equal(blob.type, 'application/pdf');
  assert.match(text, /\/Count 2 \/Kids \[3 0 R 6 0 R\]/);
  const xrefOffset = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), 'xref');
  const entries = text.slice(xrefOffset).split('\n').slice(3, 11);
  entries.forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10));
    assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`));
  });
});

test('long food names wrap without losing characters', () => {
  const ctx = { measureText: text => ({ width: text.length * 10 }) };
  const text = 'Πολύμεγάλοόνοματροφίμου χωρίς κενά';
  const lines = wrap(ctx, text, 80);
  assert.ok(lines.every(line => ctx.measureText(line).width <= 80));
  assert.equal(lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
});

test('empty plans show an explicit error instead of downloading a blank document', async () => {
  await assert.rejects(exportPlan({ meals: [] }, 'pdf'), /Δεν υπάρχουν γεύματα/);
});

test('long plans paginate and preserve every food row above the footer', () => {
  const originalDocument = global.document;
  const canvases = [];
  global.document = { createElement() {
    const drawn = [];
    const ctx = {
      measureText: text => ({ width: text.length * 12 }),
      fillRect() {}, beginPath() {}, roundRect() {}, fill() {},
      fillText(text, x, y) { drawn.push({ text, x, y }); }
    };
    const canvas = { drawn, getContext: () => ctx };
    canvases.push(canvas);
    return canvas;
  } };
  try {
    const rows = Array.from({ length: 35 }, (_, index) => ({
      name: `Τρόφιμο ${index + 1}`, note: 'Σημείωση προετοιμασίας', qty: 150, unit: 'g',
      calories: 100, protein: 10, carbs: 10, fat: 2
    }));
    const pages = renderPages({
      name: 'Δείγμα', date: new Date('2026-10-04T12:00:00Z'),
      targets: { calories: 2800, protein: 156 },
      totals: { calories: 3500, protein: 350, carbs: 350, fat: 70 },
      meals: [{ title: 'Μεγάλο γεύμα', rows, totals: { calories: 3500, protein: 350, carbs: 350, fat: 70 } }]
    });
    assert.ok(pages.length > 1);
    const drawn = canvases.flatMap(canvas => canvas.drawn);
    for (const row of rows) {
      const matches = drawn.filter(item => item.text === row.name);
      assert.equal(matches.length, 1);
      assert.ok(matches[0].y < 1624, 'row must stay above footer');
    }
    assert.ok(drawn.some(item => item.text.includes('(συνέχεια)')));
    pages.forEach((page, index) => {
      assert.ok(page.drawn.some(item => item.text === `${index + 1} / ${pages.length}`));
    });
  } finally {
    global.document = originalDocument;
  }
});
