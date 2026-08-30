// ---------- SADƏ İNVENTAR SİSTEMİ ----------
// item adı -> say (məs. { meat: 3, wool: 2 })
export const inventory = {};

// Hər item üçün emoji ikon (yeni item növü əlavə etsən, burada da əlavə et)
const ICONS = {
  meat: '🥩',
  wool: '🧶',
  leather: '🟫',
};

function listEl() {
  return document.getElementById('inventory-list');
}

export function addToInventory(item, count = 1) {
  inventory[item] = (inventory[item] || 0) + count;
  renderInventory();
}

export function removeFromInventory(item, count = 1) {
  if (!inventory[item] || inventory[item] < count) return false;
  inventory[item] -= count;
  renderInventory();
  return true;
}

export function renderInventory() {
  const el = listEl();
  if (!el) return;
  el.innerHTML = '';
  for (const [item, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const chip = document.createElement('div');
    chip.className = 'inv-chip';
    chip.textContent = `${ICONS[item] || '❔'} ${count}`;
    el.appendChild(chip);
  }
}