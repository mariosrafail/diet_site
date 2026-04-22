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
  proteinGoalLabel: document.getElementById('proteinGoalLabel'),
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

const dockRefs = {
  totalCalories: document.getElementById('totalCaloriesDock'),
  totalProtein: document.getElementById('totalProteinDock'),
  totalCarbs: document.getElementById('totalCarbsDock'),
  totalFat: document.getElementById('totalFatDock')
};

const FOODS_API_ENDPOINT = '/api/foods';
const USER_SLUG = 'konstantinos';
const FOOD_CATEGORIES = ['vegetables', 'fruit', 'protein', 'carb', 'fat', 'water'];
const FOOD_CATEGORY_LABELS = {
  vegetables: 'Λαχανικά',
  fruit: 'Φρούτα (υδατάνθρακας)',
  protein: 'Πηγή πρωτεΐνης',
  carb: 'Πηγή υδατάνθρακα',
  fat: 'Πηγή λιπαρών',
  water: 'Νερό'
};

let targets = { calories: 2500, protein: 160, carbs: 255, fat: 80 };
let foodDb = [];
let imageModal = null;
let customMealCounter = 0;
let hasUnsavedChanges = false;
let saveOverlay = null;
let saveOverlayLabel = null;
let pendingSaveCount = 0;
const mealGroupSelection = new Map();

function setHasUnsavedChanges(value) {
  hasUnsavedChanges = Boolean(value);
  const saveBtn = document.querySelector('.save-changes-btn');
  if (saveBtn) saveBtn.hidden = !hasUnsavedChanges;
}

function markUnsavedChanges() {
  setHasUnsavedChanges(true);
}

function beginSaving(label = 'Φόρτωση...') {
  pendingSaveCount += 1;
  if (!saveOverlay) return;
  if (saveOverlayLabel) saveOverlayLabel.textContent = label;
  saveOverlay.classList.add('open');
  saveOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('saving');
}

