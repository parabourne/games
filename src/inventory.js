// ---------- HOTBAR-ƏSASLI İNVENTAR SİSTEMİ ----------
// İndi ayrıca "limitsiz inventar" yoxdur — topladığın hər şey birbaşa
// hotbar-ın 6 slotundan birinə düşür. Slot: { item, count } və ya boşdursa
// null. Eyni item növündən yığsan, mövcud slot-un sayı artır. Bütün
// slotlar dolu (6 fərqli item növü) VƏ yeni yığdığın item bunlardan biri
// deyilsə, o əşya YERDƏ QALIR (inventara əlavə olunmur).
export const HOTBAR_SIZE = 6;
export const hotbarSlots = new Array(HOTBAR_SIZE).fill(null);

// Geriyə uyğunluq üçün: item -> say şəklində "yalnız oxumaq üçün" görünüş.
// hotbarSlots-dan avtomatik sinxronlaşdırılır (craft.js və s. bunu oxuya bilər).
export const inventory = {};

function syncInventoryView() {
  for (const k of Object.keys(inventory)) delete inventory[k];
  for (const slot of hotbarSlots) {
    if (slot) inventory[slot.item] = slot.count;
  }
}

// Hər item üçün emoji ikon (yeni item növü əlavə etsən, burada da əlavə et)
const ICONS = {
  // xammal
  meat: '🥩',
  wool: '🧶',
  leather: '🟫',
  wood: '🪵',
  stone: '⬜',
  dirt: '🟫',
  sand: '🟨',
  wheat: '🌾',
  carrot: '🥕',
  potato: '🥔',
  coal: '⚫',
  planks: '🪵',
  stick: '🥢',
  crafting_table: '🛠️',

  // hazırlanan (craft) itemlər
  cooked_meat: '🍖',
  bread: '🍞',
  stew: '🍲',
  bed: '🛏️',
  door: '🚪',
  torch: '🔥',
  wood_pickaxe: '⛏️',
  stone_pickaxe: '🪨',
  axe: '🪓',
  sword: '🗡️',
  hoe: '🌱',
  leather_boots: '👢',
  wool_hat: '🧢',
};

export function getIcon(item) {
  return ICONS[item] || '❔';
}

function listEl() {
  return document.getElementById('inventory-list');
}

// item-i mövcud slot-a (varsa) və ya boş slot-a əlavə edir.
// Yer yoxdursa false qaytarır — çağıran tərəf bunu "əşya yerdə qaldı"
// kimi göstərməlidir (BLOCK_DROPS/damageAnimal çağıran yerlərə bax).
export function addToInventory(item, count = 1) {
  const existing = hotbarSlots.find((s) => s && s.item === item);
  if (existing) {
    existing.count += count;
    renderInventory();
    return true;
  }
  const emptyIndex = hotbarSlots.findIndex((s) => s === null);
  if (emptyIndex === -1) {
    return false; // hotbar dolu — əşya yerdə qalır, heç nə dəyişmir
  }
  hotbarSlots[emptyIndex] = { item, count };
  renderInventory();
  return true;
}

export function removeFromInventory(item, count = 1) {
  const idx = hotbarSlots.findIndex((s) => s && s.item === item);
  if (idx === -1) return false;
  if (hotbarSlots[idx].count < count) return false;
  hotbarSlots[idx].count -= count;
  if (hotbarSlots[idx].count <= 0) hotbarSlots[idx] = null;
  renderInventory();
  return true;
}

export function getCount(item) {
  const slot = hotbarSlots.find((s) => s && s.item === item);
  return slot ? slot.count : 0;
}

export function renderInventory() {
  syncInventoryView();

  const el = listEl();
  if (el) {
    el.innerHTML = '';
    for (const slot of hotbarSlots) {
      if (!slot) continue;
      const chip = document.createElement('div');
      chip.className = 'inv-chip';
      chip.textContent = `${getIcon(slot.item)} ${slot.count}`;
      el.appendChild(chip);
    }
  }

  // Hotbar-ın (controls.js-də idarə olunur) yenidən çəkilməsi üçün hadisə
  // göndəririk. Birbaşa import etmirik ki, dövri asılılıq yaranmasın.
  window.dispatchEvent(new Event('inventory-changed'));
}