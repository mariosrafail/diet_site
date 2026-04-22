const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in environment.');
}
const BOOTSTRAP_DEFAULT_DATA = String(process.env.BOOTSTRAP_DEFAULT_DATA || '').toLowerCase() === 'true';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const FOOD_CATEGORY_VALUES = ['vegetables', 'fruit', 'protein', 'carb', 'fat', 'water'];
const IMAGE_MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.gif': 'image/gif'
};
const FRUIT_KEYWORDS = [
  'Î¼Î·Î»Î¿', 'Î¼Î®Î»Î¿', 'apple',
  'Î¼Ï€Î±Î½Î±Î½Î±', 'Î¼Ï€Î±Î½Î¬Î½Î±', 'banana',
  'Ï€Î¿ÏÏ„Î¿ÎºÎ±Î»Î¹', 'Ï€Î¿ÏÏ„Î¿ÎºÎ¬Î»Î¹', 'orange',
  'Î¼Î±Î½Ï„Î±ÏÎ¹Î½Î¹', 'Î¼Î±Î½Ï„Î±ÏÎ¯Î½Î¹', 'mandarin',
  'Î±Ï‡Î»Î±Î´Î¹', 'Î±Ï‡Î»Î¬Î´Î¹', 'pear',
  'ÏÎ¿Î´Î±ÎºÎ¹Î½Î¿', 'ÏÎ¿Î´Î¬ÎºÎ¹Î½Î¿', 'peach',
  'Î½ÎµÎºÏ„Î±ÏÎ¹Î½Î¹', 'Î½ÎµÎºÏ„Î±ÏÎ¯Î½Î¹', 'nectarine',
  'Î²ÎµÏÎ¹ÎºÎ¿ÎºÎ¿', 'Î²ÎµÏÎ¯ÎºÎ¿ÎºÎ¿', 'apricot',
  'ÎºÎµÏÎ±ÏƒÎ¹', 'ÎºÎµÏÎ¬ÏƒÎ¹', 'cherry',
  'ÏƒÏ„Î±Ï†Ï…Î»Î¹', 'ÏƒÏ„Î±Ï†ÏÎ»Î¹', 'grape',
  'Î±ÎºÏ„Î¹Î½Î¹Î´Î¹Î¿', 'Î±ÎºÏ„Î¹Î½Î¯Î´Î¹Î¿', 'kiwi',
  'Ï†ÏÎ±Î¿Ï…Î»Î±', 'Ï†ÏÎ¬Î¿Ï…Î»Î±', 'strawberry',
  'Î²Î±Ï„Î¿Î¼Î¿Ï…Ï', 'raspberry',
  'blueberry', 'cranberry',
  'ÎºÎ±ÏÏ€Î¿Ï…Î¶Î¹', 'ÎºÎ±ÏÏ€Î¿ÏÎ¶Î¹', 'watermelon',
  'Ï€ÎµÏ€Î¿Î½Î¹', 'Ï€ÎµÏ€ÏŒÎ½Î¹', 'melon',
  'Î±Î½Î±Î½Î±Ï‚', 'Î±Î½Î±Î½Î¬Ï‚', 'pineapple',
  'mango', 'Î¼Î±Î½Î³ÎºÎ¿', 'Î¼Î¬Î½Î³ÎºÎ¿',
  'papaya', 'Ï€Î±Ï€Î±Î³Î¹Î±', 'Ï€Î±Ï€Î¬Î³Î¹Î±',
  'ÏÎ¿Î´Î¹', 'ÏÏŒÎ´Î¹', 'pomegranate',
  'Î´Î±Î¼Î±ÏƒÎºÎ·Î½Î¿', 'Î´Î±Î¼Î¬ÏƒÎºÎ·Î½Î¿', 'plum',
  'ÏƒÏ…ÎºÎ¿', 'ÏƒÏÎºÎ¿', 'fig',
  'Ï‡Î¿Ï…ÏÎ¼Î±', 'Ï‡Î¿Ï…ÏÎ¼Î¬', 'date',
  'Î»ÎµÎ¼Î¿Î½Î¹', 'Î»ÎµÎ¼ÏŒÎ½Î¹', 'lemon',
  'lime', 'limes',
  'Î³ÎºÏÎµÎ¹Ï€Ï†ÏÎ¿Ï…Ï„', 'grapefruit'
];
const WATER_KEYWORDS = ['Î½ÎµÏÎ¿', 'Î½ÎµÏÏŒ', 'water'];