function endSaving() {
  pendingSaveCount = Math.max(0, pendingSaveCount - 1);
  if (pendingSaveCount > 0 || !saveOverlay) return;
  saveOverlay.classList.remove('open');
  saveOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('saving');
}

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
  const rawCategory = String(entry.category || '').trim().toLowerCase();
  const category = FOOD_CATEGORIES.includes(rawCategory) ? rawCategory : 'protein';

  return {
    id: entry.id,
    name: String(entry.name || '').trim(),
    category,
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

function getMealGroupKey(mealKey) {
  const key = String(mealKey || '').trim();
  const altIdx = key.indexOf('-alt-');
  return altIdx >= 0 ? key.slice(0, altIdx) : key;
}

function getAllTrackableMealCards() {
  return Array.from(document.querySelectorAll('.meal-card:not(.sweet-card)'));
}

function getMealCardsGroupedByKey() {
  const groups = new Map();
  getAllTrackableMealCards().forEach(card => {
    const groupKey = card.dataset.mealGroup || getMealGroupKey(card.dataset.meal || '');
    if (!groupKey) return;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(card);
  });
  return groups;
}

function normalizeMealGroupTitle(rawTitle) {
  return String(rawTitle || '')
    .replace(/\s*\(Εναλλακτική\)\s*$/i, '')
    .trim();
}

function resolveMealGroupTitle(cards, fallbackKey) {
  const preferred = cards.find(card => {
    const title = card.querySelector('.meal-top h3')?.textContent || '';
    return !String(title).includes('Εναλλακτική');
  }) || cards[0];
  const title = normalizeMealGroupTitle(preferred?.querySelector('.meal-top h3')?.textContent || '');
  return title || fallbackKey || 'Γεύμα';
}

function organizeMealGroupsInDom() {
  const mealsPanel = document.querySelector('.panel.glass.meals');
  if (!mealsPanel) return;

  const sweetCard = mealsPanel.querySelector('.meal-card.sweet-card');
  const cardsInOrder = Array.from(mealsPanel.querySelectorAll('.meal-card:not(.sweet-card)'));
  if (!cardsInOrder.length) {
    mealsPanel.querySelectorAll('.meal-group-box').forEach(box => box.remove());
    return;
  }

  const groups = new Map();
  cardsInOrder.forEach(card => {
    const groupKey = card.dataset.mealGroup || getMealGroupKey(card.dataset.meal || '');
    if (!groupKey) return;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(card);
  });

  const fragment = document.createDocumentFragment();
  groups.forEach((cards, groupKey) => {
    const box = document.createElement('div');
    box.className = 'meal-group-box';
    box.dataset.mealGroup = groupKey;

    const head = document.createElement('div');
    head.className = 'meal-group-head';
    const titleEl = document.createElement('h4');
    titleEl.textContent = resolveMealGroupTitle(cards, groupKey);
    const countEl = document.createElement('small');
    countEl.textContent = cards.length > 1 ? `${cards.length} επιλογές` : '1 επιλογή';
    head.appendChild(titleEl);
    head.appendChild(countEl);
    box.appendChild(head);

    cards.forEach(card => box.appendChild(card));
    fragment.appendChild(box);
  });

  mealsPanel.querySelectorAll('.meal-group-box').forEach(box => box.remove());
  if (sweetCard) mealsPanel.insertBefore(fragment, sweetCard);
  else mealsPanel.appendChild(fragment);
}

function syncMealSelectionControls() {
  const groups = getMealCardsGroupedByKey();

  const validGroupKeys = new Set(groups.keys());
  Array.from(mealGroupSelection.keys()).forEach(groupKey => {
    if (!validGroupKeys.has(groupKey)) mealGroupSelection.delete(groupKey);
  });

  groups.forEach((cards, groupKey) => {
    const hasMultiple = cards.length > 1;
    let selectedMealKey = mealGroupSelection.get(groupKey);
    if (!selectedMealKey || !cards.some(card => card.dataset.meal === selectedMealKey)) {
      selectedMealKey = cards[0]?.dataset.meal || '';
      if (selectedMealKey) mealGroupSelection.set(groupKey, selectedMealKey);
    }

    cards.forEach(card => {
      const isSelected = !hasMultiple || card.dataset.meal === selectedMealKey;
      card.classList.toggle('totals-active', isSelected);
      card.classList.toggle('totals-inactive', !isSelected);
      card.classList.toggle('minimized', hasMultiple && !isSelected);

      const chooseBtn = card.querySelector('.calculate-with-this-btn');
      if (!chooseBtn) return;
      chooseBtn.hidden = !hasMultiple;
      chooseBtn.classList.toggle('active', isSelected);
      chooseBtn.textContent = isSelected ? 'Υπολογίζεται αυτό' : 'Υπολόγισε σύμφωνα με αυτό';
    });
  });
}

function getActiveMealCardsForTotals() {
  const groups = getMealCardsGroupedByKey();
  const activeCards = [];

  groups.forEach((cards, groupKey) => {
    if (cards.length === 1) {
      activeCards.push(cards[0]);
      return;
    }

    let selectedMealKey = mealGroupSelection.get(groupKey);
    let selectedCard = cards.find(card => card.dataset.meal === selectedMealKey);
    if (!selectedCard) {
      selectedCard = cards[0];
      if (selectedCard?.dataset.meal) mealGroupSelection.set(groupKey, selectedCard.dataset.meal);
    }
    if (selectedCard) activeCards.push(selectedCard);
  });

  return activeCards;
}

function getRowFactor(row, qty) {
  const unit = normalizeUnit(row.querySelector('.qty-box span')?.textContent || 'g');
  return unit === 'τεμ' ? qty : qty / 100;
}

function getPieceGramsForFoodName(name) {
  const key = toFoodKey(name);
  if (key.includes(toFoodKey('Ψωμί τοστ'))) return 27;
  if (key.includes(toFoodKey('ρυζογκοφρέτ')) || key.includes(toFoodKey('rice cake'))) return 7.5;
  if (key.includes('αυγ') || key.includes('marata')) return 55;
  return null;
}

function calculateTotals() {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  syncMealSelectionControls();
  getActiveMealCardsForTotals().forEach(card => {
    Array.from(card.querySelectorAll('.food-row.editable')).forEach(row => {
      const qty = Number(row.querySelector('.qty-box input')?.value || 0);
      const factor = getRowFactor(row, qty);
      totals.calories += Number(row.dataset.cal || 0) * factor;
      totals.protein += Number(row.dataset.protein || 0) * factor;
      totals.carbs += Number(row.dataset.carbs || 0) * factor;
      totals.fat += Number(row.dataset.fat || 0) * factor;
    });
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
    const mealTotals = Array.from(card.querySelectorAll('.food-row.editable')).reduce((acc, row) => {
      const qty = Number(row.querySelector('.qty-box input')?.value || 0);
      const factor = getRowFactor(row, qty);
      acc.kcal += Number(row.dataset.cal || 0) * factor;
      acc.protein += Number(row.dataset.protein || 0) * factor;
      acc.fat += Number(row.dataset.fat || 0) * factor;
      acc.carbs += Number(row.dataset.carbs || 0) * factor;
      return acc;
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });

    const kcal = round(mealTotals.kcal);
    const protein = round(mealTotals.protein);
    const fat = round(mealTotals.fat);
    const carbs = round(mealTotals.carbs);

    const badge = card.querySelector('.meal-kcal');
    if (badge) badge.textContent = `~${kcal} kcal · ${protein}P, ${fat}F, ${carbs}C`;
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

function getCookedWeightProfile(labelText) {
  const key = toFoodKey(labelText || '');
  const hasCookedWord = key.includes(toFoodKey('ψητ')) || key.includes(toFoodKey('βρασ'));
  if (!hasCookedWord) return null;

  if (key.includes(toFoodKey('ρυζ')) || key.includes('basmati') || key.includes(toFoodKey('μπασματ'))) {
    return { rawPerCooked: 0.37, cookedLabel: 'βρασμένο', rawLabel: 'ωμό' };
  }
  if (key.includes(toFoodKey('μακαρ')) || key.includes(toFoodKey('σπαγγ')) || key.includes('pasta')) {
    return { rawPerCooked: 0.5, cookedLabel: 'βρασμένο', rawLabel: 'ωμό' };
  }
  if (key.includes(toFoodKey('κοτοπουλ'))) {
    return { rawPerCooked: 1.33, cookedLabel: 'ψημένο', rawLabel: 'ωμό' };
  }
  if (key.includes(toFoodKey('κιμα'))) {
    if (key.includes(toFoodKey('βρασ'))) {
      // For boiled mince we assume the cooked weight can be slightly higher
      // due to water retention.
      return { rawPerCooked: 0.9, cookedLabel: 'βρασμένο', rawLabel: 'ωμό' };
    }
    return { rawPerCooked: 1.25, cookedLabel: 'μαγειρεμένο', rawLabel: 'ωμό' };
  }
  if (key.includes(toFoodKey('πατατ'))) {
    return { rawPerCooked: 1.2, cookedLabel: 'μαγειρεμένη', rawLabel: 'ωμή' };
  }
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

function ensureRawHint(row) {
  const qtyBox = row?.querySelector('.qty-box');
  if (!qtyBox) return null;
  let hint = qtyBox.querySelector('.raw-hint');
  if (!hint) {
    hint = document.createElement('small');
    hint.className = 'raw-hint';
    qtyBox.appendChild(hint);
  }
  return hint;
}

function updatePrepNoteForRow(row) {
  const labelText = row?.querySelector('.food-main label')?.textContent || '';
  const prepType = classifyPrepType(labelText);
  const cookedProfile = getCookedWeightProfile(labelText);
  const existing = row?.querySelector('.prep-note');
  const rawHint = ensureRawHint(row);
  if (rawHint) rawHint.textContent = '';

  if (cookedProfile) {
    const qty = Number(row.querySelector('.qty-box input')?.value || 0);
    const rawQty = round(qty * cookedProfile.rawPerCooked);
    if (rawHint) rawHint.textContent = `(≈ ${formatNumber(rawQty)} g ${cookedProfile.rawLabel})`;

    const note = ensurePrepNote(row);
    if (!note) return;
    note.textContent = `Υπολογισμός σε μαγειρεμένο βάρος (${cookedProfile.cookedLabel}).`;
    return;
  }

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
  const fatMin = 25;
  const fatMax = 30;
  const carbsMin = 35;
  const carbsMax = 45;
  const inRangeFill = (value, min, max) => {
    if (value >= min && value <= max) return 100;
    if (value < min) return Math.max(0, Math.min(100, round((value / min) * 100)));
    return Math.max(0, Math.min(100, round((max / value) * 100)));
  };

  refs.calorieBar.style.width = `${Math.min(calPct, 100)}%`;
  refs.proteinBar.style.width = `${Math.min(proteinPct, 100)}%`;
  refs.fatBar.style.width = `${inRangeFill(shares.fat, fatMin, fatMax)}%`;
  refs.carbsBar.style.width = `${inRangeFill(shares.carbs, carbsMin, carbsMax)}%`;

  const proteinRemaining = round(targets.protein - totals.protein);

  if (refs.proteinGoalLabel) refs.proteinGoalLabel.textContent = `Πρωτεΐνη (στόχος ${targets.protein} g)`;
  refs.calorieStatus.textContent = `${calPct}%`;
  if (proteinRemaining > 0) refs.proteinStatus.textContent = `${proteinPct}% · μένουν ${proteinRemaining} g`;
  else if (proteinRemaining < 0) refs.proteinStatus.textContent = `${proteinPct}% · +${Math.abs(proteinRemaining)} g`;
  else refs.proteinStatus.textContent = `${proteinPct}% · στόχος`;
  refs.fatStatus.textContent = `${shares.fat}%`;
  refs.carbsStatus.textContent = `${shares.carbs}%`;

  refs.feedbackBox.textContent = buildFeedback(totals);

  if (dockRefs.totalCalories) {
    dockRefs.totalCalories.textContent = `${totals.calories} kcal`;
    dockRefs.totalProtein.textContent = `${totals.protein} g (${shares.protein}%)`;
    dockRefs.totalCarbs.textContent = `${totals.carbs} g (${shares.carbs}%)`;
    dockRefs.totalFat.textContent = `${totals.fat} g (${shares.fat}%)`;
  }

  updatePrepNotes();
  updateMealCalories();
}

async function saveTargetsRemote() {
  const response = await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/targets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calorieTarget: Number(refs.calorieTargetInput.value || targets.calories),
      proteinMultiplier: Number(refs.proteinMultiplier.value || 1.7),
      weight: Number(refs.weightInput.value || 93)
    })
  });
  if (!response.ok) throw new Error('targets_write_failed');
}

async function applyTargets(options = {}) {
  const { persistRemote = true } = options;
  const calories = Number(refs.calorieTargetInput.value || targets.calories);
  const weight = Number(refs.weightInput.value || 93);
  const multiplier = Number(refs.proteinMultiplier.value || 1.7);

  targets.calories = calories;
  targets.protein = Math.round(weight * multiplier);

  refs.goalCalories.textContent = `${targets.calories} kcal`;
  refs.goalProtein.textContent = `${targets.protein} g`;

  if (persistRemote) {
    beginSaving('Αποθήκευση στόχων...');
    try {
      await saveTargetsRemote();
    } catch (error) {
      console.error('Failed to save targets:', error);
    } finally {
      endSaving();
    }
  }
  updateUI();
}

async function fetchFoodsFromApi() {
  const response = await fetch(FOODS_API_ENDPOINT, { cache: 'no-store' });
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

    FOOD_CATEGORIES.forEach(category => {
      const categoryFoods = foodDb
        .filter(food => food.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'el'));

      if (!categoryFoods.length) return;

      const group = document.createElement('optgroup');
      group.label = FOOD_CATEGORY_LABELS[category] || category;

      categoryFoods.forEach(food => {
        const option = document.createElement('option');
        option.value = food.id;
        option.textContent = `${food.name} (${round(food.protein)}P/${round(food.carbs)}C/${round(food.fat)}F)`;
        group.appendChild(option);
      });

      select.appendChild(group);
    });

    if (selected && foodDb.some(item => item.id === selected)) select.value = selected;
  });
  renderAlternativeMenus();
}

