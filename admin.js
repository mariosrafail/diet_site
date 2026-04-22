const FOODS_API_ENDPOINT = '/api/foods';
const USERS_API_ENDPOINT = '/api/users';
const FOOD_IMAGE_UPLOAD_API_ENDPOINT = '/api/food-images/upload';
const ADMIN_SLUG = 'admin123123';
const ADMIN_SESSION_STORAGE_KEY = 'diet_admin_session';
const FOOD_CATEGORIES = ['vegetables', 'fruit', 'protein', 'carb', 'fat', 'water'];
const FOOD_CATEGORY_LABELS = {
  vegetables: 'Λαχανικά',
  fruit: 'Φρούτα (υδατάνθρακας)',
  protein: 'Πηγή πρωτεΐνης',
  carb: 'Πηγή υδατάνθρακα',
  fat: 'Πηγή λιπαρών',
  water: 'Νερό'
};

const refs = {
  foodDbTable: document.getElementById('foodDbTable'),
  foodCategoryFilter: document.getElementById('foodCategoryFilter'),
  dbNameInput: document.getElementById('dbNameInput'),
  dbCategoryInput: document.getElementById('dbCategoryInput'),
  dbUnitInput: document.getElementById('dbUnitInput'),
  dbCalInput: document.getElementById('dbCalInput'),
  dbProteinInput: document.getElementById('dbProteinInput'),
  dbCarbsInput: document.getElementById('dbCarbsInput'),
  dbFatInput: document.getElementById('dbFatInput'),
  dbImageInput: document.getElementById('dbImageInput'),
  dbImageFileInput: document.getElementById('dbImageFileInput'),
  uploadFoodImageBtn: document.getElementById('uploadFoodImageBtn'),
  currentImagePath: document.getElementById('currentImagePath'),
  uploadFoodImageStatus: document.getElementById('uploadFoodImageStatus'),
  adminLoadingOverlay: document.getElementById('adminLoadingOverlay'),
  adminLoadingOverlayLabel: document.getElementById('adminLoadingOverlayLabel'),
  imagePreview: document.getElementById('imagePreview'),
  imagePreviewText: document.getElementById('imagePreviewText'),
  saveFoodDbBtn: document.getElementById('saveFoodDbBtn'),
  adminUsersList: document.getElementById('adminUsersList')
};

let foods = [];
let users = [];
let activeCategoryFilter = 'all';
let pendingLoadingCount = 0;

function normalizeUserSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function hasAdminSession() {
  return normalizeUserSlug(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)) === ADMIN_SLUG;
}

function ensureAdminAccess() {
  if (hasAdminSession()) return true;
  window.location.href = 'index.html';
  return false;
}

function beginLoading(label = 'Φόρτωση...') {
  pendingLoadingCount += 1;
  if (!refs.adminLoadingOverlay) return;
  if (refs.adminLoadingOverlayLabel) refs.adminLoadingOverlayLabel.textContent = label;
  refs.adminLoadingOverlay.classList.add('open');
  refs.adminLoadingOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('saving');
}

function endLoading() {
  pendingLoadingCount = Math.max(0, pendingLoadingCount - 1);
  if (pendingLoadingCount > 0 || !refs.adminLoadingOverlay) return;
  refs.adminLoadingOverlay.classList.remove('open');
  refs.adminLoadingOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('saving');
}

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

async function fetchUsers() {
  const res = await fetch(USERS_API_ENDPOINT, { cache: 'no-store' });
  if (!res.ok) throw new Error('users_fetch_failed');
  const data = await res.json();
  users = Array.isArray(data) ? data : [];
}