const DEFAULT_FOOD_DB = [
  { name: 'Î‘Ï…Î³Î¬ Î±Ï‡Ï…ÏÏŽÎ½Î± ÎœÎ‘Î¡Î‘Î¤Î‘ Î¼ÎµÏƒÎ±Î¯Î±', unit: 'Ï„ÎµÎ¼', cal: 82.5, protein: 7.2, carbs: 0.6, fat: 6.1, image_path: 'assets/food_images/auga.jpg' },
  { name: 'Î‘ÏƒÏ€ÏÎ¬Î´Î¹ Î±Ï…Î³Î¿Ï Î’Î›Î‘Î§Î‘ÎšÎ—', unit: 'ml', cal: 50, protein: 10, carbs: 1.1, fat: 0.5, image_path: 'assets/food_images/aspradi.jpg' },
  { name: 'Î¨Ï‰Î¼Î¯ Ï„Î¿ÏƒÏ„', unit: 'Ï„ÎµÎ¼', cal: 66.4, protein: 2.7, carbs: 10.8, fat: 1, image_path: 'assets/food_images/psomi.jpg' },
  { name: 'Cottage ADORO', unit: 'g', cal: 83, protein: 12.7, carbs: 3.1, fat: 2.2, image_path: 'assets/food_images/cottage.jpg' },
  { name: 'ÎšÎ±Ï„Î¯ÎºÎ¹ Î”Î¿Î¼Î¿ÎºÎ¿Ï Î—Î Î•Î™Î¡ÎŸÎ£', unit: 'g', cal: 169, protein: 10, carbs: 3, fat: 13, image_path: 'assets/food_images/katiki.jpg' },
  { name: 'Î£Ï„Î®Î¸Î¿Ï‚ ÎºÎ¿Ï„ÏŒÏ€Î¿Ï…Î»Î¿ ÏˆÎ·Ï„ÏŒ', unit: 'g', cal: 165, protein: 31, carbs: 0, fat: 3.6, image_path: 'assets/food_images/placeholder.svg' },
  { name: 'Î¡ÏÎ¶Î¹ basmati Î²ÏÎ±ÏƒÎ¼Î­Î½Î¿', unit: 'g', cal: 351, protein: 7.5, carbs: 76, fat: 1.3, image_path: 'assets/food_images/basmati.jpg' },
  { name: 'Î•Î»Î±Î¹ÏŒÎ»Î±Î´Î¿', unit: 'g', cal: 884, protein: 0, carbs: 0, fat: 100, image_path: 'assets/food_images/ladi.jpg' },
  { name: 'Î¤ÏÎ¹ÎºÎ±Î»Î¹Î½ÏŒ ÎµÎ»Î±Ï†ÏÏ', unit: 'g', cal: 234, protein: 36, carbs: 0, fat: 10, image_path: 'assets/food_images/trikalino.jpg' },
  { name: 'ÎÎ™ÎšÎ‘Î£ ÎœÏ€ÏÎ¹Î¶ÏŒÎ»Î± ÏƒÎµ Ï†Î­Ï„ÎµÏ‚', unit: 'g', cal: 111, protein: 18.2, carbs: 3.1, fat: 2.9, image_path: 'assets/food_images/mprizola.jpeg' },
  { name: 'AGRINO Î¡Ï…Î¶Î¿Î³ÎºÎ¿Ï†ÏÎ­Ï„ÎµÏ‚ Î¼Îµ ÏÎ¯Î³Î±Î½Î·', unit: 'Ï„ÎµÎ¼', cal: 29, protein: 0.64, carbs: 5.3, fat: 0.5, image_path: 'assets/food_images/ruzogkofretes.jpg' },
  { name: 'ÎœÏ€Î¹ÏƒÎºÏŒÏ„Î¿ Ï€ÏÏ‰Ï„ÎµÎÎ½Î·Ï‚', unit: 'g', cal: 386, protein: 29.1, carbs: 34.6, fat: 18.1, image_path: 'assets/food_images/mpiskot.jpg' },
  { name: 'ÎžÎ·ÏÎ¿Î¹ ÎºÎ±ÏÏ€Î¿Î¹', unit: 'g', cal: 567, protein: 21, carbs: 19, fat: 53, image_path: 'assets/food_images/kshroi.jpg' },
  { name: 'ÎœÎ±ÎºÎ±ÏÏŒÎ½Î¹Î± Î²ÏÎ±ÏƒÎ¼Î­Î½Î±', unit: 'g', cal: 360, protein: 12, carbs: 74, fat: 1.5, image_path: 'assets/food_images/makaronia.jpg' }
];