function ensureDbPickerForRow(row) {
  if (!row || !row.classList.contains('editable') || row.querySelector('.db-picker')) return;

  const picker = document.createElement('div');
  picker.className = 'db-picker';
  picker.innerHTML = `
    <select class="db-select"><option value="">Επιλογή από βάση</option></select>
  `;

  const altWrap = row.querySelector('.food-alt-wrap');
  if (altWrap) altWrap.before(picker);
  else row.appendChild(picker);
}

function getFoodIdFromRow(row) {
  const select = row?.querySelector('.db-select');
  if (select?.value && foodDb.some(item => item.id === select.value)) return select.value;
  const labelText = row?.querySelector('.food-main label')?.textContent || '';
  const byName = foodDb.find(item => toFoodKey(item.name) === toFoodKey(labelText));
  return byName?.id || null;
}

function closeAlternativeMenus(exceptRow = null) {
  document.querySelectorAll('.food-alt-wrap.open').forEach(wrap => {
    const row = wrap.closest('.food-row');
    if (exceptRow && row === exceptRow) return;
    wrap.classList.remove('open');
  });
}

function getRowCalories(row) {
  const qty = Number(row?.querySelector('.qty-box input')?.value || 0);
  const unit = normalizeUnit(row?.querySelector('.qty-box span')?.textContent || 'g');
  const caloriesPerUnit = Number(row?.dataset.cal || 0);
  const factor = unit === 'τεμ' ? qty : qty / 100;
  return caloriesPerUnit * factor;
}

