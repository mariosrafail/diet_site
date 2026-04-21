const refs = {
  totalCalories: document.getElementById('totalCalories'),
  totalProtein: document.getElementById('totalProtein'),
  totalCarbs: document.getElementById('totalCarbs'),
  totalFat: document.getElementById('totalFat'),
  calorieBar: document.getElementById('calorieBar'),
  proteinBar: document.getElementById('proteinBar'),
  fatBar: document.getElementById('fatBar'),
  carbsBar: document.getElementById('carbsBar'),
  calorieStatus: document.getElementById('calorieStatus'),
  proteinStatus: document.getElementById('proteinStatus'),
  fatStatus: document.getElementById('fatStatus'),
  carbsStatus: document.getElementById('carbsStatus'),
  feedbackBox: document.getElementById('feedbackBox'),
  calorieTargetInput: document.getElementById('calorieTargetInput'),
  proteinMultiplier: document.getElementById('proteinMultiplier'),
  weightInput: document.getElementById('weightInput'),
  goalCalories: document.getElementById('goalCalories'),
  goalProtein: document.getElementById('goalProtein'),
  applyTargets: document.getElementById('applyTargets')
};

const TARGETS_STORAGE_KEY = 'dietSiteTargetsV1';
const FOODS_API_ENDPOINT = '/api/foods';
const USER_SLUG = 'konstantinos';

let targets = { calories: 2500, protein: 160, carbs: 255, fat: 80 };
let foodDb = [];
let imageModal = null;
let customMealCounter = 0;
let altCounter = 0;

function round(value) {
  return Math.round(value * 10) / 10;
}

function normalizeUnit(rawUnit) {
  const unit = String(rawUnit || 'g').toLowerCase();
  if (unit === 'ml') return 'ml';
  if (unit.startsWith('τεμ')) return 'τεμ';
  return 'g';
}

function toFoodKey(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeFoodEntry(entry) {
  return {
    id: entry.id,
    name: String(entry.name || '').trim(),
    unit: normalizeUnit(entry.unit),
    cal: Number(entry.cal || 0),
    protein: Number(entry.protein || 0),
    carbs: Number(entry.carbs || 0),
    fat: Number(entry.fat || 0),
    image_path: String(entry.image_path || 'assets/food_images/placeholder.svg').replace(/\\/g, '/')
  };
}

function getEditableRows() {
  return Array.from(document.querySelectorAll('.food-row.editable'));
}

function getAllFoodRows() {
  return Array.from(document.querySelectorAll('.food-row'));
}

function getRowFactor(row, qty) {
  const unit = normalizeUnit(row.querySelector('.qty-box span')?.textContent || 'g');
  return unit === 'τεμ' ? qty : qty / 100;
}

function getPieceGramsForFoodName(name) {
  const key = toFoodKey(name);
  if (key.includes(toFoodKey('Ψωμί τοστ'))) return 27;
  if (key.includes('αυγ') || key.includes('marata')) return 55;
  return null;
}

function calculateTotals() {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  getEditableRows().forEach(row => {
    const qty = Number(row.querySelector('.qty-box input')?.value || 0);
    const factor = getRowFactor(row, qty);
    totals.calories += Number(row.dataset.cal || 0) * factor;
    totals.protein += Number(row.dataset.protein || 0) * factor;
    totals.carbs += Number(row.dataset.carbs || 0) * factor;
    totals.fat += Number(row.dataset.fat || 0) * factor;
  });

  totals.calories = round(totals.calories);
  totals.protein = round(totals.protein);
  totals.carbs = round(totals.carbs);
  totals.fat = round(totals.fat);
  return totals;
}

function calculateMacroShares(totals) {
  if (!totals.calories) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: round(((totals.protein * 4) / totals.calories) * 100),
    carbs: round(((totals.carbs * 4) / totals.calories) * 100),
    fat: round(((totals.fat * 9) / totals.calories) * 100)
  };
}

