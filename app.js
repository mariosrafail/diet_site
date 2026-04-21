const refs = {
  totalCalories: document.getElementById('totalCalories'),
  totalProtein: document.getElementById('totalProtein'),
  totalCarbs: document.getElementById('totalCarbs'),
  totalFat: document.getElementById('totalFat'),
  calorieBar: document.getElementById('calorieBar'),
  proteinBar: document.getElementById('proteinBar'),
  calorieStatus: document.getElementById('calorieStatus'),
  proteinStatus: document.getElementById('proteinStatus'),
  feedbackBox: document.getElementById('feedbackBox'),
  calorieTargetInput: document.getElementById('calorieTargetInput'),
  proteinMultiplier: document.getElementById('proteinMultiplier'),
  weightInput: document.getElementById('weightInput'),
  goalCalories: document.getElementById('goalCalories'),
  goalProtein: document.getElementById('goalProtein'),
  applyTargets: document.getElementById('applyTargets')
};

let targets = {
  calories: 2500,
  protein: 160,
  carbs: 255,
  fat: 80
};

function round(value) {
  return Math.round(value * 10) / 10;
}

function getEditableRows() {
  return Array.from(document.querySelectorAll('.food-row.editable'));
}

function calculateTotals() {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  getEditableRows().forEach(row => {
    const qty = Number(row.querySelector('input').value || 0);
    const factor = qty / 100;
    totals.calories += Number(row.dataset.cal) * factor;
    totals.protein += Number(row.dataset.protein) * factor;
    totals.carbs += Number(row.dataset.carbs) * factor;
    totals.fat += Number(row.dataset.fat) * factor;
  });

  totals.calories = round(totals.calories);
  totals.protein = round(totals.protein);
  totals.carbs = round(totals.carbs);
  totals.fat = round(totals.fat);
  return totals;
}

function buildFeedback(totals) {
  const notes = [];

  if (totals.calories > targets.calories + 120) {
    notes.push('Έχεις πολλές θερμίδες τώρα. Μείωσε λίγο ρύζι, ψωμί, μακαρόνι ή λάδι.');
  } else if (totals.calories < targets.calories - 220) {
    notes.push('Είσαι αρκετά χαμηλά σε θερμίδες. Αν πεινάει, ανέβασε λίγο πατάτα, ρύζι ή ψωμί τοστ.');
  } else {
    notes.push('Οι θερμίδες είναι κοντά στον στόχο. Αυτό είναι καλό σημείο για χάσιμο λίπους χωρίς υπερβολή.');
  }

  if (totals.protein < targets.protein - 15) {
    notes.push('Η πρωτεΐνη είναι χαμηλή. Βάλε λίγο παραπάνω κοτόπουλο, ασπράδι, cottage ή κιμά.');
  } else if (totals.protein >= targets.protein) {
    notes.push('Η πρωτεΐνη είναι δυνατή. Καλό για κορεσμό και για να κρατήσει μυϊκή μάζα.');
  }

  if (totals.carbs < 170) {
    notes.push('Οι υδατάνθρακες βγήκαν χαμηλά. Αν νιώθει flat ή πεινάει, ανέβασε πατάτες, ρύζι ή ψωμί τοστ.');
  } else if (totals.carbs > 310) {
    notes.push('Οι υδατάνθρακες είναι αρκετά ψηλά. Κόψε λίγο από ψωμί, ρύζι ή μακαρόνι.');
  }

  if (totals.fat < 45) {
    notes.push('Τα λιπαρά είναι λίγο χαμηλά. Βοηθάει λίγο αυγό, λίγο κατίκι ή λίγο ελαιόλαδο.');
  } else if (totals.fat > 95) {
    notes.push('Τα λιπαρά βγήκαν αρκετά ψηλά. Δες αν μπορεί να πέσει το λάδι ή τα πιο λιπαρά τυριά.');
  }

  return notes.join(' ');
}