function getEquivalentQtyForFoodByCalories(calories, food) {
  if (!food || !Number.isFinite(calories) || calories <= 0 || food.cal <= 0) return 0;
  if (food.unit === 'τεμ') return round(calories / food.cal);
  return round((calories / food.cal) * 100);
}

function renderAlternativeMenuForRow(row) {
  const wrap = row?.querySelector('.food-alt-wrap');
  const select = wrap?.querySelector('.alt-select');
  const applyBtn = wrap?.querySelector('.alt-apply-btn');
  if (!wrap || !select || !applyBtn) return;

  const isLocked = row.dataset.locked === '1';
  const currentFoodId = getFoodIdFromRow(row);
  const currentFood = currentFoodId ? getFoodById(currentFoodId) : null;

  if (!isLocked || !currentFood) {
    wrap.hidden = true;
    wrap.classList.remove('open');
    return;
  }

  const alternatives = foodDb
    .filter(food => food.id !== currentFood.id && food.category === currentFood.category)
    .sort((a, b) => a.name.localeCompare(b.name, 'el'));

  if (!alternatives.length) {
    wrap.hidden = true;
    wrap.classList.remove('open');
    return;
  }

  wrap.hidden = false;
  select.innerHTML = '<option value="">Επίλεξε εναλλακτική</option>';
  alternatives.forEach(food => {
    const option = document.createElement('option');
    option.value = food.id;
    option.textContent = `${food.name} (${round(food.cal)} kcal/${food.unit === 'τεμ' ? 'τεμ' : `100 ${food.unit}`})`;
    select.appendChild(option);
  });
  applyBtn.disabled = !select.value;
}

