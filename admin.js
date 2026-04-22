const FOODS_API_ENDPOINT = '/api/foods';
const FOOD_IMAGES_API_ENDPOINT = '/api/food-images';
const FOOD_IMAGES_CATALOG_ENDPOINT = '/assets/food_images/catalog.json';
const FOOD_CATEGORIES = ['vegetables', 'fruit', 'protein', 'carb', 'fat'];
const FOOD_CATEGORY_LABELS = {
  vegetables: 'Λαχανικά',
  fruit: 'Φρούτα (υδατάνθρακας)',
  protein: 'Πηγή πρωτεΐνης',
  carb: 'Πηγή υδατάνθρακα',
  fat: 'Πηγή λιπαρών'
};

const refs = {
  foodDbTable: document.getElementById('foodDbTable'),
  dbNameInput: document.getElementById('dbNameInput'),
  dbCategoryInput: document.getElementById('dbCategoryInput'),
  dbUnitInput: document.getElementById('dbUnitInput'),
  dbCalInput: document.getElementById('dbCalInput'),
  dbProteinInput: document.getElementById('dbProteinInput'),
  dbCarbsInput: document.getElementById('dbCarbsInput'),
  dbFatInput: document.getElementById('dbFatInput'),
  dbImageInput: document.getElementById('dbImageInput'),
  imagePreview: document.getElementById('imagePreview'),
  imagePreviewText: document.getElementById('imagePreviewText'),
  saveFoodDbBtn: document.getElementById('saveFoodDbBtn')
};

let foods = [];
let imageOptions = [];

function round(value) {
  return Math.round(value * 10) / 10;
}

function normalizeFoodEntry(entry) {
  const rawCategory = String(entry.category || '').trim().toLowerCase();
  const category = FOOD_CATEGORIES.includes(rawCategory) ? rawCategory : 'protein';

  return {
    id: entry.id,
    name: String(entry.name || '').trim(),
    category,
    unit: String(entry.unit || 'g'),
    cal: Number(entry.cal || 0),
    protein: Number(entry.protein || 0),
    carbs: Number(entry.carbs || 0),
    fat: Number(entry.fat || 0),
    image_path: String(entry.image_path || 'assets/food_images/placeholder.svg').replace(/\\/g, '/')
  };
}

async function fetchFoods() {
  const res = await fetch(FOODS_API_ENDPOINT);
  if (!res.ok) throw new Error('foods_fetch_failed');
  const data = await res.json();
  foods = Array.isArray(data) ? data.map(normalizeFoodEntry) : [];
}

async function fetchImageOptions() {
  const [apiResult, catalogResult] = await Promise.allSettled([
    fetch(FOOD_IMAGES_API_ENDPOINT, { cache: 'no-store' }).then(res => (res.ok ? res.json() : [])),
    fetch(FOOD_IMAGES_CATALOG_ENDPOINT, { cache: 'no-store' }).then(res => (res.ok ? res.json() : []))
  ]);

  const apiPaths = apiResult.status === 'fulfilled' && Array.isArray(apiResult.value) ? apiResult.value : [];
  const catalogPaths = catalogResult.status === 'fulfilled' && Array.isArray(catalogResult.value) ? catalogResult.value : [];

  imageOptions = Array.from(
    new Set([...apiPaths, ...catalogPaths].map(path => String(path || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'el'));
}

function renderImageSelect() {
  refs.dbImageInput.innerHTML = '';
  imageOptions.forEach(path => {
    const option = document.createElement('option');
    option.value = path;
    option.textContent = path.replace('assets/food_images/', '');
    refs.dbImageInput.appendChild(option);
  });
  if (!imageOptions.length) {
    const option = document.createElement('option');
    option.value = 'assets/food_images/placeholder.svg';
    option.textContent = 'placeholder.svg';
    refs.dbImageInput.appendChild(option);
  }
  updateImagePreview();
}

function updateImagePreview() {
  const path = refs.dbImageInput.value || 'assets/food_images/placeholder.svg';
  refs.imagePreview.src = path;
  refs.imagePreviewText.textContent = path;
}

function fillForm(food) {
  refs.dbNameInput.value = food.name;
  refs.dbCategoryInput.value = food.category || 'protein';
  refs.dbUnitInput.value = food.unit;
  refs.dbCalInput.value = String(food.cal);
  refs.dbProteinInput.value = String(food.protein);
  refs.dbCarbsInput.value = String(food.carbs);
  refs.dbFatInput.value = String(food.fat);
  refs.dbImageInput.value = food.image_path || 'assets/food_images/placeholder.svg';
  updateImagePreview();
}

function renderFoodsTable() {
  refs.foodDbTable.innerHTML = '';
  foods
    .slice()
    .sort((a, b) => {
      const byCategory = (FOOD_CATEGORIES.indexOf(a.category) - FOOD_CATEGORIES.indexOf(b.category));
      if (byCategory !== 0) return byCategory;
      return a.name.localeCompare(b.name, 'el');
    })
    .forEach(food => {
      const tr = document.createElement('tr');

      const values = [
        food.name,
        FOOD_CATEGORY_LABELS[food.category] || FOOD_CATEGORY_LABELS.protein,
        food.unit,
        String(round(food.cal)),
        String(round(food.protein)),
        String(round(food.carbs)),
        String(round(food.fat))
      ];

      values.forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });

      const imageTd = document.createElement('td');
      const thumb = document.createElement('img');
      thumb.className = 'food-thumb';
      thumb.src = food.image_path;
      thumb.alt = food.name;
      imageTd.appendChild(thumb);
      tr.appendChild(imageTd);

      const actionsTd = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'mini-btn';
      editBtn.textContent = 'Επεξεργασία';
      editBtn.addEventListener('click', () => fillForm(food));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'mini-btn danger';
      deleteBtn.textContent = 'Διαγραφή';
      deleteBtn.addEventListener('click', async () => {
        await fetch(`${FOODS_API_ENDPOINT}/${encodeURIComponent(food.id)}`, { method: 'DELETE' });
        await reloadData();
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      refs.foodDbTable.appendChild(tr);
    });
}

async function saveFood() {
  const payload = {
    name: refs.dbNameInput.value.trim(),
    category: refs.dbCategoryInput.value,
    unit: refs.dbUnitInput.value,
    cal: Number(refs.dbCalInput.value || 0),
    protein: Number(refs.dbProteinInput.value || 0),
    carbs: Number(refs.dbCarbsInput.value || 0),
    fat: Number(refs.dbFatInput.value || 0),
    image_path: refs.dbImageInput.value
  };

  if (!payload.name) return;

  const res = await fetch(FOODS_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('save_failed');
}

async function reloadData() {
  await Promise.all([fetchFoods(), fetchImageOptions()]);
  renderImageSelect();
  renderFoodsTable();
}

refs.dbImageInput.addEventListener('change', updateImagePreview);
refs.saveFoodDbBtn.addEventListener('click', async () => {
  try {
    await saveFood();
    await reloadData();
  } catch (error) {
    console.error(error);
  }
});

reloadData().catch(error => console.error(error));