function updateUI() {
  const totals = calculateTotals();
  refs.totalCalories.textContent = `${totals.calories} kcal`;
  refs.totalProtein.textContent = `${totals.protein} g`;
  refs.totalCarbs.textContent = `${totals.carbs} g`;
  refs.totalFat.textContent = `${totals.fat} g`;

  const calPct = Math.min(140, round((totals.calories / targets.calories) * 100));
  const proteinPct = Math.min(140, round((totals.protein / targets.protein) * 100));

  refs.calorieBar.style.width = `${Math.min(calPct, 100)}%`;
  refs.proteinBar.style.width = `${Math.min(proteinPct, 100)}%`;

  refs.calorieStatus.textContent = `${calPct}%`;
  refs.proteinStatus.textContent = `${proteinPct}%`;

  refs.feedbackBox.textContent = buildFeedback(totals);

  refs.calorieBar.style.filter = totals.calories > targets.calories + 120 ? 'hue-rotate(-40deg)' : 'none';
  refs.proteinBar.style.filter = totals.protein < targets.protein ? 'saturate(0.8)' : 'none';
}

function applyTargets() {
  const calories = Number(refs.calorieTargetInput.value || 2500);
  const weight = Number(refs.weightInput.value || 93);
  const multiplier = Number(refs.proteinMultiplier.value || 1.7);
  const protein = Math.round(weight * multiplier);

  targets.calories = calories;
  targets.protein = protein;
  refs.goalCalories.textContent = `${calories} kcal`;
  refs.goalProtein.textContent = `${protein} g`;
  updateUI();
}

function normalizeUnit(rawUnit) {
  const unit = rawUnit.toLowerCase();
  if (unit === 'ml') return 'ml';
  if (unit.startsWith('τεμ')) return 'τεμ';
  return 'g';
}

function parseQtyAndUnit(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|τεμάχια|τεμάχιο|τεμ\.?)/i);
  if (!match) return null;

  return {
    qty: Number(match[1].replace(',', '.')),
    unit: normalizeUnit(match[2])
  };
}

function closeAlternativeLists(exceptWrap = null) {
  document.querySelectorAll('.food-alt-wrap.open').forEach(wrap => {
    if (wrap === exceptWrap) return;
    const toggle = wrap.querySelector('.alt-toggle');
    const symbol = wrap.querySelector('.alt-symbol');
    wrap.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (symbol) symbol.textContent = '+';
  });
}

function applyAlternative(row, optionText) {
  const label = row.querySelector('.food-main label');
  if (label) {
    label.textContent = optionText;
  }

  const qtyInput = row.querySelector('.qty-box input');
  const unitEl = row.querySelector('.qty-box span');
  const parsedQty = parseQtyAndUnit(optionText);

  if (qtyInput && parsedQty) {
    qtyInput.value = parsedQty.qty;
    if (unitEl) unitEl.textContent = parsedQty.unit;
  }

  updateUI();
}

function setupAlternativeDropdowns() {
  const wraps = Array.from(document.querySelectorAll('.food-alt-wrap'));

  wraps.forEach((wrap, wrapIndex) => {
    const originalTitle = wrap.querySelector('.alt-title');
    const list = wrap.querySelector('.alt-list');

    if (!originalTitle || !list) return;

    const row = wrap.closest('.food-row');
    const rowId = `alt-row-${wrapIndex + 1}`;
    list.id = rowId;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'alt-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', rowId);
    toggle.innerHTML = '<span>Δείτε εναλλακτικές</span><span class="alt-symbol">+</span>';

    const head = document.createElement('div');
    head.className = 'alt-wrap-head';
    head.appendChild(toggle);
    originalTitle.replaceWith(head);

    const items = Array.from(list.querySelectorAll('span'));
    list.textContent = '';

    items.forEach(item => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'alt-option';
      option.textContent = item.textContent;
      option.addEventListener('click', () => {
        if (row) {
          applyAlternative(row, option.textContent);
        }
        closeAlternativeLists();
      });
      list.appendChild(option);
    });

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      if (isOpen) {
        closeAlternativeLists();
        return;
      }
      closeAlternativeLists(wrap);
      wrap.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      const symbol = toggle.querySelector('.alt-symbol');
      if (symbol) symbol.textContent = '−';
    });
  });

  document.addEventListener('click', () => {
    closeAlternativeLists();
  });
}

getEditableRows().forEach(row => {
  row.querySelector('input').addEventListener('input', updateUI);
});
refs.applyTargets.addEventListener('click', applyTargets);
setupAlternativeDropdowns();
updateUI();