function renderAlternativeMenus() {
  document.querySelectorAll('.food-row.editable').forEach(renderAlternativeMenuForRow);
}

function applyAlternativeFoodSelection(row) {
  const wrap = row?.querySelector('.food-alt-wrap');
  const select = wrap?.querySelector('.alt-select');
  if (!row || !select?.value) return;

  const alternativeFood = getFoodById(select.value);
  if (!alternativeFood) return;

  const targetCalories = getRowCalories(row);
  applyFoodEntryToRow(row, alternativeFood);

  const qtyInput = row.querySelector('.qty-box input');
  const equivalentQty = getEquivalentQtyForFoodByCalories(targetCalories, alternativeFood);
  if (qtyInput && equivalentQty > 0) qtyInput.value = String(equivalentQty);

  const dbSelect = row.querySelector('.db-select');
  if (dbSelect) dbSelect.value = alternativeFood.id;

  saveRowForUser(row, alternativeFood.id).catch(error => console.error('Failed to save alternative row:', error));
  markUnsavedChanges();
  renderAlternativeMenuForRow(row);
  closeAlternativeMenus();
  updateUI();
}

function setRowLocked(row, locked) {
  if (!row) return;
  row.dataset.locked = locked ? '1' : '0';
  row.classList.toggle('row-locked', locked);

  const qtyInput = row.querySelector('.qty-box input');
  if (qtyInput) qtyInput.disabled = locked;

  const dbSelect = row.querySelector('.db-select');
  if (dbSelect) dbSelect.disabled = locked;

  const editBtn = row.querySelector('.row-edit-btn');
  const saveBtn = row.querySelector('.row-save-btn');
  if (editBtn) editBtn.classList.toggle('active', !locked);
  if (saveBtn) saveBtn.hidden = locked;

  closeAlternativeMenus();
  renderAlternativeMenuForRow(row);
}

function ensureRowActions(row) {
  if (!row || row.querySelector('.row-actions')) return;

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  actions.innerHTML = `
    <button type="button" class="icon-btn row-edit-btn" title="Επεξεργασία" aria-label="Επεξεργασία">✎</button>
    <button type="button" class="icon-btn row-save-btn" title="Save" aria-label="Save" hidden>💾</button>
    <button type="button" class="icon-btn danger row-remove-btn" title="Αφαίρεση" aria-label="Αφαίρεση">🗑</button>
  `;
  row.appendChild(actions);
}

function prepareRow(row, locked = true) {
  if (!row || !row.classList.contains('editable')) return;
  ensureDbPickerForRow(row);
  ensureRowActions(row);
  setRowLocked(row, locked);
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
      const cookedProfile = getCookedWeightProfile(food.name);
      if (cookedProfile) small.textContent = `ανά 100 ${food.unit} μαγειρεμένο`;
      else small.textContent = `ανά 100 ${food.unit}`;
    }
  }
  if (unitEl) unitEl.textContent = food.unit;

  ensureRowImage(row);
  updatePrepNoteForRow(row);
  renderAlternativeMenuForRow(row);
}

async function saveRowForUser(row, foodId) {
  const mealCard = row.closest('.meal-card');
  const mealKey = mealCard?.dataset.meal;
  if (!mealKey || mealCard?.classList.contains('sweet-card')) return;

  if (!row.dataset.rowKey) row.dataset.rowKey = `row-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const mealTitle = mealCard.querySelector('.meal-top h3')?.textContent?.trim() || mealKey;
  const qty = Number(row.querySelector('.qty-box input')?.value || 0);

  beginSaving('Αποθήκευση...');
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/meal-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealKey, rowKey: row.dataset.rowKey, foodId, qty, mealTitle })
    });
    if (!response.ok) throw new Error('meal_item_write_failed');
  } finally {
    endSaving();
  }
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
    <div class="qty-box"><input type="number" value="100" min="0" step="10"><span>g</span><small class="raw-hint"></small></div>
    <div class="food-alt-wrap" hidden>
      <button type="button" class="mini-btn alt-open-btn">Δες εναλλακτικές</button>
      <div class="alt-menu">
        <select class="alt-select">
          <option value="">Επίλεξε εναλλακτική</option>
        </select>
        <button type="button" class="mini-btn alt-apply-btn" disabled>Εφαρμογή</button>
      </div>
    </div>
  `;

  prepareRow(row, false);
  ensureRowImage(row);
  return row;
}

function addFoodToMeal(mealCard) {
  if (!mealCard) return;
  mealCard.appendChild(createNewFoodRow());
  refreshDbSelectOptions();
  updateUI();
}