const DEFAULT_USER_PROFILES = [
  {
    user: {
      slug: 'konstantinos',
      full_name: 'Konstantinos',
      weight: 93,
      proteinMultiplier: 1.7,
      calorieTarget: 2500
    },
    meals: [
      { meal_key: 'breakfast', title: 'Πρωινό', description: 'Αυγό + ασπράδια + υδατάνθρακας', sort_order: 1 },
      { meal_key: 'lunch', title: 'Μεσημεριανό', description: 'Πρωτεΐνη + υδατάνθρακας + λίπος', sort_order: 2 },
      { meal_key: 'snack', title: 'Σνακ', description: 'Γρήγορο ενδιάμεσο', sort_order: 3 },
      { meal_key: 'dinner', title: 'Βραδινό', description: 'Εναλλαγή πρωτεΐνης + carb', sort_order: 4 }
    ],
    items: [
      { meal_key: 'breakfast', row_key: 'breakfast-eggs', food_name: 'Î‘Ï…Î³Î¬ Î±Ï‡Ï…ÏÏŽÎ½Î± ÎœÎ‘Î¡Î‘Î¤Î‘ Î¼ÎµÏƒÎ±Î¯Î±', qty: 1 },
      { meal_key: 'breakfast', row_key: 'breakfast-eggwhite', food_name: 'Î‘ÏƒÏ€ÏÎ¬Î´Î¹ Î±Ï…Î³Î¿Ï Î’Î›Î‘Î§Î‘ÎšÎ—', qty: 300 },
      { meal_key: 'breakfast', row_key: 'breakfast-toast', food_name: 'Î¨Ï‰Î¼Î¯ Ï„Î¿ÏƒÏ„', qty: 4 },
      { meal_key: 'breakfast', row_key: 'breakfast-cottage', food_name: 'Cottage ADORO', qty: 150 },
      { meal_key: 'lunch', row_key: 'lunch-chicken', food_name: 'Î£Ï„Î®Î¸Î¿Ï‚ ÎºÎ¿Ï„ÏŒÏ€Î¿Ï…Î»Î¿ ÏˆÎ·Ï„ÏŒ', qty: 250 },
      { meal_key: 'lunch', row_key: 'lunch-rice', food_name: 'Î¡ÏÎ¶Î¹ basmati Î²ÏÎ±ÏƒÎ¼Î­Î½Î¿', qty: 250 },
      { meal_key: 'lunch', row_key: 'lunch-oil', food_name: 'Î•Î»Î±Î¹ÏŒÎ»Î±Î´Î¿', qty: 10 },
      { meal_key: 'snack', row_key: 'snack-toast', food_name: 'Î¨Ï‰Î¼Î¯ Ï„Î¿ÏƒÏ„', qty: 3 },
      { meal_key: 'dinner', row_key: 'dinner-pasta', food_name: 'ÎœÎ±ÎºÎ±ÏÏŒÎ½Î¹Î± Î²ÏÎ±ÏƒÎ¼Î­Î½Î±', qty: 200 }
    ]
  },
  {
    user: {
      slug: 'marios',
      full_name: 'Marios',
      weight: 85,
      proteinMultiplier: 1.8,
      calorieTarget: 2350
    },
    meals: [
      { meal_key: 'breakfast', title: 'Πρωινό', description: 'Πρωτεΐνη + φρούτο', sort_order: 1 },
      { meal_key: 'lunch', title: 'Μεσημεριανό', description: 'Κύριο γεύμα', sort_order: 2 },
      { meal_key: 'snack', title: 'Σνακ', description: 'Ελαφρύ ενδιάμεσο', sort_order: 3 },
      { meal_key: 'dinner', title: 'Βραδινό', description: 'Πρωτεΐνη + carbs', sort_order: 4 }
    ],
    items: [
      { meal_key: 'breakfast', row_key: 'breakfast-eggwhite', food_name: 'Î‘ÏƒÏ€ÏÎ¬Î´Î¹ Î±Ï…Î³Î¿Ï Î’Î›Î‘Î§Î‘ÎšÎ—', qty: 260 },
      { meal_key: 'breakfast', row_key: 'breakfast-cottage', food_name: 'Cottage ADORO', qty: 180 },
      { meal_key: 'lunch', row_key: 'lunch-chicken', food_name: 'Î£Ï„Î®Î¸Î¿Ï‚ ÎºÎ¿Ï„ÏŒÏ€Î¿Ï…Î»Î¿ ÏˆÎ·Ï„ÏŒ', qty: 220 },
      { meal_key: 'lunch', row_key: 'lunch-rice', food_name: 'Î¡ÏÎ¶Î¹ basmati Î²ÏÎ±ÏƒÎ¼Î­Î½Î¿', qty: 280 },
      { meal_key: 'lunch', row_key: 'lunch-oil', food_name: 'Î•Î»Î±Î¹ÏŒÎ»Î±Î´Î¿', qty: 8 },
      { meal_key: 'snack', row_key: 'snack-rice-cakes', food_name: 'AGRINO Î¡Ï…Î¶Î¿Î³ÎºÎ¿Ï†ÏÎ­Ï„ÎµÏ‚ Î¼Îµ ÏÎ¯Î³Î±Î½Î·', qty: 4 },
      { meal_key: 'snack', row_key: 'snack-nuts', food_name: 'ÎžÎ·ÏÎ¿Î¹ ÎºÎ±ÏÏ€Î¿Î¹', qty: 20 },
      { meal_key: 'dinner', row_key: 'dinner-mince', food_name: 'ÎÎ™ÎšÎ‘Î£ ÎœÏ€ÏÎ¹Î¶ÏŒÎ»Î± ÏƒÎµ Ï†Î­Ï„ÎµÏ‚', qty: 220 },
      { meal_key: 'dinner', row_key: 'dinner-pasta', food_name: 'ÎœÎ±ÎºÎ±ÏÏŒÎ½Î¹Î± Î²ÏÎ±ÏƒÎ¼Î­Î½Î±', qty: 180 }
    ]
  }
];