function updateMealCalories() {
  document.querySelectorAll('.meal-card:not(.sweet-card)').forEach(card => {
    const kcal = round(Array.from(card.querySelectorAll('.food-row.editable')).reduce((sum, row) => {
      const qty = Number(row.querySelector('.qty-box input')?.value || 0);
      return sum + (Number(row.dataset.cal || 0) * getRowFactor(row, qty));
    }, 0));

    const badge = card.querySelector('.meal-kcal');
    if (badge) badge.textContent = `~${kcal} kcal`;
  });
}

function buildFeedback(totals) {
  const notes = [];
  if (totals.calories > targets.calories + 120) notes.push('Έχεις πολλές θερμίδες τώρα.');
  else if (totals.calories < targets.calories - 220) notes.push('Είσαι χαμηλά σε θερμίδες.');
  else notes.push('Οι θερμίδες είναι κοντά στον στόχο.');

  if (totals.protein < targets.protein - 15) notes.push('Η πρωτεΐνη είναι χαμηλή.');
  if (totals.protein >= targets.protein) notes.push('Η πρωτεΐνη είναι σε καλό επίπεδο.');
  return notes.join(' ');
}

function classifyPrepType(labelText) {
  const text = (labelText || '').toLowerCase();
  if (text.includes('ρυζ') || text.includes('basmati') || text.includes('μπασματ')) return 'rice';
  if (text.includes('μακαρ') || text.includes('σπαγγ') || text.includes('makaron')) return 'pasta';
  return null;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(round(value));
}

function ensurePrepNote(row) {
  const foodMain = row?.querySelector('.food-main');
  if (!foodMain) return null;
  let note = foodMain.querySelector('.prep-note');
  if (!note) {
    note = document.createElement('small');
    note.className = 'prep-note';
    foodMain.appendChild(note);
  }
  return note;
}

function updatePrepNoteForRow(row) {
  const labelText = row?.querySelector('.food-main label')?.textContent || '';
  const prepType = classifyPrepType(labelText);
  const existing = row?.querySelector('.prep-note');
  if (!prepType) {
    if (existing) existing.remove();
    return;
  }

  const qty = Number(row.querySelector('.qty-box input')?.value || 0);
  const note = ensurePrepNote(row);
  if (!note) return;

  if (prepType === 'rice') note.textContent = `${formatNumber(qty)} g ωμό ≈ ${formatNumber(qty * 2.5)}-${formatNumber(qty * 3)} g βρασμένο · quick: x3`;
  else note.textContent = `${formatNumber(qty)} g ωμό ≈ ${formatNumber(qty * 2)}-${formatNumber(qty * 2.5)} g βρασμένο · quick: x2.2`;
}

function updatePrepNotes() {
  getEditableRows().forEach(updatePrepNoteForRow);
}

function updateUI() {
  const totals = calculateTotals();
  const shares = calculateMacroShares(totals);

  refs.totalCalories.textContent = `${totals.calories} kcal`;
  refs.totalProtein.textContent = `${totals.protein} g (${shares.protein}%)`;
  refs.totalCarbs.textContent = `${totals.carbs} g (${shares.carbs}%)`;
  refs.totalFat.textContent = `${totals.fat} g (${shares.fat}%)`;

  const calPct = Math.min(140, round((totals.calories / targets.calories) * 100));
  const proteinPct = Math.min(140, round((totals.protein / targets.protein) * 100));

  refs.calorieBar.style.width = `${Math.min(calPct, 100)}%`;
  refs.proteinBar.style.width = `${Math.min(proteinPct, 100)}%`;
  refs.fatBar.style.width = `${Math.min(100, shares.fat)}%`;
  refs.carbsBar.style.width = `${Math.min(100, shares.carbs)}%`;

  refs.calorieStatus.textContent = `${calPct}%`;
  refs.proteinStatus.textContent = `${proteinPct}%`;
  refs.fatStatus.textContent = `${shares.fat}%`;
  refs.carbsStatus.textContent = `${shares.carbs}%`;

  refs.feedbackBox.textContent = buildFeedback(totals);

  updatePrepNotes();
  updateMealCalories();
}

function saveTargetsLocal() {
  const payload = {
    calorieTarget: Number(refs.calorieTargetInput?.value || targets.calories),
    weight: Number(refs.weightInput?.value || 93),
    proteinMultiplier: Number(refs.proteinMultiplier?.value || 1.7)
  };
  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(payload));
}