function createAlternativeMealFromCard(sourceMealCard) {
  if (!sourceMealCard || sourceMealCard.classList.contains('sweet-card')) return null;

  const sourceMealKey = String(sourceMealCard.dataset.meal || 'meal').trim() || 'meal';
  const sourceGroupKey = sourceMealCard.dataset.mealGroup || getMealGroupKey(sourceMealKey) || sourceMealKey;
  const sourceTitle = sourceMealCard.querySelector('.meal-top h3')?.textContent?.trim() || 'Γεύμα';
  const sourceDescription = sourceMealCard.querySelector('.meal-top p')?.textContent?.trim() || '';
  const altMealKey = `${sourceGroupKey}-alt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const altTitle = sourceTitle.includes('Εναλλακτική')
    ? sourceTitle
    : `${sourceTitle} (Εναλλακτική)`;

  const altMealCard = createMealCard(altMealKey, altTitle, sourceDescription, false);
  altMealCard.classList.remove('custom-meal');
  altMealCard.dataset.mealGroup = sourceGroupKey;

  const sourceRows = Array.from(sourceMealCard.querySelectorAll('.food-row.editable'));
  sourceRows.forEach((sourceRow, idx) => {
    const newRow = createNewFoodRow();
    newRow.dataset.rowKey = `row-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;

    const foodId = getFoodIdFromRow(sourceRow);
    const food = foodId ? getFoodById(foodId) : null;
    if (food) {
      applyFoodEntryToRow(newRow, food);
      const select = newRow.querySelector('.db-select');
      if (select) select.value = food.id;
    }

    const sourceQty = Number(sourceRow.querySelector('.qty-box input')?.value || 0);
    const qtyInput = newRow.querySelector('.qty-box input');
    if (qtyInput) qtyInput.value = String(sourceQty);

    altMealCard.appendChild(newRow);
    prepareRow(newRow, true);
  });

  if (!sourceRows.length) {
    const newRow = createNewFoodRow();
    altMealCard.appendChild(newRow);
    prepareRow(newRow, true);
  }

  return altMealCard;
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

  if (!actions.querySelector('.add-alt-meal-btn')) {
    const addAltMealBtn = document.createElement('button');
    addAltMealBtn.type = 'button';
    addAltMealBtn.className = 'mini-btn add-alt-meal-btn';
    addAltMealBtn.textContent = '+ Εναλλακτικό γεύμα';
    actions.appendChild(addAltMealBtn);
  }

  if (!actions.querySelector('.calculate-with-this-btn')) {
    const chooseForTotalsBtn = document.createElement('button');
    chooseForTotalsBtn.type = 'button';
    chooseForTotalsBtn.className = 'mini-btn calculate-with-this-btn';
    chooseForTotalsBtn.textContent = 'Υπολόγισε σύμφωνα με αυτό';
    chooseForTotalsBtn.hidden = true;
    actions.appendChild(chooseForTotalsBtn);
  }
}

function createMealCard(mealKey = null, title = null, description = null, includeInitialRow = true) {
  customMealCounter += 1;
  const key = mealKey || `custom-${customMealCounter}`;
  const mealGroupKey = getMealGroupKey(key) || key;

  const card = document.createElement('div');
  card.className = 'meal-card custom-meal';
  card.dataset.meal = key;
  card.dataset.mealGroup = mealGroupKey;

  card.innerHTML = `
    <div class="meal-top">
      <div>
        <h3 class="editable-text" contenteditable="true">${title || `Νέο γεύμα ${customMealCounter}`}</h3>
        <p class="editable-text" contenteditable="true">${description || 'Γράψε περιγραφή γεύματος'}</p>
      </div>
      <span class="meal-kcal">~0 kcal</span>
      <div class="meal-actions">
        <button type="button" class="mini-btn add-food-btn">+ Νέο τρόφιμο</button>
        <button type="button" class="mini-btn add-alt-meal-btn">+ Εναλλακτικό γεύμα</button>
        <button type="button" class="mini-btn calculate-with-this-btn" hidden>Υπολόγισε σύμφωνα με αυτό</button>
        <button type="button" class="mini-btn danger remove-meal-btn">Αφαίρεση γεύματος</button>
      </div>
    </div>
  `;

  if (includeInitialRow) card.appendChild(createNewFoodRow());
  return card;
}

function ensureAddMealButton() {
  const mealsPanel = document.querySelector('.panel.glass.meals');
  const head = mealsPanel?.querySelector('.section-head');
  if (!head) return;

  let actions = head.querySelector('.section-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'section-actions';
    head.appendChild(actions);
  }

  if (!actions.querySelector('.add-meal-btn')) {
    const addMealBtn = document.createElement('button');
    addMealBtn.type = 'button';
    addMealBtn.className = 'btn btn-secondary add-meal-btn';
    addMealBtn.textContent = '+ Νέο γεύμα';
    actions.appendChild(addMealBtn);
  }

  if (!document.querySelector('.save-changes-btn')) {
    const saveChangesBtn = document.createElement('button');
    saveChangesBtn.type = 'button';
    saveChangesBtn.className = 'btn btn-secondary save-changes-btn';
    saveChangesBtn.textContent = 'Save Changes';
    saveChangesBtn.hidden = true;
    document.body.appendChild(saveChangesBtn);
  }
}