function normalizeUnit(raw) {
  const unit = String(raw || 'g').toLowerCase();
  if (unit === 'ml') return 'ml';
  if (unit.startsWith('Ï„ÎµÎ¼')) return 'Ï„ÎµÎ¼';
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

function inferCategoryFromImagePath(imagePath) {
  const pathValue = normalizeImagePath(imagePath);
  if (['assets/food_images/psomi.jpg', 'assets/food_images/basmati.jpg', 'assets/food_images/ruzogkofretes.jpg', 'assets/food_images/makaronia.jpg'].includes(pathValue)) return 'carb';
  if (['assets/food_images/ladi.jpg', 'assets/food_images/kshroi.jpg'].includes(pathValue)) return 'fat';
  return 'protein';
}

function normalizeFoodCategory(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (FOOD_CATEGORY_VALUES.includes(value)) return value;

  if (value === 'vegetable' || value === 'vegetables' || value === 'veg' || value === 'Î»Î±Ï‡Î±Î½Î¹ÎºÎ±' || value === 'Î»Î±Ï‡Î±Î½Î¹ÎºÎ¬') return 'vegetables';
  if (value === 'fruit' || value === 'fruits' || value === 'fruit_carb' || value === 'frouta' || value === 'Ï†ÏÎ¿Ï…Ï„Î±' || value === 'Ï†ÏÎ¿ÏÏ„Î±') return 'fruit';
  if (value === 'protein' || value === 'proteins' || value === 'Ï€ÏÏ‰Ï„ÎµÎ¹Î½Î·' || value === 'Ï€ÏÏ‰Ï„ÎµÎÎ½Î·') return 'protein';
  if (value === 'carb' || value === 'carbs' || value === 'carbohydrate' || value === 'Ï…Î´Î±Ï„Î±Î½Î¸ÏÎ±ÎºÎ±Ï‚' || value === 'Ï…Î´Î±Ï„Î±Î½Î¸ÏÎ¬ÎºÎ±Ï‚' || value === 'Ï…Î´Î±Ï„Î±Î½Î¸ÏÎ±ÎºÎµÏ‚' || value === 'Ï…Î´Î±Ï„Î¬Î½Î¸ÏÎ±ÎºÎµÏ‚') return 'carb';
  if (value === 'fat' || value === 'fats' || value === 'Î»Î¹Ï€Î±ÏÎ±' || value === 'Î»Î¹Ï€Î±ÏÎ¬') return 'fat';
  if (value === 'water' || value === 'Î½ÎµÏÎ¿' || value === 'Î½ÎµÏÏŒ') return 'water';

  return 'protein';
}

function normalizeFood(input) {
  const imagePath = normalizeImagePath(input.image_path);
  return {
    name: String(input.name || '').trim(),
    category: normalizeFoodCategory(input.category || inferCategoryFromImagePath(imagePath)),
    unit: normalizeUnit(input.unit),
    cal: Number(input.cal || 0),
    protein: Number(input.protein || 0),
    carbs: Number(input.carbs || 0),
    fat: Number(input.fat || 0),
    image_path: imagePath
  };
}

function normalizeUploadBaseName(raw) {
  const base = String(raw || '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'food-image';
}

function getImageMimeType(ext) {
  return IMAGE_MIME_BY_EXT[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function toBinaryBuffer(raw) {
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') {
    if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
    return Buffer.from(raw, 'binary');
  }
  if (raw == null) return Buffer.alloc(0);
  return Buffer.from(raw);
}

function getUploadTargetDirCandidates() {
  return [
    path.join(process.cwd(), 'assets', 'food_images'),
    path.join(__dirname, 'assets', 'food_images')
  ];
}

async function resolveWritableFoodImagesDir() {
  const candidates = getUploadTargetDirCandidates();
  for (const dirPath of candidates) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.access(dirPath);
      return dirPath;
    } catch {
      // Try next candidate path.
    }
  }
  throw new Error('food_images_dir_unavailable');
}


async function listFoodImageFiles() {
  const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.avif', '.gif']);
  const candidates = getUploadTargetDirCandidates();

  for (const dirPath of candidates) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => allowedExt.has(path.extname(name).toLowerCase()))
        .map(name => `assets/food_images/${name}`);
    } catch {
      // Try next candidate path.
    }
  }

  return [];
}