function loadTargetsLocal() {
  const raw = localStorage.getItem(TARGETS_STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (Number.isFinite(saved.calorieTarget)) refs.calorieTargetInput.value = String(saved.calorieTarget);
    if (Number.isFinite(saved.weight)) refs.weightInput.value = String(saved.weight);
    if (Number.isFinite(saved.proteinMultiplier)) refs.proteinMultiplier.value = String(saved.proteinMultiplier);
  } catch {
    localStorage.removeItem(TARGETS_STORAGE_KEY);
  }
}

async function saveTargetsRemote() {
  await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/targets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calorieTarget: Number(refs.calorieTargetInput.value || 2500),
      proteinMultiplier: Number(refs.proteinMultiplier.value || 1.7),
      weight: Number(refs.weightInput.value || 93)
    })
  });
}

function applyTargets() {
  const calories = Number(refs.calorieTargetInput.value || 2500);
  const weight = Number(refs.weightInput.value || 93);
  const multiplier = Number(refs.proteinMultiplier.value || 1.7);

  targets.calories = calories;
  targets.protein = Math.round(weight * multiplier);

  refs.goalCalories.textContent = `${targets.calories} kcal`;
  refs.goalProtein.textContent = `${targets.protein} g`;

  saveTargetsLocal();
  saveTargetsRemote().catch(error => console.error('Failed to save targets:', error));
  updateUI();
}

async function fetchFoodsFromApi() {
  const response = await fetch(FOODS_API_ENDPOINT);
  if (!response.ok) throw new Error('foods_fetch_failed');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('foods_invalid_payload');
  return data.map(normalizeFoodEntry).filter(item => item.name);
}

function getFoodById(foodId) {
  return foodDb.find(item => item.id === foodId);
}

function getImagePathForRow(row) {
  if (row?.dataset.imagePath) return row.dataset.imagePath;
  const labelText = row?.querySelector('.food-main label')?.textContent || '';
  const food = foodDb.find(item => toFoodKey(item.name) === toFoodKey(labelText));
  return food?.image_path || 'assets/food_images/placeholder.svg';
}

function ensureRowImage(row) {
  const foodMain = row?.querySelector('.food-main');
  const label = foodMain?.querySelector('label');
  if (!foodMain || !label) return;

  let wrap = foodMain.querySelector('.food-label-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'food-label-wrap';

    const img = document.createElement('img');
    img.className = 'food-thumb';
    img.alt = 'Εικόνα τροφίμου';

    label.before(wrap);
    wrap.appendChild(img);
    wrap.appendChild(label);
  }

  const img = wrap.querySelector('.food-thumb');
  if (img) img.src = getImagePathForRow(row);
}

function updateFoodImages() {
  getAllFoodRows().forEach(ensureRowImage);
}

function refreshDbSelectOptions() {
  document.querySelectorAll('.db-select').forEach(select => {
    const selected = select.value;
    select.innerHTML = '<option value="">Επιλογή από βάση</option>';
    foodDb
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'el'))
      .forEach(food => {
        const option = document.createElement('option');
        option.value = food.id;
        option.textContent = `${food.name} (${round(food.protein)}P/${round(food.carbs)}C/${round(food.fat)}F)`;
        select.appendChild(option);
      });

    if (selected && foodDb.some(item => item.id === selected)) select.value = selected;
  });
}

function ensureDbPickerForRow(row) {
  if (!row || !row.classList.contains('editable') || row.querySelector('.db-picker')) return;

  const picker = document.createElement('div');
  picker.className = 'db-picker';
  picker.innerHTML = `
    <select class="db-select"><option value="">Επιλογή από βάση</option></select>
    <button type="button" class="mini-btn db-save-btn">Save</button>
  `;

  const altWrap = row.querySelector('.food-alt-wrap');
  if (altWrap) altWrap.before(picker);
  else row.appendChild(picker);
}