function setupMealButtons() {
  document.querySelectorAll('.meal-card').forEach(ensureMealControlButtons);
  ensureAddMealButton();
  organizeMealGroupsInDom();
  syncMealSelectionControls();
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
  const calorieTarget = Number(targetsData.calorieTarget);
  const proteinMultiplier = Number(targetsData.proteinMultiplier);
  const weight = Number(targetsData.weight);
  if (Number.isFinite(calorieTarget)) refs.calorieTargetInput.value = String(calorieTarget);
  if (Number.isFinite(proteinMultiplier)) refs.proteinMultiplier.value = String(proteinMultiplier);
  if (Number.isFinite(weight)) refs.weightInput.value = String(weight);
}

function clearDashboardMealCards() {
  document.querySelectorAll('.meal-card:not(.sweet-card)').forEach(card => card.remove());
  document.querySelectorAll('.meal-group-box').forEach(box => box.remove());
}

function collectDashboardPayload() {
  const meals = Array.from(document.querySelectorAll('.meal-card:not(.sweet-card)')).map((card, idx) => {
    const mealKey = String(card.dataset.meal || `meal-${idx + 1}`).trim();
    const title = card.querySelector('.meal-top h3')?.textContent?.trim() || mealKey;
    const description = card.querySelector('.meal-top p')?.textContent?.trim() || '';

    const items = Array.from(card.querySelectorAll('.food-row.editable')).map(row => {
      if (!row.dataset.rowKey) row.dataset.rowKey = `row-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      return {
        rowKey: row.dataset.rowKey,
        foodId: getFoodIdFromRow(row),
        qty: Number(row.querySelector('.qty-box input')?.value || 0)
      };
    }).filter(item => item.foodId);

    return {
      mealKey,
      title,
      description,
      sortOrder: idx + 1,
      items
    };
  });

  return { meals };
}

async function saveDashboardChanges(silent = false) {
  beginSaving('Αποθήκευση...');
  try {
  const payload = collectDashboardPayload();
  const response = await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/dashboard`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('dashboard_save_failed');
  setHasUnsavedChanges(false);
  if (!silent) {
    const saveBtn = document.querySelector('.save-changes-btn');
    if (saveBtn) {
      const original = saveBtn.textContent;
      saveBtn.textContent = 'Saved';
      setTimeout(() => {
        saveBtn.textContent = original;
      }, 900);
    }
  }
  } finally {
    endSaving();
  }
}

async function loadDashboard() {
  const response = await fetch(`/api/users/${encodeURIComponent(USER_SLUG)}/dashboard`, { cache: 'no-store' });
  if (!response.ok) throw new Error('dashboard_fetch_failed');
  const data = await response.json();

  applyDashboardTargets(data.targets);

  clearDashboardMealCards();
  const sweetCard = document.querySelector('.meal-card.sweet-card');
  const mealsPanel = document.querySelector('.panel.glass.meals');

  (data.meals || []).forEach(meal => {
    const card = createMealCard(meal.mealKey, meal.title, meal.description, false);
    card.classList.remove('custom-meal');

    (meal.items || []).forEach(item => {
      if (!item?.food) return;
      const row = createNewFoodRow();
      row.dataset.rowKey = String(item.rowKey || `row-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
      applyFoodEntryToRow(row, normalizeFoodEntry(item.food));

      const qtyInput = row.querySelector('.qty-box input');
      if (qtyInput) qtyInput.value = String(item.qty);

      const select = row.querySelector('.db-select');
      if (select) select.value = item.food.id;

      card.appendChild(row);
      prepareRow(row, true);
    });

    if (!card.querySelector('.food-row.editable')) {
      const row = createNewFoodRow();
      card.appendChild(row);
      prepareRow(row, true);
    }

    if (sweetCard?.parentElement) sweetCard.parentElement.insertBefore(card, sweetCard);
    else mealsPanel?.appendChild(card);
  });

  setupMealButtons();
}

refs.applyTargets?.addEventListener('click', applyTargets);

document.addEventListener('input', e => {
  const qtyInput = e.target.closest('.food-row.editable .qty-box input');
  if (qtyInput) {
    markUnsavedChanges();
    updateUI();
    return;
  }

  if (e.target.closest('.meal-top .editable-text')) {
    markUnsavedChanges();
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

  const editBtn = e.target.closest('.row-edit-btn');
  if (editBtn) {
    const row = editBtn.closest('.food-row');
    if (row) setRowLocked(row, false);
    return;
  }

  const saveBtn = e.target.closest('.row-save-btn');
  if (saveBtn) {
    const row = saveBtn.closest('.food-row');
    if (!row) return;

    const select = row.querySelector('.db-select');
    const food = getFoodById(select?.value);
    if (food) applyFoodEntryToRow(row, food);

    const foodId = getFoodIdFromRow(row);
    if (foodId) {
      saveRowForUser(row, foodId).catch(error => console.error('Failed to save row:', error));
    }
    setRowLocked(row, true);
    markUnsavedChanges();
    updateUI();
    return;
  }

  const altOpenBtn = e.target.closest('.alt-open-btn');
  if (altOpenBtn) {
    const row = altOpenBtn.closest('.food-row');
    const wrap = row?.querySelector('.food-alt-wrap');
    if (!row || !wrap || wrap.hidden) return;
    const isOpen = wrap.classList.contains('open');
    if (isOpen) wrap.classList.remove('open');
    else {
      renderAlternativeMenuForRow(row);
      closeAlternativeMenus(row);
      wrap.classList.add('open');
    }
    return;
  }

  const altApplyBtn = e.target.closest('.alt-apply-btn');
  if (altApplyBtn) {
    const row = altApplyBtn.closest('.food-row');
    if (!row) return;
    applyAlternativeFoodSelection(row);
    return;
  }

  const saveChangesBtn = e.target.closest('.save-changes-btn');
  if (saveChangesBtn) {
    saveDashboardChanges().catch(error => console.error('Failed to save dashboard:', error));
    return;
  }

  const addFoodBtn = e.target.closest('.add-food-btn');
  if (addFoodBtn) {
    addFoodToMeal(addFoodBtn.closest('.meal-card'));
    markUnsavedChanges();
    return;
  }

  const addMealBtn = e.target.closest('.add-meal-btn');
  if (addMealBtn) {
    const newMeal = createMealCard();
    const sweetCard = document.querySelector('.meal-card.sweet-card');
    if (sweetCard?.parentElement) sweetCard.parentElement.insertBefore(newMeal, sweetCard);
    else document.querySelector('.panel.glass.meals')?.appendChild(newMeal);
    organizeMealGroupsInDom();
    refreshDbSelectOptions();
    markUnsavedChanges();
    updateUI();
    return;
  }

  const addAltMealBtn = e.target.closest('.add-alt-meal-btn');
  if (addAltMealBtn) {
    const sourceMealCard = addAltMealBtn.closest('.meal-card');
    const altMealCard = createAlternativeMealFromCard(sourceMealCard);
    if (!altMealCard || !sourceMealCard?.parentElement) return;

    sourceMealCard.parentElement.insertBefore(altMealCard, sourceMealCard.nextSibling);
    organizeMealGroupsInDom();
    refreshDbSelectOptions();
    syncMealSelectionControls();
    markUnsavedChanges();
    updateUI();
    return;
  }

  const calculateWithThisBtn = e.target.closest('.calculate-with-this-btn');
  if (calculateWithThisBtn) {
    const mealCard = calculateWithThisBtn.closest('.meal-card');
    const groupKey = mealCard?.dataset.mealGroup;
    const mealKey = mealCard?.dataset.meal;
    if (!mealCard || !groupKey || !mealKey) return;
    mealGroupSelection.set(groupKey, mealKey);
    syncMealSelectionControls();
    updateUI();
    return;
  }

  const removeRowBtn = e.target.closest('.row-remove-btn, .remove-row-btn');
  if (removeRowBtn) {
    removeRowBtn.closest('.food-row')?.remove();
    markUnsavedChanges();
    updateUI();
    return;
  }

  const removeMealBtn = e.target.closest('.remove-meal-btn');
  if (removeMealBtn) {
    removeMealBtn.closest('.meal-card')?.remove();
    organizeMealGroupsInDom();
    syncMealSelectionControls();
    saveDashboardChanges(true).catch(error => {
      console.error('Failed to auto-save after meal removal:', error);
      markUnsavedChanges();
    });
    updateUI();
    return;
  }

  if (e.target.closest('.food-alt-wrap')) return;
  closeAlternativeMenus();
});

document.addEventListener('change', e => {
  const altSelect = e.target.closest('.alt-select');
  if (!altSelect) return;
  const wrap = altSelect.closest('.food-alt-wrap');
  const applyBtn = wrap?.querySelector('.alt-apply-btn');
  if (applyBtn) applyBtn.disabled = !altSelect.value;
});

async function initApp() {
  saveOverlay = document.getElementById('savingOverlay');
  saveOverlayLabel = document.getElementById('savingOverlayLabel');
  setupImageModal();
  beginSaving('Φόρτωση δεδομένων...');
  try {
    clearDashboardMealCards();
    foodDb = await fetchFoodsFromApi();
    refreshDbSelectOptions();

    await loadDashboard();

    updateFoodImages();
    renderAlternativeMenus();
    await applyTargets({ persistRemote: false });
    setHasUnsavedChanges(false);
  } finally {
    endSaving();
  }
}

initApp().catch(error => {
  console.error('Init failed:', error);
  if (refs.feedbackBox) {
    refs.feedbackBox.textContent = 'Αποτυχία φόρτωσης δεδομένων από τη βάση. Κάνε refresh ή έλεγξε το backend.';
  }
  endSaving();
});