let schemaReadyPromise = null;
async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS foods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          food_key TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL DEFAULT 'protein' CHECK (category IN ('vegetables', 'fruit', 'protein', 'carb', 'fat', 'water')),
          unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'Ï„ÎµÎ¼')),
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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS uploaded_images (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          content BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query('ALTER TABLE foods ADD COLUMN IF NOT EXISTS category TEXT');
      await pool.query(
        `UPDATE foods
         SET category = 'protein'
         WHERE category IS NULL OR BTRIM(category) = ''`
      );
      await pool.query(`ALTER TABLE foods ALTER COLUMN category SET DEFAULT 'protein'`);
      await pool.query(`ALTER TABLE foods ALTER COLUMN category SET NOT NULL`);
      await pool.query(`
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'foods'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) ILIKE '%category%'
          LOOP
            EXECUTE format('ALTER TABLE foods DROP CONSTRAINT IF EXISTS %I', r.conname);
          END LOOP;
        END $$;
      `);
      await pool.query(`
        ALTER TABLE foods
        ADD CONSTRAINT foods_category_check
        CHECK (category IN ('vegetables', 'fruit', 'protein', 'carb', 'fat', 'water'))
      `);
      await pool.query(
        `UPDATE foods
         SET category = CASE
           WHEN image_path IN ('assets/food_images/psomi.jpg', 'assets/food_images/basmati.jpg', 'assets/food_images/ruzogkofretes.jpg', 'assets/food_images/makaronia.jpg') THEN 'carb'
           WHEN image_path IN ('assets/food_images/ladi.jpg', 'assets/food_images/kshroi.jpg') THEN 'fat'
           ELSE category
         END
         WHERE image_path IN (
           'assets/food_images/psomi.jpg',
           'assets/food_images/basmati.jpg',
           'assets/food_images/ruzogkofretes.jpg',
           'assets/food_images/makaronia.jpg',
           'assets/food_images/ladi.jpg',
           'assets/food_images/kshroi.jpg'
         )`
      );
      await pool.query(
        `UPDATE foods
         SET category = 'fruit'
         WHERE category <> 'fruit'
           AND EXISTS (
             SELECT 1
             FROM unnest($1::text[]) AS kw
             WHERE LOWER(name) LIKE '%' || kw || '%'
           )`,
        [FRUIT_KEYWORDS.map(keyword => String(keyword).toLowerCase())]
      );
      await pool.query(
        `UPDATE foods
         SET category = 'water'
         WHERE category <> 'water'
           AND EXISTS (
             SELECT 1
             FROM unnest($1::text[]) AS kw
             WHERE LOWER(name) = kw
                OR LOWER(name) LIKE kw || ' %'
                OR LOWER(name) LIKE '% ' || kw
                OR LOWER(name) LIKE '% ' || kw || ' %'
           )`,
        [WATER_KEYWORDS.map(keyword => String(keyword).toLowerCase())]
      );

      if (BOOTSTRAP_DEFAULT_DATA) {
        const foodsCountRes = await pool.query('SELECT COUNT(*)::int AS count FROM foods');
        const shouldSeedFoods = Number(foodsCountRes.rows[0]?.count || 0) === 0;

        if (shouldSeedFoods) {
          for (const entry of DEFAULT_FOOD_DB) {
            const food = normalizeFood(entry);
            const key = toFoodKey(food.name);
            await pool.query(
              `INSERT INTO foods (name, food_key, category, unit, cal, protein, carbs, fat, image_path)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (food_key)
               DO NOTHING`,
              [food.name, key, food.category, food.unit, food.cal, food.protein, food.carbs, food.fat, food.image_path]
            );
          }
        }

        for (const profile of DEFAULT_USER_PROFILES) {
          const baseUser = profile?.user || {};
          const meals = Array.isArray(profile?.meals) ? profile.meals : [];
          const items = Array.isArray(profile?.items) ? profile.items : [];

          const userResult = await pool.query(
            `INSERT INTO users (slug, full_name)
             VALUES ($1, $2)
             ON CONFLICT (slug)
             DO NOTHING
             RETURNING id`,
            [baseUser.slug, baseUser.full_name]
          );
          const isNewUser = userResult.rowCount > 0;
          const userId = userResult.rows[0]?.id
            || (await pool.query('SELECT id FROM users WHERE slug = $1', [baseUser.slug])).rows[0]?.id;
          if (!userId) throw new Error(`failed_to_resolve_default_user_${baseUser.slug}`);

          if (!isNewUser) continue;

          await pool.query(
            `INSERT INTO user_targets (user_id, calorie_target, protein_multiplier, weight)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id)
             DO NOTHING`,
            [userId, baseUser.calorieTarget, baseUser.proteinMultiplier, baseUser.weight]
          );

          for (const meal of meals) {
            await pool.query(
              `INSERT INTO user_meals (user_id, meal_key, title, description, sort_order)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (user_id, meal_key)
               DO NOTHING`,
              [userId, meal.meal_key, meal.title, meal.description, meal.sort_order]
            );
          }

          for (const item of items) {
            const mealRes = await pool.query('SELECT id FROM user_meals WHERE user_id = $1 AND meal_key = $2', [userId, item.meal_key]);
            const foodRes = await pool.query('SELECT id FROM foods WHERE food_key = $1', [toFoodKey(item.food_name)]);
            if (!mealRes.rows[0] || !foodRes.rows[0]) continue;

            await pool.query(
              `INSERT INTO user_meal_items (meal_id, row_key, food_id, qty)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (meal_id, row_key)
               DO NOTHING`,
              [mealRes.rows[0].id, item.row_key, foodRes.rows[0].id, item.qty]
            );
          }
        }

        // One-time compatibility fix: migrate olive oil image from placeholder to ladi.jpg.
        await pool.query(
          `UPDATE foods
           SET image_path = $1, updated_at = NOW()
           WHERE image_path = $2 AND cal = $3 AND protein = 0 AND carbs = 0 AND fat = 100`,
          ['assets/food_images/ladi.jpg', 'assets/food_images/placeholder.svg', 884]
        );
      }
    })();
  }

  return schemaReadyPromise;
}

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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
    const result = await pool.query('SELECT id, name, category, unit, cal, protein, carbs, fat, image_path FROM foods ORDER BY category ASC, name ASC');
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
      `INSERT INTO foods (name, food_key, category, unit, cal, protein, carbs, fat, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (food_key)
       DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         unit = EXCLUDED.unit,
         cal = EXCLUDED.cal,
         protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs,
         fat = EXCLUDED.fat,
         image_path = EXCLUDED.image_path,
         updated_at = NOW()
       RETURNING id, name, category, unit, cal, protein, carbs, fat, image_path`,
      [food.name, key, food.category, food.unit, food.cal, food.protein, food.carbs, food.fat, food.image_path]
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