function applyFoodEntryToRow(row, food) {
  if (!row || !food) return;

  row.dataset.cal = String(food.cal);
  row.dataset.protein = String(food.protein);
  row.dataset.carbs = String(food.carbs);
  row.dataset.fat = String(food.fat);
  row.dataset.imagePath = food.image_path;

  const label = row.querySelector('.food-main label');
  const small = row.querySelector('.food-main small');
  const unitEl = row.querySelector('.qty-box span');

  if (label) label.textContent = food.name;
  if (small) {
    if (food.unit === 'τεμ') {
      const grams = getPieceGramsForFoodName(food.name);
      if (toFoodKey(food.name).includes(toFoodKey('Ψωμί τοστ'))) small.textContent = `ανά 1 φέτα (${grams || 27} g)`;
      else if (grams) small.textContent = `ανά 1 τεμ (${grams} g)`;
      else small.textContent = 'ανά 1 τεμ';
    } else {
      small.textContent = `ανά 100 ${food.unit}`;
    }
  }
  if (unitEl) unitEl.textContent = food.unit;

  ensureRowImage(row);
  updatePrepNoteForRow(row);
}

async function saveRowForUser(row, foodId) {
  const mealCard = row.closest('.meal-card');
  const mealKey = mealCard?.dataset.meal;
  if (!mealKey || mealCard?.classList.contains('sweet-card')) return;

  if (!row.dataset.rowKey) row.dataset.rowKey = `row-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const mealTitle = mealCard.querySelector('.meal-top h3')?.textContent?.trim() || mealKey;
  const qty = Number(row.querySelector('.qty-box input')?.value || 0);

  await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/meal-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mealKey, rowKey: row.dataset.rowKey, foodId, qty, mealTitle })
  });
}

function parseQtyAndUnit(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|τεμάχια|τεμάχιο|τεμ\.?)/i);
  if (!match) return null;
  return { qty: Number(match[1].replace(',', '.')), unit: normalizeUnit(match[2]) };
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
  if (label) label.textContent = optionText;

  const qtyInput = row.querySelector('.qty-box input');
  const unitEl = row.querySelector('.qty-box span');
  const parsed = parseQtyAndUnit(optionText);
  if (qtyInput && parsed) {
    qtyInput.value = parsed.qty;
    if (unitEl) unitEl.textContent = parsed.unit;
  }

  row.dataset.imagePath = '';
  ensureRowImage(row);
  updatePrepNoteForRow(row);
  updateUI();
}

function toAltOption(text) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'alt-option';
  option.textContent = text;
  return option;
}

function initAlternativeWrap(wrap) {
  if (!wrap || wrap.dataset.enhanced === '1') return;
  const originalTitle = wrap.querySelector('.alt-title');
  const list = wrap.querySelector('.alt-list');
  if (!list) return;

  altCounter += 1;
  if (!list.id) list.id = `alt-row-${altCounter}`;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'alt-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', list.id);
  toggle.innerHTML = '<span>Δείτε εναλλακτικές</span><span class="alt-symbol">+</span>';

  const head = document.createElement('div');
  head.className = 'alt-wrap-head';
  head.appendChild(toggle);
  if (originalTitle) originalTitle.replaceWith(head);
  else wrap.prepend(head);

  const spans = Array.from(list.querySelectorAll('span'));
  if (spans.length) {
    const texts = spans.map(s => s.textContent?.trim()).filter(Boolean);
    list.textContent = '';
    texts.forEach(text => list.appendChild(toAltOption(text)));
  }

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

  list.addEventListener('click', e => {
    const option = e.target.closest('.alt-option');
    if (!option) return;
    const row = wrap.closest('.food-row');
    if (row) applyAlternative(row, option.textContent);
    closeAlternativeLists();
  });

  wrap.dataset.enhanced = '1';
}

function setupAlternativeDropdowns() {
  document.querySelectorAll('.food-alt-wrap').forEach(initAlternativeWrap);
}

function createNewFoodRow() {
  const row = document.createElement('div');
  row.className = 'food-row editable custom-food';
  row.dataset.cal = '0';
  row.dataset.protein = '0';
  row.dataset.carbs = '0';
  row.dataset.fat = '0';

  row.innerHTML = `
    <div class="food-main">
      <label>Επίλεξε τρόφιμο από βάση</label>
      <small>ανά 100 g</small>
    </div>
    <div class="qty-box"><input type="number" value="100" min="0" step="10"><span>g</span></div>
    <div class="food-tools">
      <button type="button" class="remove-row-btn">Αφαίρεση τροφίμου</button>
    </div>
  `;

  ensureDbPickerForRow(row);
  ensureRowImage(row);
  return row;
}

function addFoodToMeal(mealCard) {
  if (!mealCard) return;
  mealCard.appendChild(createNewFoodRow());
  refreshDbSelectOptions();
  updateUI();
}

function ensureMealControlButtons(mealCard) {
  if (!mealCard || mealCard.classList.contains('sweet-card')) return;
  const mealTop = mealCard.querySelector('.meal-top');
  if (!mealTop) return;

  let actions = mealTop.querySelector('.meal-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'meal-actions';
    mealTop.appendChild(actions);
  }

  if (!actions.querySelector('.add-food-btn')) {
    const addFoodBtn = document.createElement('button');
    addFoodBtn.type = 'button';
    addFoodBtn.className = 'mini-btn add-food-btn';
    addFoodBtn.textContent = '+ Νέο τρόφιμο';
    actions.appendChild(addFoodBtn);
  }
}

function createMealCard(mealKey = null, title = null, description = null) {
  customMealCounter += 1;
  const key = mealKey || `custom-${customMealCounter}`;

  const card = document.createElement('div');
  card.className = 'meal-card custom-meal';
  card.dataset.meal = key;

  card.innerHTML = `
    <div class="meal-top">
      <div>
        <h3 class="editable-text" contenteditable="true">${title || `Νέο γεύμα ${customMealCounter}`}</h3>
        <p class="editable-text" contenteditable="true">${description || 'Γράψε περιγραφή γεύματος'}</p>
      </div>
      <span class="meal-kcal">~0 kcal</span>
      <div class="meal-actions">
        <button type="button" class="mini-btn add-food-btn">+ Νέο τρόφιμο</button>
        <button type="button" class="mini-btn danger remove-meal-btn">Αφαίρεση γεύματος</button>
      </div>
    </div>
  `;

  card.appendChild(createNewFoodRow());
  return card;
}

function ensureAddMealButton() {
  const mealsPanel = document.querySelector('.panel.glass.meals');
  const head = mealsPanel?.querySelector('.section-head');
  if (!head || head.querySelector('.add-meal-btn')) return;

  const actions = document.createElement('div');
  actions.className = 'section-actions';

  const addMealBtn = document.createElement('button');
  addMealBtn.type = 'button';
  addMealBtn.className = 'btn btn-secondary add-meal-btn';
  addMealBtn.textContent = '+ Νέο γεύμα';

  actions.appendChild(addMealBtn);
  head.appendChild(actions);
}

function setupMealButtons() {
  document.querySelectorAll('.meal-card').forEach(ensureMealControlButtons);
  ensureAddMealButton();
}

function openImageModal(src, alt = 'Εικόνα τροφίμου') {
  if (!imageModal) return;
  const img = imageModal.querySelector('.image-modal-img');
  if (!img) return;
  img.src = src;
  img.alt = alt;
  imageModal.classList.add('open');
  imageModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeImageModal() {
  if (!imageModal) return;
  imageModal.classList.remove('open');
  imageModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function setupImageModal() {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="image-modal-content" role="dialog" aria-modal="true" aria-label="Προβολή εικόνας">
      <button type="button" class="image-modal-close" aria-label="Κλείσιμο">×</button>
      <img class="image-modal-img" alt="Εικόνα τροφίμου" />
    </div>
  `;

  document.body.appendChild(modal);
  imageModal = modal;

  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('.image-modal-close')) closeImageModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeImageModal();
  });
}

