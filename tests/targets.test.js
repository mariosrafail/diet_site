const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function createContext() {
  const selectHtml = html.match(/<select id="proteinMultiplier">([\s\S]*?)<\/select>/)[1];
  const options = Array.from(selectHtml.matchAll(/<option value="([^"]+)"/g), match => ({ value: match[1] }));
  let selectedValue = '1.7';
  const select = {
    options,
    get value() { return selectedValue; },
    // Native selects clear their value when no option matches the assigned string.
    set value(value) { selectedValue = options.some(option => option.value === value) ? value : ''; },
    appendChild(option) { options.push(option); }
  };
  const context = {
    refs: {
      proteinMultiplier: select,
      calorieTargetInput: { value: '2500' },
      weightInput: { value: '93' },
      goalCalories: {},
      goalProtein: {}
    },
    targets: {},
    document: { createElement: () => ({}) },
    updateUI() {}
  };
  vm.createContext(context);
  for (const name of ['applyDashboardTargets', 'applyTargets']) {
    const fn = source.match(new RegExp('(?:async )?function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
    vm.runInContext(fn, context);
  }
  return context;
}

test('Marios keeps a 156 g target when the saved multiplier reloads as numeric 2', async () => {
  const context = createContext();
  const saved = { calorieTarget: 2800, weight: 78, proteinMultiplier: 2 };
  for (let refresh = 0; refresh < 2; refresh += 1) {
    context.applyDashboardTargets(saved);
    await context.applyTargets({ persistRemote: false });
    assert.equal(context.refs.proteinMultiplier.value, '2.0');
    assert.equal(context.targets.protein, 156);
    assert.equal(context.refs.goalProtein.textContent, '156 g');
    assert.equal(context.targets.calories, 2800);
  }
});

test('decimal multipliers still load correctly', async () => {
  const context = createContext();
  context.applyDashboardTargets({ calorieTarget: 2800, weight: 78, proteinMultiplier: 1.7 });
  await context.applyTargets({ persistRemote: false });
  assert.equal(context.refs.proteinMultiplier.value, '1.7');
  assert.equal(context.targets.protein, 133);
});

test('a saved custom multiplier is preserved even when absent from the dropdown', async () => {
  const context = createContext();
  const saved = { calorieTarget: 2800, weight: 78, proteinMultiplier: 2.2 };
  context.applyDashboardTargets(saved);
  context.applyDashboardTargets(saved);
  await context.applyTargets({ persistRemote: false });
  assert.equal(context.refs.proteinMultiplier.value, '2.2');
  assert.equal(context.targets.protein, 172);
  assert.equal(context.refs.proteinMultiplier.options.filter(option => option.value === '2.2').length, 1);
});
