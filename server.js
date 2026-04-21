const fs = require('fs');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const FOOD_IMAGES_DIR = path.join(__dirname, 'assets', 'food_images');

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const app = express();
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DEFAULT_FOOD_DB = [
  { name: 'Αυγά αχυρώνα ΜΑΡΑΤΑ μεσαία', unit: 'τεμ', cal: 82.5, protein: 7.2, carbs: 0.6, fat: 6.1, image_path: 'assets/food_images/auga.jpg' },
  { name: 'Ασπράδι αυγού ΒΛΑΧΑΚΗ', unit: 'ml', cal: 50, protein: 10, carbs: 1.1, fat: 0.5, image_path: 'assets/food_images/aspradi.jpg' },
  { name: 'Ψωμί τοστ', unit: 'τεμ', cal: 66.4, protein: 2.7, carbs: 10.8, fat: 1, image_path: 'assets/food_images/psomi.jpg' },
  { name: 'Cottage ADORO', unit: 'g', cal: 83, protein: 12.7, carbs: 3.1, fat: 2.2, image_path: 'assets/food_images/cottage.jpg' },
  { name: 'Κατίκι Δομοκού ΗΠΕΙΡΟΣ', unit: 'g', cal: 169, protein: 10, carbs: 3, fat: 13, image_path: 'assets/food_images/katiki.jpg' },
  { name: 'Στήθος κοτόπουλο ψητό', unit: 'g', cal: 165, protein: 31, carbs: 0, fat: 3.6, image_path: 'assets/food_images/placeholder.svg' },
  { name: 'Ρύζι basmati βρασμένο', unit: 'g', cal: 351, protein: 7.5, carbs: 76, fat: 1.3, image_path: 'assets/food_images/basmati.jpg' },
  { name: 'Ελαιόλαδο', unit: 'g', cal: 884, protein: 0, carbs: 0, fat: 100, image_path: 'assets/food_images/placeholder.svg' },
  { name: 'Τρικαλινό ελαφρύ', unit: 'g', cal: 234, protein: 36, carbs: 0, fat: 10, image_path: 'assets/food_images/trikalino.jpg' },
  { name: 'ΝΙΚΑΣ Μπριζόλα σε φέτες', unit: 'g', cal: 111, protein: 18.2, carbs: 3.1, fat: 2.9, image_path: 'assets/food_images/mprizola.jpeg' },
  { name: 'AGRINO Ρυζογκοφρέτες με ρίγανη', unit: 'τεμ', cal: 29, protein: 0.64, carbs: 5.3, fat: 0.5, image_path: 'assets/food_images/ruzogkofretes.jpg' },
  { name: 'Μπισκότο πρωτεΐνης', unit: 'g', cal: 386, protein: 29.1, carbs: 34.6, fat: 18.1, image_path: 'assets/food_images/mpiskot.jpg' },
  { name: 'Ξηροι καρποι', unit: 'g', cal: 567, protein: 21, carbs: 19, fat: 53, image_path: 'assets/food_images/kshroi.jpg' },
  { name: 'Μακαρόνια βρασμένα', unit: 'g', cal: 360, protein: 12, carbs: 74, fat: 1.5, image_path: 'assets/food_images/makaronia.jpg' }
];

const DEFAULT_USER = {
  slug: 'konstantinos',
  full_name: 'Κωνσταντίνος Τασιούλης',
  weight: 93,
  proteinMultiplier: 1.7,
  calorieTarget: 2500
};

const DEFAULT_MEALS = [
  { meal_key: 'breakfast', title: 'Πρωινό', description: 'Αυγό + ασπράδια + υδατάνθρακας', sort_order: 1 },
  { meal_key: 'lunch', title: 'Μεσημεριανό', description: 'Κυρίως πρωτεΐνη + carb', sort_order: 2 },
  { meal_key: 'snack', title: 'Σνακ', description: 'Γρήγορο', sort_order: 3 },
  { meal_key: 'dinner', title: 'Βραδινό', description: 'Εναλλαγή', sort_order: 4 }
];

const DEFAULT_MEAL_ITEMS = [
  { meal_key: 'breakfast', row_key: 'breakfast-eggs', food_name: 'Αυγά αχυρώνα ΜΑΡΑΤΑ μεσαία', qty: 1 },
  { meal_key: 'breakfast', row_key: 'breakfast-eggwhite', food_name: 'Ασπράδι αυγού ΒΛΑΧΑΚΗ', qty: 300 },
  { meal_key: 'breakfast', row_key: 'breakfast-toast', food_name: 'Ψωμί τοστ', qty: 4 },
  { meal_key: 'breakfast', row_key: 'breakfast-cottage', food_name: 'Cottage ADORO', qty: 150 },
  { meal_key: 'lunch', row_key: 'lunch-chicken', food_name: 'Στήθος κοτόπουλο ψητό', qty: 250 },
  { meal_key: 'lunch', row_key: 'lunch-rice', food_name: 'Ρύζι basmati βρασμένο', qty: 250 },
  { meal_key: 'lunch', row_key: 'lunch-oil', food_name: 'Ελαιόλαδο', qty: 10 },
  { meal_key: 'snack', row_key: 'snack-toast', food_name: 'Ψωμί τοστ', qty: 3 },
  { meal_key: 'dinner', row_key: 'dinner-pasta', food_name: 'Μακαρόνια βρασμένα', qty: 200 }
];