function applyDashboardTargets(targetsData) {
  if (!targetsData) return;
  refs.calorieTargetInput.value = String(targetsData.calorieTarget || refs.calorieTargetInput.value);
  refs.proteinMultiplier.value = String(targetsData.proteinMultiplier || refs.proteinMultiplier.value);
  refs.weightInput.value = String(targetsData.weight || refs.weightInput.value);
}

function findOrCreateMealCard(meal) {
  let card = document.querySelector(`.meal-card[data-meal="${meal.mealKey}"]`);
  if (card) return card;

  const newCard = createMealCard(meal.mealKey, meal.title, meal.description);
  const sweetCard = document.querySelector('.meal-card.sweet-card');
  if (sweetCard?.parentElement) sweetCard.parentElement.insertBefore(newCard, sweetCard);
  else document.querySelector('.panel.glass.meals')?.appendChild(newCard);

  return newCard;
}

function ensureRowWithKey(mealCard, rowKey) {
  let row = mealCard.querySelector(`.food-row.editable[data-row-key="${rowKey}"]`);
  if (row) return row;

  row = createNewFoodRow();
  row.dataset.rowKey = rowKey;
  mealCard.appendChild(row);
  return row;
}

async function loadDashboard() {
  const response = await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/dashboard`);
  if (!response.ok) throw new Error('dashboard_fetch_failed');
  const data = await response.json();

  applyDashboardTargets(data.targets);

  (data.meals || []).forEach(meal => {
    const card = findOrCreateMealCard(meal);

    (meal.items || []).forEach(item => {
      const row = ensureRowWithKey(card, item.rowKey);
      applyFoodEntryToRow(row, normalizeFoodEntry(item.food));
      const qtyInput = row.querySelector('.qty-box input');
      if (qtyInput) qtyInput.value = String(item.qty);

      const select = row.querySelector('.db-select');
      if (select) select.value = item.food.id;
    });
  });
}

refs.applyTargets?.addEventListener('click', applyTargets);

document.addEventListener('input', e => {
  const qtyInput = e.target.closest('.food-row.editable .qty-box input');
  if (qtyInput) {
    updateUI();
    return;
  }

  const editableLabel = e.target.closest('.food-main label.editable-text');
  if (editableLabel) {
    updatePrepNoteForRow(editableLabel.closest('.food-row'));
  }
});

document.addEventListener('click', e => {
  const thumb = e.target.closest('.food-thumb');
  if (thumb) {
    openImageModal(thumb.src, thumb.alt || 'Εικόνα τροφίμου');
    return;
  }

  const dbSaveBtn = e.target.closest('.db-save-btn');
  if (dbSaveBtn) {
    const row = dbSaveBtn.closest('.food-row');
    const select = row?.querySelector('.db-select');
    const food = getFoodById(select?.value);
    if (row && food) {
      applyFoodEntryToRow(row, food);
      saveRowForUser(row, food.id)
        .then(() => {
          dbSaveBtn.textContent = 'Saved';
          setTimeout(() => {
            dbSaveBtn.textContent = 'Save';
          }, 1000);
        })
        .catch(error => {
          console.error('Failed to save row:', error);
        });
      updateUI();
    }
    return;
  }

  const addFoodBtn = e.target.closest('.add-food-btn');
  if (addFoodBtn) {
    addFoodToMeal(addFoodBtn.closest('.meal-card'));
    return;
  }

  const addMealBtn = e.target.closest('.add-meal-btn');
  if (addMealBtn) {
    const newMeal = createMealCard();
    const sweetCard = document.querySelector('.meal-card.sweet-card');
    if (sweetCard?.parentElement) sweetCard.parentElement.insertBefore(newMeal, sweetCard);
    else document.querySelector('.panel.glass.meals')?.appendChild(newMeal);
    refreshDbSelectOptions();
    updateUI();
    return;
  }

  const removeRowBtn = e.target.closest('.remove-row-btn');
  if (removeRowBtn) {
    removeRowBtn.closest('.food-row')?.remove();
    updateUI();
    return;
  }

  const removeMealBtn = e.target.closest('.remove-meal-btn');
  if (removeMealBtn) {
    removeMealBtn.closest('.meal-card')?.remove();
    updateUI();
    return;
  }

  closeAlternativeLists();
});

async function initApp() {
  setupImageModal();
  loadTargetsLocal();
  setupAlternativeDropdowns();

  foodDb = await fetchFoodsFromApi();
  getEditableRows().forEach(ensureDbPickerForRow);
  refreshDbSelectOptions();
  setupMealButtons();

  await loadDashboard();

  updateFoodImages();
  applyTargets();
}

initApp().catch(error => {
  console.error('Init failed:', error);
  applyTargets();
});