function updateImagePreview() {
  const path = refs.dbImageInput.value || 'assets/food_images/placeholder.svg';
  refs.imagePreview.src = path;
  refs.imagePreviewText.textContent = path;
  if (refs.currentImagePath) refs.currentImagePath.textContent = `Τρέχουσα εικόνα: ${path}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : '';
      if (!base64) reject(new Error('base64_parse_failed'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedImage() {
  const file = refs.dbImageFileInput.files?.[0];
  if (!file) {
    refs.uploadFoodImageStatus.textContent = 'Διάλεξε πρώτα αρχείο εικόνας.';
    return;
  }

  refs.uploadFoodImageStatus.textContent = 'Γίνεται upload...';
  refs.uploadFoodImageBtn.disabled = true;
  beginLoading('Upload εικόνας...');

  try {
    const contentBase64 = await fileToBase64(file);
    const res = await fetch(FOOD_IMAGE_UPLOAD_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentBase64 })
    });
    if (!res.ok) throw new Error('upload_failed');

    const data = await res.json();
    await reloadData();
    if (data?.path) refs.dbImageInput.value = data.path;
    updateImagePreview();
    refs.uploadFoodImageStatus.textContent = 'Η εικόνα ανέβηκε επιτυχώς.';
    refs.dbImageFileInput.value = '';
  } catch (error) {
    console.error(error);
    refs.uploadFoodImageStatus.textContent = 'Αποτυχία upload. Δοκίμασε ξανά.';
  } finally {
    refs.uploadFoodImageBtn.disabled = false;
    endLoading();
  }
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

  const visibleFoods = foods
    .filter(food => activeCategoryFilter === 'all' || food.category === activeCategoryFilter)
    .slice()
    .sort((a, b) => {
      const byCategory = (FOOD_CATEGORIES.indexOf(a.category) - FOOD_CATEGORIES.indexOf(b.category));
      if (byCategory !== 0) return byCategory;
      return a.name.localeCompare(b.name, 'el');
    });

  visibleFoods
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

function renderUsersList() {
  if (!refs.adminUsersList) return;
  refs.adminUsersList.innerHTML = '';

  const visibleUsers = users
    .filter(user => normalizeUserSlug(user.slug) !== ADMIN_SLUG)
    .sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || ''), 'el'));

  if (!visibleUsers.length) {
    refs.adminUsersList.textContent = 'Δεν υπάρχουν χρήστες.';
    return;
  }

  visibleUsers.forEach(user => {
    const item = document.createElement('div');
    item.className = 'admin-user-item';

    const meta = document.createElement('div');
    meta.className = 'admin-user-meta';
    const fullName = String(user.full_name || '').trim();
    const strong = document.createElement('strong');
    strong.textContent = fullName || user.slug;
    const small = document.createElement('small');
    small.textContent = `slug: ${user.slug}`;
    meta.appendChild(strong);
    meta.appendChild(small);

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'mini-btn';
    openBtn.textContent = 'Άνοιγμα διατροφής';
    openBtn.addEventListener('click', () => {
      const slug = encodeURIComponent(String(user.slug || '').trim());
      window.location.href = `index.html?managed_user=${slug}&admin=1`;
    });

    item.appendChild(meta);
    item.appendChild(openBtn);
    refs.adminUsersList.appendChild(item);
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
  beginLoading('Φόρτωση δεδομένων...');
  try {
    await Promise.all([fetchFoods(), fetchUsers()]);
    renderFoodsTable();
    renderUsersList();
  } finally {
    endLoading();
  }
}

refs.uploadFoodImageBtn.addEventListener('click', () => {
  uploadSelectedImage().catch(error => console.error(error));
});
refs.foodCategoryFilter.addEventListener('change', () => {
  activeCategoryFilter = refs.foodCategoryFilter.value || 'all';
  renderFoodsTable();
});
refs.saveFoodDbBtn.addEventListener('click', async () => {
  beginLoading('Αποθήκευση...');
  try {
    await saveFood();
    await reloadData();
  } catch (error) {
    console.error(error);
  } finally {
    endLoading();
  }
});

if (ensureAdminAccess()) {
  updateImagePreview();
  reloadData().catch(error => console.error(error));
}
