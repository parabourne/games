import { inventory, addToInventory, removeFromInventory } from './inventory.js';

// ---------- RESEPTLƏR ----------
export const RECIPES = [
  {
    id: 'cooked_meat',
    name: 'Bişmiş ət',
    icon: '🍖',
    inputs: { meat: 2 },
    output: { item: 'cooked_meat', count: 1 },
  },
  {
    id: 'bed',
    name: 'Yataq (dünyaya qoyula bilər)',
    icon: '🛏️',
    inputs: { wool: 3, leather: 2 },
    output: { item: 'bed', count: 1 },
  },
];

function canCraft(recipe) {
  return Object.entries(recipe.inputs).every(
    ([item, count]) => (inventory[item] || 0) >= count
  );
}

function ingredientsText(recipe) {
  return Object.entries(recipe.inputs)
    .map(([item, count]) => `${item} x${count}`)
    .join(', ');
}

function craftItem(recipeId) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe || !canCraft(recipe)) return;

  for (const [item, count] of Object.entries(recipe.inputs)) {
    removeFromInventory(item, count);
  }
  addToInventory(recipe.output.item, recipe.output.count);
  renderCraftPanel();
}

// ---------- UI ----------
function renderCraftPanel() {
  const list = document.getElementById('craft-list');
  if (!list) return;
  list.innerHTML = '';

  RECIPES.forEach((recipe) => {
    const row = document.createElement('div');
    row.className = 'craft-row';

    const info = document.createElement('div');
    info.className = 'craft-info';
    info.innerHTML = `<div class="craft-name">${recipe.icon} ${recipe.name}</div><div class="craft-need">Lazımdır: ${ingredientsText(recipe)}</div>`;
    row.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'craft-btn';
    btn.textContent = 'Hazırla';
    btn.disabled = !canCraft(recipe);
    btn.addEventListener('click', () => craftItem(recipe.id));
    row.appendChild(btn);

    list.appendChild(row);
  });
}

function toggleCraftPanel() {
  const panel = document.getElementById('craft-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderCraftPanel();
}

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
});