function normalizeUnit(raw) {
  const unit = String(raw || 'g').toLowerCase();
  if (unit === 'ml') return 'ml';
  if (unit.startsWith('τεμ')) return 'τεμ';
  return 'g';
}

function toFoodKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeImagePath(raw) {
  const fallback = 'assets/food_images/placeholder.svg';
  const clean = String(raw || '').replace(/\\/g, '/').trim();
  return clean || fallback;
}

function normalizeFood(input) {
  return {
    name: String(input.name || '').trim(),
    unit: normalizeUnit(input.unit),
    cal: Number(input.cal || 0),
    protein: Number(input.protein || 0),
    carbs: Number(input.carbs || 0),
    fat: Number(input.fat || 0),
    image_path: normalizeImagePath(input.image_path)
  };
}

async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      food_key TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'τεμ')),
      cal DOUBLE PRECISION NOT NULL CHECK (cal >= 0),
      protein DOUBLE PRECISION NOT NULL CHECK (protein >= 0),
      carbs DOUBLE PRECISION NOT NULL CHECK (carbs >= 0),
      fat DOUBLE PRECISION NOT NULL CHECK (fat >= 0),
      image_path TEXT NOT NULL DEFAULT 'assets/food_images/placeholder.svg',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_targets (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      calorie_target INTEGER NOT NULL,
      protein_multiplier DOUBLE PRECISION NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_meals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meal_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, meal_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_meal_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meal_id UUID NOT NULL REFERENCES user_meals(id) ON DELETE CASCADE,
      row_key TEXT NOT NULL,
      food_id UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
      qty DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(meal_id, row_key)
    );
  `);

  for (const entry of DEFAULT_FOOD_DB) {
    const food = normalizeFood(entry);
    const key = toFoodKey(food.name);
    await pool.query(
      `INSERT INTO foods (name, food_key, unit, cal, protein, carbs, fat, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (food_key)
       DO UPDATE SET
         name = EXCLUDED.name,
         unit = EXCLUDED.unit,
         cal = EXCLUDED.cal,
         protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs,
         fat = EXCLUDED.fat,
         image_path = EXCLUDED.image_path,
         updated_at = NOW()`,
      [food.name, key, food.unit, food.cal, food.protein, food.carbs, food.fat, food.image_path]
    );
  }

  const userResult = await pool.query(
    `INSERT INTO users (slug, full_name)
     VALUES ($1, $2)
     ON CONFLICT (slug)
     DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [DEFAULT_USER.slug, DEFAULT_USER.full_name]
  );
  const userId = userResult.rows[0].id;

  await pool.query(
    `INSERT INTO user_targets (user_id, calorie_target, protein_multiplier, weight)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id)
     DO UPDATE SET
       calorie_target = EXCLUDED.calorie_target,
       protein_multiplier = EXCLUDED.protein_multiplier,
       weight = EXCLUDED.weight,
       updated_at = NOW()`,
    [userId, DEFAULT_USER.calorieTarget, DEFAULT_USER.proteinMultiplier, DEFAULT_USER.weight]
  );

  for (const meal of DEFAULT_MEALS) {
    await pool.query(
      `INSERT INTO user_meals (user_id, meal_key, title, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, meal_key)
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order`,
      [userId, meal.meal_key, meal.title, meal.description, meal.sort_order]
    );
  }

  for (const item of DEFAULT_MEAL_ITEMS) {
    const mealRes = await pool.query('SELECT id FROM user_meals WHERE user_id = $1 AND meal_key = $2', [userId, item.meal_key]);
    const foodRes = await pool.query('SELECT id FROM foods WHERE food_key = $1', [toFoodKey(item.food_name)]);
    if (!mealRes.rows[0] || !foodRes.rows[0]) continue;

    await pool.query(
      `INSERT INTO user_meal_items (meal_id, row_key, food_id, qty)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meal_id, row_key)
       DO UPDATE SET
         food_id = EXCLUDED.food_id,
         qty = EXCLUDED.qty,
         updated_at = NOW()`,
      [mealRes.rows[0].id, item.row_key, foodRes.rows[0].id, item.qty]
    );
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'db_unavailable' });
  }
});

app.get('/api/foods', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, unit, cal, protein, carbs, fat, image_path FROM foods ORDER BY name ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'read_failed' });
  }
});

app.post('/api/foods', async (req, res) => {
  const food = normalizeFood(req.body || {});
  if (!food.name) {
    res.status(400).json({ error: 'name_required' });
    return;
  }

  try {
    const key = toFoodKey(food.name);
    const result = await pool.query(
      `INSERT INTO foods (name, food_key, unit, cal, protein, carbs, fat, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (food_key)
       DO UPDATE SET
         name = EXCLUDED.name,
         unit = EXCLUDED.unit,
         cal = EXCLUDED.cal,
         protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs,
         fat = EXCLUDED.fat,
         image_path = EXCLUDED.image_path,
         updated_at = NOW()
       RETURNING id, name, unit, cal, protein, carbs, fat, image_path`,
      [food.name, key, food.unit, food.cal, food.protein, food.carbs, food.fat, food.image_path]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'write_failed' });
  }
});

