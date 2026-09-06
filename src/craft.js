import { inventory, addToInventory, removeFromInventory } from './inventory.js';
import { isNearCraftingTable } from './actions.js';
import { camera } from './world.js';
import { EYE_HEIGHT } from './collision.js';

// ---------- RESEPTLƏR ----------
// requiresTable: false  -> əl ilə, masa lazım deyil (2x2)
// requiresTable: true   -> yalnız yerləşdirilmiş masa yaxınlığında (3x3)
export const RECIPES = [
  // --- Sadə (masasız) ---
  {
    id: 'planks',
    name: 'Taxta lövhə',
    icon: '🪵',
    category: 'building',
    requiresTable: false,
    inputs: { wood: 1 },
    output: { item: 'planks', count: 4 },
    desc: 'Əsas tikinti materialı.',
  },
  {
    id: 'stick',
    name: 'Çubuq',
    icon: '🥢',
    category: 'building',
    requiresTable: false,
    inputs: { planks: 2 },
    output: { item: 'stick', count: 4 },
    desc: 'Alət və silah üçün lazımdır.',
  },
  {
    id: 'crafting_table',
    name: 'Əşya yapma masası',
    icon: '🛠️',
    category: 'building',
    requiresTable: false,
    inputs: { planks: 4 },
    output: { item: 'crafting_table', count: 1 },
    desc: 'Yerə qoy — inkişaf etmiş reseptlərə çıxış qazanırsan.',
  },

  // --- Yemək (masa ilə) ---
  {
    id: 'cooked_meat',
    name: 'Bişmiş ət',
    icon: '🍖',
    category: 'food',
    requiresTable: true,
    inputs: { meat: 2 },
    output: { item: 'cooked_meat', count: 1 },
    desc: 'Aclığı yaxşı doyurur.',
  },
  {
    id: 'bread',
    name: 'Çörək',
    icon: '🍞',
    category: 'food',
    requiresTable: true,
    inputs: { wheat: 3 },
    output: { item: 'bread', count: 1 },
    desc: 'Sürətli və ucuz qida.',
  },
  {
    id: 'stew',
    name: 'Sıyıq',
    icon: '🍲',
    category: 'food',
    requiresTable: true,
    inputs: { meat: 1, carrot: 1, potato: 1 },
    output: { item: 'stew', count: 1 },
    desc: 'Uzun müddət doyur.',
  },

  // --- Alətlər (masa ilə) ---
  {
    id: 'wood_pickaxe',
    name: 'Taxta külüng',
    icon: '⛏️',
    category: 'tools',
    requiresTable: true,
    inputs: { wood: 3, stick: 2 },
    output: { item: 'wood_pickaxe', count: 1 },
    desc: 'Daşı və filizi çıxarmaq üçün ilkin alət.',
  },
  {
    id: 'stone_pickaxe',
    name: 'Daş külüng',
    icon: '🪨',
    category: 'tools',
    requiresTable: true,
    inputs: { stone: 3, stick: 2 },
    output: { item: 'stone_pickaxe', count: 1 },
    desc: 'Taxta külüngdən daha davamlıdır.',
  },
  {
    id: 'axe',
    name: 'Balta',
    icon: '🪓',
    category: 'tools',
    requiresTable: true,
    inputs: { wood: 3, stick: 2 },
    output: { item: 'axe', count: 1 },
    desc: 'Ağacları daha sürətli kəsir.',
  },
  {
    id: 'sword',
    name: 'Qılınc',
    icon: '🗡️',
    category: 'tools',
    requiresTable: true,
    inputs: { stone: 2, stick: 1 },
    output: { item: 'sword', count: 1 },
    desc: 'Canlılara qarşı əsas silah.',
  },
  {
    id: 'hoe',
    name: 'Bel',
    icon: '🌾',
    category: 'tools',
    requiresTable: true,
    inputs: { wood: 2, stick: 2 },
    output: { item: 'hoe', count: 1 },
    desc: 'Torpağı əkin üçün hazırlayır.',
  },

  // --- Tikinti (masa ilə) ---
  {
    id: 'door',
    name: 'Qapı',
    icon: '🚪',
    category: 'building',
    requiresTable: true,
    inputs: { planks: 6 },
    output: { item: 'door', count: 1 },
    desc: 'Evinizi bağlayın.',
  },
  {
    id: 'torch',
    name: 'Məşəl',
    icon: '🔥',
    category: 'building',
    requiresTable: true,
    inputs: { stick: 1, coal: 1 },
    output: { item: 'torch', count: 4 },
    desc: 'İşıqlandırma üçün.',
  },
  {
    id: 'bed',
    name: 'Yataq',
    icon: '🛏️',
    category: 'building',
    requiresTable: true,
    inputs: { wool: 3, leather: 2 },
    output: { item: 'bed', count: 1 },
    desc: 'Dünyaya qoyula bilər, gecəni keçirmək üçün.',
  },

  // --- Geyim (masa ilə) ---
  {
    id: 'leather_boots',
    name: 'Dəri çəkmə',
    icon: '👢',
    category: 'armor',
    requiresTable: true,
    inputs: { leather: 4 },
    output: { item: 'leather_boots', count: 1 },
    desc: 'Ayaqları qoruyur.',
  },
  {
    id: 'wool_hat',
    name: 'Yun papaq',
    icon: '🧢',
    category: 'armor',
    requiresTable: true,
    inputs: { wool: 3 },
    output: { item: 'wool_hat', count: 1 },
    desc: 'Soyuqdan qoruyur.',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'Hamısı', icon: '📦' },
  { id: 'food', label: 'Yemək', icon: '🍖' },
  { id: 'tools', label: 'Alətlər', icon: '⛏️' },
  { id: 'building', label: 'Tikinti', icon: '🧱' },
  { id: 'armor', label: 'Geyim', icon: '🧢' },
];