app.get('/api/food-images', async (_req, res) => {
  try {
    const [dbResult, localFiles] = await Promise.all([
      pool.query('SELECT DISTINCT image_path FROM foods WHERE image_path IS NOT NULL AND image_path <> \'\' ORDER BY image_path ASC'),
      listFoodImageFiles()
    ]);

    const merged = new Set([
      ...dbResult.rows.map(row => String(row.image_path || '').trim()).filter(Boolean),
      ...localFiles
    ]);

    res.json(Array.from(merged).sort((a, b) => a.localeCompare(b, 'el')));
  } catch {
    res.status(500).json({ error: 'images_read_failed' });
  }
});

app.get('/api/food-images/file/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT mime_type, content FROM uploaded_images WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'image_not_found' });
      return;
    }

    const content = toBinaryBuffer(row.content);
    if (!content.length) {
      res.status(404).json({ error: 'image_empty' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(String(row.mime_type || 'application/octet-stream'));
    res.set('Content-Length', String(content.length));
    res.send(content);
  } catch {
    res.status(500).json({ error: 'image_read_failed' });
  }
});

app.post('/api/food-images/upload', async (req, res) => {
  const rawName = String(req.body?.fileName || '').trim();
  const contentBase64 = String(req.body?.contentBase64 || '').trim();
  const ext = path.extname(rawName).toLowerCase();
  const allowedExt = new Set(Object.keys(IMAGE_MIME_BY_EXT));

  if (!rawName || !contentBase64) {
    res.status(400).json({ error: 'fileName_contentBase64_required' });
    return;
  }
  if (!allowedExt.has(ext)) {
    res.status(400).json({ error: 'invalid_file_type' });
    return;
  }

  try {
    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) {
      res.status(400).json({ error: 'empty_file' });
      return;
    }
    if (buffer.length > 8 * 1024 * 1024) {
      res.status(413).json({ error: 'file_too_large' });
      return;
    }

    const base = normalizeUploadBaseName(rawName);
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const fileName = `${base}-${uniqueSuffix}${ext}`;
    const mimeType = getImageMimeType(ext);

    // Prefer local file save in dev/local. In serverless read-only env, fallback to DB.
    try {
      const dirPath = await resolveWritableFoodImagesDir();
      const absolutePath = path.join(dirPath, fileName);
      await fs.writeFile(absolutePath, buffer);
      res.json({ path: `assets/food_images/${fileName}` });
      return;
    } catch {
      const dbInsert = await pool.query(
        `INSERT INTO uploaded_images (file_name, mime_type, content)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [fileName, mimeType, buffer]
      );
      const imageId = dbInsert.rows[0]?.id;
      if (!imageId) throw new Error('image_insert_failed');
      res.json({ path: `/api/food-images/file/${imageId}` });
    }
  } catch {
    res.status(500).json({ error: 'upload_failed' });
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
              f.id AS food_id, f.name AS food_name, f.category AS food_category, f.unit AS food_unit,
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
            category: row.food_category,
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
  const mealTitle = String(req.body?.mealTitle || mealKey || 'ÎÎ­Î¿ Î³ÎµÏÎ¼Î±').trim();

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

app.put('/api/users/:slug/dashboard', async (req, res) => {
  const meals = Array.isArray(req.body?.meals) ? req.body.meals : null;
  if (!meals) {
    res.status(400).json({ error: 'meals_required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id FROM users WHERE slug = $1', [req.params.slug]);
    if (!userRes.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const userId = userRes.rows[0].id;

    await client.query(
      `DELETE FROM user_meal_items i
       USING user_meals m
       WHERE i.meal_id = m.id AND m.user_id = $1`,
      [userId]
    );
    await client.query('DELETE FROM user_meals WHERE user_id = $1', [userId]);

    for (let idx = 0; idx < meals.length; idx += 1) {
      const meal = meals[idx] || {};
      const mealKey = String(meal.mealKey || '').trim();
      if (!mealKey) continue;

      const title = String(meal.title || mealKey).trim() || mealKey;
      const description = String(meal.description || '').trim();
      const sortOrder = Number.isFinite(Number(meal.sortOrder)) ? Number(meal.sortOrder) : idx + 1;

      const mealIns = await client.query(
        `INSERT INTO user_meals (user_id, meal_key, title, description, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, mealKey, title, description, sortOrder]
      );
      const mealId = mealIns.rows[0].id;

      const items = Array.isArray(meal.items) ? meal.items : [];
      for (const item of items) {
        const rowKey = String(item?.rowKey || '').trim();
        const foodId = String(item?.foodId || '').trim();
        const qty = Number(item?.qty || 0);
        if (!rowKey || !foodId || !Number.isFinite(qty)) continue;

        await client.query(
          `INSERT INTO user_meal_items (meal_id, row_key, food_id, qty)
           VALUES ($1, $2, $3, $4)`,
          [mealId, rowKey, foodId, qty]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'dashboard_write_failed' });
  } finally {
    client.release();
  }
});

module.exports = {
  app,
  ensureSchema
};