app.delete('/api/foods/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM foods WHERE id = $1', [req.params.id]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'delete_failed' });
  }
});

app.get('/api/food-images', (_req, res) => {
  try {
    const entries = fs.readdirSync(FOOD_IMAGES_DIR, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => `assets/food_images/${e.name}`).sort((a, b) => a.localeCompare(b));
    res.json(files);
  } catch {
    res.status(500).json({ error: 'images_read_failed' });
  }
});

app.get('/api/users/:slug/dashboard', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, slug, full_name FROM users WHERE slug = $1', [req.params.slug]);
    if (!userRes.rows[0]) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const user = userRes.rows[0];

    const targetRes = await pool.query(
      'SELECT calorie_target, protein_multiplier, weight FROM user_targets WHERE user_id = $1',
      [user.id]
    );

    const mealsRes = await pool.query(
      `SELECT m.meal_key, m.title, m.description, m.sort_order,
              i.row_key, i.qty,
              f.id AS food_id, f.name AS food_name, f.unit AS food_unit,
              f.cal AS food_cal, f.protein AS food_protein, f.carbs AS food_carbs, f.fat AS food_fat, f.image_path AS food_image_path
       FROM user_meals m
       LEFT JOIN user_meal_items i ON i.meal_id = m.id
       LEFT JOIN foods f ON f.id = i.food_id
       WHERE m.user_id = $1
       ORDER BY m.sort_order ASC, i.row_key ASC`,
      [user.id]
    );

    const mealsMap = new Map();
    mealsRes.rows.forEach(row => {
      if (!mealsMap.has(row.meal_key)) {
        mealsMap.set(row.meal_key, {
          mealKey: row.meal_key,
          title: row.title,
          description: row.description,
          sortOrder: row.sort_order,
          items: []
        });
      }
      if (row.food_id) {
        mealsMap.get(row.meal_key).items.push({
          rowKey: row.row_key,
          qty: Number(row.qty),
          food: {
            id: row.food_id,
            name: row.food_name,
            unit: row.food_unit,
            cal: Number(row.food_cal),
            protein: Number(row.food_protein),
            carbs: Number(row.food_carbs),
            fat: Number(row.food_fat),
            image_path: row.food_image_path
          }
        });
      }
    });

    const targets = targetRes.rows[0]
      ? {
          calorieTarget: Number(targetRes.rows[0].calorie_target),
          proteinMultiplier: Number(targetRes.rows[0].protein_multiplier),
          weight: Number(targetRes.rows[0].weight)
        }
      : null;

    res.json({ user, targets, meals: Array.from(mealsMap.values()) });
  } catch {
    res.status(500).json({ error: 'dashboard_read_failed' });
  }
});

app.put('/api/users/:slug/targets', async (req, res) => {
  const calorieTarget = Number(req.body?.calorieTarget || 0);
  const proteinMultiplier = Number(req.body?.proteinMultiplier || 0);
  const weight = Number(req.body?.weight || 0);

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE slug = $1', [req.params.slug]);
    if (!userRes.rows[0]) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    await pool.query(
      `INSERT INTO user_targets (user_id, calorie_target, protein_multiplier, weight)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         calorie_target = EXCLUDED.calorie_target,
         protein_multiplier = EXCLUDED.protein_multiplier,
         weight = EXCLUDED.weight,
         updated_at = NOW()`,
      [userRes.rows[0].id, calorieTarget, proteinMultiplier, weight]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'targets_write_failed' });
  }
});

app.post('/api/users/:slug/meal-items', async (req, res) => {
  const mealKey = String(req.body?.mealKey || '').trim();
  const rowKey = String(req.body?.rowKey || '').trim();
  const foodId = String(req.body?.foodId || '').trim();
  const qty = Number(req.body?.qty || 0);
  const mealTitle = String(req.body?.mealTitle || mealKey || 'Νέο γεύμα').trim();

  if (!mealKey || !rowKey || !foodId) {
    res.status(400).json({ error: 'mealKey_rowKey_foodId_required' });
    return;
  }

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE slug = $1', [req.params.slug]);
    if (!userRes.rows[0]) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const userId = userRes.rows[0].id;

    const mealRes = await pool.query(
      `INSERT INTO user_meals (user_id, meal_key, title, description, sort_order)
       VALUES ($1, $2, $3, '', 999)
       ON CONFLICT (user_id, meal_key)
       DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [userId, mealKey, mealTitle]
    );

    await pool.query(
      `INSERT INTO user_meal_items (meal_id, row_key, food_id, qty)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meal_id, row_key)
       DO UPDATE SET food_id = EXCLUDED.food_id, qty = EXCLUDED.qty, updated_at = NOW()`,
      [mealRes.rows[0].id, rowKey, foodId, qty]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'meal_item_write_failed' });
  }
});

async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Diet site backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