// ---------- VƏZİYYƏT ----------
let activeCategory = 'all';
let searchQuery = '';
let longPressTimer = null;

// ---------- MASAYA YAXINLIQ ----------
function nearTableNow() {
  const feet = {
    x: camera.position.x,
    y: camera.position.y - EYE_HEIGHT,
    z: camera.position.z,
  };
  return isNearCraftingTable(feet);
}

// ---------- KÖMƏKÇİ FUNKSİYALAR ----------
function maxCraftable(recipe) {
  const counts = Object.entries(recipe.inputs).map(
    ([item, count]) => Math.floor((inventory[item] || 0) / count)
  );
  return counts.length ? Math.min(...counts) : 0;
}

function canCraft(recipe, times = 1) {
  return maxCraftable(recipe) >= times;
}

function ingredientRowHtml(recipe) {
  return Object.entries(recipe.inputs)
    .map(([item, count]) => {
      const have = inventory[item] || 0;
      const ok = have >= count;
      return `<span class="ing ${ok ? 'ok' : 'missing'}">${item} ${have}/${count}</span>`;
    })
    .join('');
}

function filteredRecipes() {
  return RECIPES.filter((r) => {
    const matchesCategory = activeCategory === 'all' || r.category === activeCategory;
    const matchesSearch =
      !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
}

function craftItem(recipeId, times = 1) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return;

  if (recipe.requiresTable && !nearTableNow()) {
    showHint('Bunun üçün əşya yapma masası yanında olmalısan 🛠️');
    renderCraftPanel();
    return;
  }

  const actualTimes = Math.min(times, maxCraftable(recipe));
  if (actualTimes <= 0) return;

  for (const [item, count] of Object.entries(recipe.inputs)) {
    removeFromInventory(item, count * actualTimes);
  }
  addToInventory(recipe.output.item, recipe.output.count * actualTimes);
  flashRow(recipeId);
  renderCraftPanel();
}

function flashRow(recipeId) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-recipe-id="${recipeId}"]`);
    if (!row) return;
    row.classList.add('craft-flash');
    setTimeout(() => row.classList.remove('craft-flash'), 350);
  });
}

// ---------- UI QURULMASI ----------
function buildTabsHtml() {
  return CATEGORIES.map(
    (cat) => `
      <button class="craft-tab ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}">
        <span class="tab-icon">${cat.icon}</span><span class="tab-label">${cat.label}</span>
      </button>`
  ).join('');
}

function buildRowHtml(recipe) {
  const craftable = canCraft(recipe);
  const maxable = maxCraftable(recipe);
  return `
    <div class="craft-row ${craftable ? '' : 'disabled'}" data-recipe-id="${recipe.id}">
      <div class="craft-icon">${recipe.icon}</div>
      <div class="craft-info">
        <div class="craft-name">${recipe.name}</div>
        <div class="craft-need">${ingredientRowHtml(recipe)}</div>
      </div>
      <div class="craft-actions">
        <button class="craft-btn" data-action="craft1" ${craftable ? '' : 'disabled'}>Hazırla</button>
        <button class="craft-btn craft-btn-max" data-action="craftmax" ${maxable > 1 ? '' : 'disabled'}>
          x${Math.max(maxable, 1)}
        </button>
      </div>
      <div class="craft-tooltip">${recipe.desc || ''}</div>
    </div>`;
}

function attachRowListeners(root) {
  root.querySelectorAll('.craft-row').forEach((row) => {
    const id = row.dataset.recipeId;
    row.querySelector('[data-action="craft1"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      craftItem(id, 1);
    });
    row.querySelector('[data-action="craftmax"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      craftItem(id, maxCraftable(RECIPES.find((r) => r.id === id)));
    });

    row.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => row.classList.add('show-tooltip'), 400);
    }, { passive: true });
    row.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
      setTimeout(() => row.classList.remove('show-tooltip'), 1200);
    });
  });
}

export function renderCraftPanel() {
  const list = document.getElementById('craft-list');
  if (!list) return;

  const recipes = filteredRecipes();
  const basic = recipes.filter((r) => !r.requiresTable);
  const advanced = recipes.filter((r) => r.requiresTable);
  const nearTable = nearTableNow();

  let html = '';

  html += `<div class="craft-section-title">🖐️ Sadə hazırlama (masasız)</div>`;
  html += basic.length
    ? `<div class="craft-grid">${basic.map(buildRowHtml).join('')}</div>`
    : `<div class="craft-empty">Heç nə tapılmadı.</div>`;

  html += `<div class="craft-section-title">🛠️ Masa ilə hazırlama</div>`;
  if (!nearTable) {
    html += `<div class="craft-locked">🔒 Yaxınlıqda əşya yapma masası yoxdur. Onu sadə bölmədən hazırla və yerə qoy.</div>`;
  } else if (advanced.length) {
    html += `<div class="craft-grid">${advanced.map(buildRowHtml).join('')}</div>`;
  } else {
    html += `<div class="craft-empty">Heç nə tapılmadı.</div>`;
  }

  list.innerHTML = html;
  attachRowListeners(list);
}

function renderTabsAndSearch() {
  const tabs = document.getElementById('craft-tabs');
  if (tabs) {
    tabs.innerHTML = buildTabsHtml();
    tabs.querySelectorAll('.craft-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        renderTabsAndSearch();
        renderCraftPanel();
      });
    });
  }
}

function setupSearch() {
  const input = document.getElementById('craft-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCraftPanel();
  });
}

// ---------- PANELİ AÇ/BAĞLA ----------
function toggleCraftPanel() {
  const panel = document.getElementById('craft-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderTabsAndSearch();
    renderCraftPanel();
  }
}

export function initCraftSystem() {
  setupSearch();

  const toggleBtn = document.getElementById('craft-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleCraftPanel);
    toggleBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleCraftPanel();
    }, { passive: false });
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') toggleCraftPanel();
    if (e.code === 'Escape') {
      document.getElementById('craft-panel')?.classList.add('hidden');
    }
    const catIndex = Number(e.key) - 1;
    if (!Number.isNaN(catIndex) && CATEGORIES[catIndex]) {
      activeCategory = CATEGORIES[catIndex].id;
      renderTabsAndSearch();
      renderCraftPanel();
    }
  });
}

// showHint actions.js-dədir — dövri asılılıq yaranmasın deyə birbaşa import edirik
// (actions.js craft.js-i import etmir, ona görə təhlükəsizdir).
import { showHint } from './actions.js';

initCraftSystem();